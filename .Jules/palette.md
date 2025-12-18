## 2024-05-23 - Brand Consistency in Tailwind Projects
**Learning:** Tailwind's utility classes (e.g., `text-blue-600`) often conflict with strict brand color codes (e.g., OPS Blue `#2d3f89`). Using custom CSS classes like `.ops-btn-primary` alongside Tailwind is essential for strict brand adherence.
**Action:** Always define `.ops-*` utility classes in the `<style>` block and prefer them over standard Tailwind colors for primary actions.
