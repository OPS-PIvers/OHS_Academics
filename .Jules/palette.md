# Palette's Journal

## 2025-12-22 - Tailwind Runtime Configuration
**Learning:** When using Tailwind CSS via CDN in Google Apps Script, we can inject a `tailwind.config` object in a `<script>` tag to define custom brand colors (e.g., `ops-primary`) and fonts without a build step. This is cleaner than hardcoding hex values in classes.
**Action:** Always include a `tailwind.config` script block in `index.html` to map OPS Tech Brand colors to utility classes.

## 2025-12-22 - Lexend Font Enforcement
**Learning:** The 'Inter' font was previously hardcoded in the HTML template, violating brand guidelines.
**Action:** Always verify the Google Fonts import URL and CSS `font-family` are set to 'Lexend' during the OBSERVE phase.
