# Soul Trace authentication email templates

These files are local preparation only. They do not update hosted Supabase email settings.

- `confirm-signup-subject.txt` and `confirm-signup.html` belong in **Authentication → Email Templates → Confirm signup**.
- `magic-link-subject.txt` and `magic-link.html` belong in **Authentication → Email Templates → Magic Link**.
- `recovery-subject.txt` and `recovery.html` belong in **Authentication → Email Templates → Reset Password**.

Copy each subject and HTML body into the matching Supabase Dashboard fields manually. The consumer password-signup flow uses Confirm signup; its 6-digit code is entered on the Soul Trace account screen. The existing Letter Download Gate uses Magic Link; its 6-digit code is entered on the result screen. Both templates must show `{{ .Token }}` and must not replace it with a button or site link. These templates are project-wide: changing the hosted settings can affect every app using this Supabase Auth project. This repository change does not update hosted Supabase settings.
