## 2024-05-22 - Runtime Tailwind Configuration in GAS
**Learning:** To strictly enforce OPS Tech brand colors (e.g., #2d3f89) in a CDN-based Tailwind setup within Google Apps Script, we can inject a `tailwind.config` object via a script tag. This avoids the need for a build step while enabling semantic class names like `bg-ops-primary`.
**Action:** Always include the `tailwind.config` script block in `index.html` to define the custom palette and font family (Lexend) immediately after the Tailwind CDN.
