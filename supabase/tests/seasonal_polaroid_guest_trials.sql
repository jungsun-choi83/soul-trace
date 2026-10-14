-- Review-only PostgreSQL regression harness.
-- Run only against a disposable database after both Seasonal migrations have
-- been applied. It intentionally rolls back all rows. It is not a production
-- migration and is not executed by the application test command.
--
-- For true parallel admission, run this transaction from two or more psql/
-- pgbench sessions using the same guest hash and different idempotency keys;
-- the guest-row FOR UPDATE lock must yield at most two `reserved` decisions.

begin;

do $$
declare
  guest_one text := repeat('a', 64);
  guest_two text := repeat('b', 64);
  guest_three text := repeat('c', 64);
  request_one text := repeat('1', 64);
  request_two text := repeat('2', 64);
  request_three text := repeat('3', 64);
  request_four text := repeat('4', 64);
  request_expired text := repeat('e', 64);
  job_one text := repeat('5', 64);
  job_two text := repeat('6', 64);
  job_four text := repeat('7', 64);
  job_retry text := repeat('8', 64);
  result jsonb;
  reservation uuid;
  reservation_version integer;
  old_version integer;
begin
  result := public.reserve_seasonal_polaroid_guest_trial(guest_one, request_one, request_one, now() + interval '1 hour');
  if result->>'decision' <> 'reserved' or result->>'remaining' <> '1' then
    raise exception 'first guest reservation failed: %', result;
  end if;
  reservation := (result->>'reservation_id')::uuid;
  reservation_version := (result->>'reservation_version')::integer;
  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count, input_ready
  ) values (job_one, request_one, 'seasonal_polaroid', 'processing', 1, true);
  if not public.bind_seasonal_polaroid_guest_trial(reservation, reservation_version, job_one, request_one) then
    raise exception 'first reservation did not bind';
  end if;
  if not public.complete_ai_generation_job(job_one, request_one, '{}'::jsonb) then
    raise exception 'first queue completion was rejected';
  end if;
  perform public.reconcile_seasonal_polaroid_guest_trial(guest_one);

  result := public.reserve_seasonal_polaroid_guest_trial(guest_one, request_one, request_one, now() + interval '1 hour');
  if result->>'decision' <> 'already_succeeded' or result->>'remaining' <> '1' then
    raise exception 'successful idempotent reuse failed: %', result;
  end if;

  result := public.reserve_seasonal_polaroid_guest_trial(guest_one, request_two, request_two, now() + interval '1 hour');
  if result->>'decision' <> 'reserved' or result->>'remaining' <> '0' then
    raise exception 'second reservation failed: %', result;
  end if;
  reservation := (result->>'reservation_id')::uuid;
  reservation_version := (result->>'reservation_version')::integer;
  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count, input_ready
  ) values (job_two, request_two, 'seasonal_polaroid', 'queued', 1, true);
  if not public.bind_seasonal_polaroid_guest_trial(reservation, reservation_version, job_two, request_two) then
    raise exception 'second reservation did not bind';
  end if;

  -- The second successful completion consumes the final slot.
  update public.ai_generation_jobs set status = 'processing' where idempotency_key = job_two;
  if not public.complete_ai_generation_job(job_two, request_two, '{}'::jsonb) then
    raise exception 'second queue completion was rejected';
  end if;
  perform public.reconcile_seasonal_polaroid_guest_trial(guest_one);
  if (select successful_count from public.seasonal_polaroid_guest_trials where guest_hash = guest_one) <> 2 then
    raise exception 'two successful generations were not finalized';
  end if;
  if (select x.reserved from jsonb_to_record(public.reconcile_seasonal_polaroid_guest_trial(guest_one)) as x(successful integer, reserved integer, remaining integer)) <> 0 then
    raise exception 'successful reservations still occupy a slot';
  end if;

  result := public.reserve_seasonal_polaroid_guest_trial(guest_one, request_three, request_three, now() + interval '1 hour');
  if result->>'decision' <> 'exhausted' then
    raise exception 'third reservation was not rejected: %', result;
  end if;

  result := public.reserve_seasonal_polaroid_guest_trial(guest_two, request_two, request_two, now() + interval '1 hour');
  if result->>'decision' <> 'unavailable' then
    raise exception 'cross-guest idempotency was not rejected: %', result;
  end if;

  if public.release_seasonal_polaroid_guest_trial(
    (select reservation_id from public.seasonal_polaroid_guest_reservations where idempotency_key = request_one),
    (select reservation_version from public.seasonal_polaroid_guest_reservations where idempotency_key = request_one)
  ) then
    raise exception 'release freed a succeeded reservation';
  end if;

  result := public.reserve_seasonal_polaroid_guest_trial(guest_two, request_four, request_four, now() + interval '1 hour');
  reservation := (result->>'reservation_id')::uuid;
  reservation_version := (result->>'reservation_version')::integer;
  old_version := reservation_version;
  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count, input_ready
  ) values (job_four, request_four, 'seasonal_polaroid', 'queued', 1, true);
  if not public.bind_seasonal_polaroid_guest_trial(reservation, reservation_version, job_four, request_four) then
    raise exception 'failure-recovery reservation did not bind';
  end if;
  update public.ai_generation_jobs set status = 'failed' where idempotency_key = job_four;
  if not public.release_seasonal_polaroid_guest_trial(reservation, reservation_version) then
    raise exception 'failed job did not release its reservation';
  end if;
  if (select job_id from public.seasonal_polaroid_guest_reservations where reservation_id = reservation) is not null then
    raise exception 'released reservation retained stale job ownership';
  end if;
  result := public.reserve_seasonal_polaroid_guest_trial(guest_two, request_four, request_four, now() + interval '1 hour');
  if result->>'decision' <> 'reserved' then
    raise exception 'failed request was not recoverable: %', result;
  end if;
  reservation := (result->>'reservation_id')::uuid;
  reservation_version := (result->>'reservation_version')::integer;
  if reservation_version <= old_version then
    raise exception 'reservation version did not advance on reactivation';
  end if;
  if (select job_id from public.seasonal_polaroid_guest_reservations where reservation_id = reservation) is not null then
    raise exception 'reactivated reservation retained stale job ownership';
  end if;
  -- A delayed callback from the first failed attempt must not release this
  -- reactivated reservation, even though the queue row is still terminally failed.
  if public.release_seasonal_polaroid_guest_trial(reservation, old_version) then
    raise exception 'stale failure callback released a reactivated reservation';
  end if;
  update public.ai_generation_jobs set status = 'processing' where idempotency_key = job_four;
  if not public.complete_ai_generation_job(job_four, request_four, '{}'::jsonb) then
    raise exception 'retry queue completion was rejected';
  end if;
  if not public.finalize_seasonal_polaroid_guest_trial(reservation, reservation_version) then
    raise exception 'retried successful job did not finalize';
  end if;
  if (select successful_count from public.seasonal_polaroid_guest_trials where guest_hash = guest_two) <> 1 then
    raise exception 'retry success count was not recorded';
  end if;

  -- An expired live job is failed before its reservation is released, so a
  -- late completion cannot consume a slot after recovery.
  result := public.reserve_seasonal_polaroid_guest_trial(guest_three, request_expired, request_expired, now() - interval '1 hour');
  reservation := (result->>'reservation_id')::uuid;
  reservation_version := (result->>'reservation_version')::integer;
  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count, input_ready
  ) values (repeat('9', 64), request_expired, 'seasonal_polaroid', 'queued', 1, true);
  if not public.bind_seasonal_polaroid_guest_trial(reservation, reservation_version, repeat('9', 64), request_expired) then
    raise exception 'expired reservation did not bind';
  end if;
  perform public.reconcile_seasonal_polaroid_guest_trial(guest_three, now());
  if (select status from public.ai_generation_jobs where idempotency_key = repeat('9', 64)) <> 'failed' then
    raise exception 'expired live job was not failed safely';
  end if;
  if (select status from public.seasonal_polaroid_guest_reservations where reservation_id = reservation) <> 'released' then
    raise exception 'expired reservation was not released';
  end if;
  if public.complete_ai_generation_job(repeat('9', 64), request_expired, '{}'::jsonb) then
    raise exception 'late completion succeeded after reservation expiry';
  end if;
end;
$$;

rollback;
