# Palette's Journal

## 2024-05-22 - OPS Tech Brand Alignment
**Learning:** The previous implementation used generic Tailwind colors (e.g., `text-blue-600`, `bg-red-50`) and the "Inter" font, which violates the OPS Tech Brand Guidelines requiring "Lexend" and specific hex codes (e.g., `#2d3f89` for Primary Blue).
**Action:** Implemented a runtime Tailwind configuration in `index.html` to extend the theme with `ops-*` colors and set "Lexend" as the default sans font. Replaced generic classes with brand-specific utility classes to ensure visual consistency and compliance.
