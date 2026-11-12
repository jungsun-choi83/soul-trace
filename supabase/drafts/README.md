# Pet-First Stage A migration drafts

These files are review artifacts only. They have not been executed and are not
part of an applied migration history.

- `20261105_001_pet_first_preflight.sql`: read-only schema, ACL, relationship,
  Storage, and legacy-function metadata checks.
- `20261105_001_pet_first_core.sql`: atomic Stage A Pet-First foundation.
- `20261105_001_pet_first_postflight.sql`: read-only checks and count comparisons
  to run after an approved isolated or production application.

## Stage A scope

The migration adds neutral pet profile fields, `ensure_soul_trace_owner()`, and
owner-scoped pet write policies. It creates private `pet_timeline_entries` and
`pet_timeline_assets` tables for text/photo/video memories, including dates,
descriptions, places, favorites, and references to the already-configured photo
and video Storage buckets.

It does not update existing pet ownership or infer Living/Memorial status.
Existing pets receive `life_status = 'unspecified'`; the other profile fields
remain null. It does not rewrite or delete letters, Polaroids, Life Archive rows,
Storage objects, legacy functions, or existing triggers.

The inspected consumer APIs already use these profile/timeline fields and call
`ensure_soul_trace_owner()`; no application-code change is required for this
Stage A schema.

Stage A does not change any grants on `soul_trace_pets`; its transaction checks
that authenticated and `service_role` privileges required by both applications
are already present. It preserves the existing owner-scoped pet SELECT policy,
then adds authenticated owner-scoped insert/update policies. A narrowly scoped
invoker trigger rejects authenticated updates to `pet_id`, `created_at`, and
`owner_user_id`, while retaining the existing pet-table grants and trusted
`service_role`/legacy SECURITY DEFINER behavior. The new timeline tables grant
CRUD to `authenticated` only; the current timeline APIs use that session client,
so `service_role` has no timeline-table grant. Owner RLS and asset-path checks
bind timeline records to the current user's pet and Storage folder.

## Not included

`pet_mood_journal` and `beam_scene_previews` remain later-stage structures in
`supabase/migration_memory_library.sql`. Do not apply that migration as part of
Stage A. The Stage A migration uses the existing private
`life-archive-photos` and `life-archive-videos` buckets without changing their
configuration or policies.

## Production prerequisites

The latest reported backup is from November 4, 2026 at 15:38, and restoration
has not been tested. A visible restore option does not demonstrate recovery
readiness. Before production execution, restore that backup into an isolated
environment and verify the database, Auth records, and required Storage objects;
take a fresh backup immediately before the change and confirm its recovery point.

Run and save a fresh read-only preflight. Confirm the Stage A preconditions and
existing authenticated/service-role pet privileges still match. Compare current
counts with the previously reported reference (323 pets: 127 owned, 196
unowned), then compare every postflight historical count and ownership/link
relationship with the saved preflight. Coordinate a write-free change window or
reconcile expected writes between the two snapshots.

The SQL Editor must run as `postgres`, as verified. Do not proceed if the
preflight rejects a schema difference, any existing access check fails, the
restore rehearsal fails, or postflight historical counts/relationships differ
unexpectedly. No production data or ownership claim is performed by this draft.
