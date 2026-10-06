# Soul Trace authentication email templates

These files are local preparation only. They do not update hosted Supabase email settings.

- `confirm-signup-subject.txt` and `confirm-signup.html` belong in **Authentication → Email Templates → Confirm signup**.
- `magic-link-subject.txt` and `magic-link.html` belong in **Authentication → Email Templates → Magic Link**.
- `recovery-subject.txt` and `recovery.html` belong in **Authentication → Email Templates → Reset Password**.

Copy each subject and HTML body into the matching Supabase Dashboard fields manually. New accounts receive the Confirm signup template, and existing accounts receive the Magic Link template. Both must show `{{ .Token }}` so the result screen can accept the 6-digit code. Do not put a button or site link in these two templates. A confirmation link falls back to the Supabase Site URL, which opens the shop instead of showing the code.
