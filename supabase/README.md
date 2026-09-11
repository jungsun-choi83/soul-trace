# Supabase deployment

Supabase migrations are applied manually. Vercel builds and deployments do not run these SQL files.

For an existing database, take a current backup and verify each migration in a separate environment before applying it to production. Apply the complete current migration set in this exact order:

1. `migration_add_generation_locale.sql`
2. `migration_add_partners.sql`
3. `migration_add_partner_track_and_rate.sql`
4. `migration_add_partner_types_grooming_pension.sql`
5. `migration_add_life_archive_foundation.sql`
6. `migration_enable_life_archive_memory_writes.sql`
7. `migration_add_life_archive_photos.sql`
8. `migration_add_persistent_letter_result.sql`
9. `migration_add_stamp_photos.sql`
10. `migration_allow_multiple_letters_per_account.sql`

The partner migrations are ordered prerequisites: the partner foundation creates the original `HOSPITAL`/`FUNERAL` tables and profile attribution, the track/rate migration adds the settlement and legacy Living/Memorial fields used by the APIs, and the final partner-type migration widens the trusted type constraint to include `GROOMING` and `PENSION`. The widening migration does not rewrite partners or codes, so existing IDs, codes, status, settlement data, and printed `/?p=code` links remain intact. Deploy application code that creates Grooming or Pension partners only after all three partner migrations have been verified in that environment.

Keep `NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE` disabled until every required migration has completed successfully and the resulting tables, functions, triggers, storage bucket, grants, and RLS policies have been verified. Temporary Life Archive mode remains available while secure mode is disabled.

Authentication confirmation and password recovery call `claim_soul_trace_legacy_records()`. Confirmation flows therefore require the foundation migration before they can complete successfully.

Treat preview and production as separate Supabase environments. Back up, migrate, and verify each environment independently; never assume that applying a migration to preview also updates production.
