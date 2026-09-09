# Supabase deployment

Supabase migrations are applied manually. Vercel builds and deployments do not run these SQL files.

For an existing database, take a current backup and verify each migration in a separate environment before applying it to production. Apply the five current migrations in this exact order:

1. `migration_add_generation_locale.sql`
2. `migration_add_life_archive_foundation.sql`
3. `migration_enable_life_archive_memory_writes.sql`
4. `migration_add_life_archive_photos.sql`
5. `migration_add_persistent_letter_result.sql`

Keep `NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE` disabled until every required migration has completed successfully and the resulting tables, functions, triggers, storage bucket, grants, and RLS policies have been verified. Temporary Life Archive mode remains available while secure mode is disabled.

Authentication confirmation and password recovery call `claim_soul_trace_legacy_records()`. Confirmation flows therefore require the foundation migration before they can complete successfully.

Treat preview and production as separate Supabase environments. Back up, migrate, and verify each environment independently; never assume that applying a migration to preview also updates production.
