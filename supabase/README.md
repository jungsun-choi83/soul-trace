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
11. `migration_account_archive_persistence.sql`
12. `migration_ai_generation_safety.sql`
13. `migration_ai_generation_queue.sql`
14. `migration_ai_generation_supabase_cron.sql`

Migration 12 is required before deploying the Phase 1 generation-hardening code.
The paid generation routes fail closed with HTTP 503 until its tables and RPCs
exist. After applying it, verify that `anon` and `authenticated` cannot read the
two AI safety tables or execute their functions, while `service_role` can call
all three RPCs. If Supabase Cron is available, schedule the two retention DELETE
statements documented at the bottom of the migration once per day.

Migration 13 extends the same job table into a durable FIFO queue and creates the
private `ai-generation-inputs` Storage bucket used for queued Visual Memory
reference photos. Apply it only after migration 12 has been verified. The queue
worker uses the service role through its server-only RPCs; do not grant table
access to browser roles. Apply migration 14 only after migration 13 has been
verified.

Migration 14 replaces the incompatible Vercel one-minute Cron fallback with a
Supabase Cron job. It does not enable extensions or create secrets. In the
Supabase Dashboard, enable `pg_cron` and `pg_net`, create these Vault secrets,
and deploy the application with the matching `CRON_SECRET` before applying it.
Applying migration 14 is what activates the once-per-minute recovery job, so it
must be the final scheduler step:

- `soul_trace_ai_worker_url`: `https://soultrace.pet/api/internal/ai-worker`
- `soul_trace_cron_secret`: the same value configured as Vercel `CRON_SECRET`

The migration reads both values from `vault.decrypted_secrets`, sends an
authenticated POST through `pg_net`, and schedules the worker once per minute.
The Next.js `after()` trigger remains the fast path. The PostgreSQL claim/lease
logic makes duplicate worker invocations safe. Never put the secret values in
this SQL file, source control, or any `NEXT_PUBLIC_` variable.

The partner migrations are ordered prerequisites: the partner foundation creates the original `HOSPITAL`/`FUNERAL` tables and profile attribution, the track/rate migration adds the settlement and legacy Living/Memorial fields used by the APIs, and the final partner-type migration widens the trusted type constraint to include `GROOMING` and `PENSION`. The widening migration does not rewrite partners or codes, so existing IDs, codes, status, settlement data, and printed `/?p=code` links remain intact. Deploy application code that creates Grooming or Pension partners only after all three partner migrations have been verified in that environment.

Keep `NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE` disabled until every required migration has completed successfully and the resulting tables, functions, triggers, storage bucket, grants, and RLS policies have been verified. Temporary Life Archive mode remains available while secure mode is disabled.

After migration 11 has been verified in the target Supabase project, set
`NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE=1` in that deployment and redeploy. This
enables account discovery and remote photo/video persistence; it does not migrate
temporary browser-only media.

Authentication confirmation and password recovery call `claim_soul_trace_legacy_records()`. Confirmation flows therefore require the foundation migration before they can complete successfully.

Treat preview and production as separate Supabase environments. Back up, migrate, and verify each environment independently; never assume that applying a migration to preview also updates production.
