# Letter background assets

Place the supplied background images in this directory using these exact filenames:

- `golden-meadow.jpg`
- `night-sky.jpg`
- `soft-clouds.jpg`
- `memory-paper.jpg`

The generated-letter preview requests these files directly. If a file is absent, its selector option
shows the localized temporary-fallback badge and uses the configured gradient placeholder. Do not
replace these files with unrelated images.

Letter themes are scoped to the generated-letter capture window (`data-letter-preview-theme`). They
must not change the application shell, header, navigation, controls, or sections below the preview.
