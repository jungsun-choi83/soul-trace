-- Review-only PostgreSQL regression harness.
-- Run only against a disposable database after the Seasonal queue, results,
-- and durable-persistence migrations have been applied. It rolls back all
-- rows and requires at least one disposable auth.users row for the owner FK.

begin;

do $$
declare
  owner_id uuid;
  owner_hash text := repeat('a', 64);
  failed_job text := repeat('1', 64);
  failed_request text := repeat('2', 64);
  active_job text := repeat('3', 64);
  active_request text := repeat('4', 64);
  malformed_job text := repeat('5', 64);
  malformed_request text := repeat('6', 64);
  wrong_key_job text := repeat('7', 64);
  wrong_key_request text := repeat('8', 64);
  failed_result uuid := gen_random_uuid();
  active_result uuid := gen_random_uuid();
  malformed_result uuid := gen_random_uuid();
  wrong_key_result uuid := gen_random_uuid();
  invalid_owner_id uuid := gen_random_uuid();
  missing_job text := repeat('9', 64);
  attach_job text := repeat('a', 64);
  attach_request text := repeat('b', 64);
  failed_unowned_job text := repeat('c', 64);
  failed_unowned_request text := repeat('d', 64);
  different_owner_hash text := repeat('b', 64);
  result_payload jsonb;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then
    raise exception 'seed one disposable auth.users row before running this harness';
  end if;

  insert into public.soul_trace_owners(user_id)
  values (owner_id)
  on conflict (user_id) do nothing;

  if public.attach_seasonal_polaroid_job_owner(missing_job, invalid_owner_id, owner_hash) then
    raise exception 'invalid owner attachment was accepted';
  end if;
  if exists (select 1 from public.soul_trace_owners where user_id = invalid_owner_id) then
    raise exception 'invalid owner attachment left an owner row';
  end if;

  -- A newly acquired job has no queue owner hash until input attachment. The
  -- owner RPC must establish that hash while holding the queue-row lock.
  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    input_ready, owner_identity_hash
  ) values (
    attach_job, attach_request, 'seasonal_polaroid', 'processing', 1, false, null
  );
  if not public.attach_seasonal_polaroid_job_owner(attach_job, owner_id, owner_hash) then
    raise exception 'null owner hash was not attached';
  end if;
  if (select owner_identity_hash from public.ai_generation_jobs where idempotency_key = attach_job) <> owner_hash then
    raise exception 'owner hash was not written to the queue row';
  end if;
  if not exists (
    select 1 from public.seasonal_polaroid_job_owners
     where job_id = attach_job and owner_user_id = owner_id and owner_identity_hash = owner_hash
  ) then
    raise exception 'owner registry row was not created';
  end if;
  if not public.attach_seasonal_polaroid_job_owner(attach_job, owner_id, owner_hash) then
    raise exception 'matching owner reattachment was not idempotent';
  end if;
  if public.attach_seasonal_polaroid_job_owner(attach_job, owner_id, different_owner_hash) then
    raise exception 'mismatched owner hash was accepted';
  end if;

  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    input_ready, owner_identity_hash
  ) values (
    failed_unowned_job, failed_unowned_request, 'seasonal_polaroid', 'failed', 1, false, null
  );
  if public.attach_seasonal_polaroid_job_owner(failed_unowned_job, owner_id, owner_hash) then
    raise exception 'failed job accepted an owner attachment';
  end if;
  if exists (select 1 from public.seasonal_polaroid_job_owners where job_id = failed_unowned_job) then
    raise exception 'failed owner attachment created a registry row';
  end if;

  result_payload := jsonb_build_object(
    'resultId', failed_result::text,
    'image', jsonb_build_object(
      'objectKey', 'seasonal-polaroid/' || failed_job || '/result/' || repeat('c', 16) || '.jpg'
    ),
    'pet', jsonb_build_object('name', 'Test', 'species', 'cat', 'status', 'living'),
    'themeId', 'halloween',
    'costumeId', 'pumpkin',
    'memo', jsonb_build_object(
      'locale', 'en',
      'lines', jsonb_build_array('Mom, happy Halloween!', 'I am in a pumpkin!', 'Save me a treat.', 'Love, Test.')
    ),
    'generation', '{}'::jsonb
  );

  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    input_ready, owner_identity_hash
  ) values (
    failed_job, failed_request, 'seasonal_polaroid', 'failed', 3, true, owner_hash
  );
  insert into public.seasonal_polaroid_job_owners(job_id, owner_user_id, owner_identity_hash)
  values (failed_job, owner_id, owner_hash);

  if public.complete_seasonal_polaroid_job(failed_job, failed_request, result_payload) then
    raise exception 'late completion after failure was accepted';
  end if;
  if exists (select 1 from public.seasonal_polaroid_results where job_id = failed_job) then
    raise exception 'failed job created a gallery result';
  end if;
  if public.complete_seasonal_polaroid_job(failed_job, failed_request, result_payload) then
    raise exception 'repeated late completion after failure was accepted';
  end if;
  if exists (select 1 from public.seasonal_polaroid_results where job_id = failed_job) then
    raise exception 'repeated failed completion created a gallery result';
  end if;

  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    input_ready, owner_identity_hash
  ) values (
    malformed_job, malformed_request, 'seasonal_polaroid', 'processing', 1, true, owner_hash
  );
  insert into public.seasonal_polaroid_job_owners(job_id, owner_user_id, owner_identity_hash)
  values (malformed_job, owner_id, owner_hash);

  result_payload := jsonb_set(result_payload, '{resultId}', to_jsonb(malformed_result::text));
  result_payload := jsonb_set(result_payload, '{image,objectKey}', to_jsonb(
    'seasonal-polaroid/' || malformed_job || '/result/' || repeat('c', 16) || '.jpg'
  ));

  result_payload := result_payload #- '{memo,locale}';
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'missing memo locale was accepted';
  end if;
  result_payload := jsonb_set(result_payload, '{memo,locale}', 'null'::jsonb, true);
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'null memo locale was accepted';
  end if;

  result_payload := jsonb_set(result_payload, '{memo,locale}', to_jsonb('en'::text), true);
  result_payload := result_payload #- '{pet,status}';
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'missing pet status was accepted';
  end if;
  result_payload := jsonb_set(result_payload, '{pet,status}', 'null'::jsonb, true);
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'null pet status was accepted';
  end if;

  result_payload := jsonb_set(result_payload, '{pet,status}', to_jsonb('living'::text), true);
  result_payload := result_payload #- '{memo,lines}';
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'missing memo lines were accepted';
  end if;
  result_payload := jsonb_set(result_payload, '{memo,lines}', 'null'::jsonb, true);
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'null memo lines were accepted';
  end if;
  result_payload := jsonb_set(result_payload, '{memo,lines}', to_jsonb('not-an-array'::text), true);
  if public.complete_seasonal_polaroid_job(malformed_job, malformed_request, result_payload) then
    raise exception 'non-array memo lines were accepted';
  end if;
  if exists (select 1 from public.seasonal_polaroid_results where job_id = malformed_job) then
    raise exception 'malformed result created a gallery row';
  end if;

  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    input_ready, owner_identity_hash
  ) values (
    wrong_key_job, wrong_key_request, 'seasonal_polaroid', 'processing', 1, true, owner_hash
  );
  insert into public.seasonal_polaroid_job_owners(job_id, owner_user_id, owner_identity_hash)
  values (wrong_key_job, owner_id, owner_hash);
  result_payload := jsonb_build_object(
    'resultId', wrong_key_result::text,
    'image', jsonb_build_object(
      'objectKey', 'seasonal-polaroid/' || repeat('z', 64) || '/result/' || repeat('d', 16) || '.jpg'
    ),
    'pet', jsonb_build_object('name', 'Test', 'species', 'cat', 'status', 'living'),
    'themeId', 'halloween',
    'costumeId', 'pumpkin',
    'memo', jsonb_build_object(
      'locale', 'en',
      'lines', jsonb_build_array('Mom, happy Halloween!', 'I am in a pumpkin!', 'Save me a treat.', 'Love, Test.')
    ),
    'generation', '{}'::jsonb
  );
  if public.complete_seasonal_polaroid_job(wrong_key_job, wrong_key_request, result_payload) then
    raise exception 'object key for another job was accepted';
  end if;
  if exists (select 1 from public.seasonal_polaroid_results where job_id = wrong_key_job) then
    raise exception 'wrong object key created a gallery row';
  end if;

  result_payload := jsonb_set(result_payload, '{resultId}', to_jsonb(active_result::text));
  result_payload := jsonb_set(result_payload, '{image,objectKey}', to_jsonb(
    'seasonal-polaroid/' || active_job || '/result/' || repeat('c', 16) || '.jpg'
  ));
  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    input_ready, owner_identity_hash
  ) values (
    active_job, active_request, 'seasonal_polaroid', 'processing', 1, true, owner_hash
  );
  insert into public.seasonal_polaroid_job_owners(job_id, owner_user_id, owner_identity_hash)
  values (active_job, owner_id, owner_hash);

  if not public.complete_seasonal_polaroid_job(active_job, active_request, result_payload) then
    raise exception 'active completion was rejected';
  end if;
  if not public.complete_seasonal_polaroid_job(active_job, active_request, result_payload) then
    raise exception 'repeated active completion was not idempotent';
  end if;
end;
$$;

rollback;
