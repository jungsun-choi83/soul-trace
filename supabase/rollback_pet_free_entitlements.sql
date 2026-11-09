-- Removes only the free-trial tables added by migration_pet_free_entitlements.sql.
-- Does not drop soul_trace_pets or letter rows.

drop function if exists public.finish_pet_free_polaroid(uuid, boolean);
drop function if exists public.reserve_pet_free_polaroid(uuid, uuid, text, text);
drop table if exists public.generation_jobs;
drop table if exists public.pet_free_entitlements;
