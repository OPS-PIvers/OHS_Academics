## 2024-05-23 - Brand Violation: Wrong Font and Colors
**Learning:** The project was using 'Inter' font and default Tailwind colors (e.g., `bg-blue-600` is #2563EB) instead of 'Lexend' and the strict OPS Tech hex codes (Primary Blue: #2d3f89).
**Action:** Always check `index.html` imports and Tailwind config against brand guidelines. Use a custom Tailwind config to enforce the correct palette and font family.
