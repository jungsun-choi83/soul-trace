# Soul Trace authentication email templates

These files are local preparation only. They do not update hosted Supabase email settings.

- `confirm-signup-subject.txt` and `confirm-signup.html` belong in **Authentication → Email Templates → Confirm signup**.
- `magic-link-subject.txt` and `magic-link.html` belong in **Authentication → Email Templates → Magic Link**.
- `recovery-subject.txt` and `recovery.html` belong in **Authentication → Email Templates → Reset Password**.

Copy each subject and HTML body into the matching Supabase Dashboard fields manually. Both templates branch only on the validated `user_metadata.locale` value and default to English. Keep `{{ .ConfirmationURL }}` unchanged: Supabase uses it to preserve the per-request redirect destination and secure verification data.
