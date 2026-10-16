# Life Archive Phase 2 setup

Phase 2 adds the data and verified-session foundation only. It does not connect
the result page or replace the mock data on `/life-archive`.

## Apply the database migration

Run `migration_add_life_archive_foundation.sql` in the Supabase SQL editor after
the existing Soul Trace migrations. It creates new tables, copies existing rows,
and keeps the legacy tables unchanged.

The copy process preserves the saved letter and all eight original answers.
Answers 1–5 can later be counted as Soul Trace memories. Answers 6–8 remain
letter-tone answers and must not be counted as memories.

## Configure verified email sessions

1. Add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the deployment environment.
2. In Supabase Auth URL Configuration, add the deployed site's
   `/auth/confirm` URL to the allowed redirect URLs.
3. Use this Magic Link template so the server receives a hashed one-time token:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">
  Verify your email
</a>
```

The app looks up the email from the saved `letter_id`; the owner does not enter
it again. The callback accepts only a verified Supabase user and calls
`claim_soul_trace_legacy_records()`. That function matches the verified email to
old records once, then assigns `owner_user_id`. Normal reads use Row Level
Security and UUID relationships, not email.

## Not enabled in Phase 2

- No result-page button or route connection
- No server-loaded Life Archive data
- No memory insert, update, or delete policy
- No multiple-pet selector
- No persistent return-to-letter route
