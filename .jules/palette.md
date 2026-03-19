## 2024-05-14 - Button Loading States & Custom Toggle Accessibility
**Learning:** Missing loading states on async form submissions can lead to double clicks and poor user feedback. Custom toggle buttons (like advanced filters) often miss `aria-expanded` and `aria-controls` attributes, making them inaccessible to screen readers.
**Action:** Always disable buttons and show a loading spinner during async operations. Add `aria-expanded` and `aria-controls` to custom toggles and update their state dynamically via JavaScript.
