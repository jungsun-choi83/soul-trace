-- Allow the Letter questionnaire to grow without a stale positional upper bound.
--
-- The application assigns contiguous answer_order values starting at 1 and
-- validates the expected answer count for each Letter flow.  The database
-- keeps the invariant that an answer position must be positive.  Existing
-- rows, keys, foreign keys, triggers, RLS, and policies are not changed.

begin;

alter table public.soul_trace_answers
  drop constraint if exists soul_trace_answers_answer_order_check;

alter table public.soul_trace_submission_answers
  drop constraint if exists soul_trace_submission_answers_answer_order_check;

alter table public.soul_trace_answers
  add constraint soul_trace_answers_answer_order_check
  check (answer_order > 0);

alter table public.soul_trace_submission_answers
  add constraint soul_trace_submission_answers_answer_order_check
  check (answer_order > 0);

commit;

-- Read-only verification (run after the transaction completes).
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('soul_trace_answers', 'soul_trace_submission_answers')
  and con.conname in (
    'soul_trace_answers_answer_order_check',
    'soul_trace_submission_answers_answer_order_check'
  )
order by c.relname;

select
  'soul_trace_answers' as table_name,
  count(*) filter (where answer_order <= 0) as invalid_rows,
  min(answer_order) as minimum_order,
  max(answer_order) as maximum_order
from public.soul_trace_answers
union all
select
  'soul_trace_submission_answers' as table_name,
  count(*) filter (where answer_order <= 0) as invalid_rows,
  min(answer_order) as minimum_order,
  max(answer_order) as maximum_order
from public.soul_trace_submission_answers;
