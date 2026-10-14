# 1751 — Stage 1 Premium Frontend

## Quick start
- **Instant preview:** Open `1751_Stage1_Standalone_Preview.html` directly in a modern browser. It contains all code and optimized artwork in one HTML file; no hosting or unzip is required.
- **Editable website:** Unzip `1751_Stage1_Frontend.zip`, keep the folder structure, and open `index.html` in Chrome, Edge, Safari or Firefox. To preview under an HTTP origin, run `python -m http.server 8000` inside the extracted folder and visit `http://localhost:8000`.
- Edit the website content in `index.html`, interactive logic and sample catalogue in `stage1.js` and the original inline `<script>` in `index.html`, and the theme in `stage1.css` plus original inline `<style>` in `index.html`.
- This is Stage 1 frontend only. Do not publish as a live commerce or registration service before implementing Stage 2 backend and legal pages.

## What was updated
- Fixed all five primary navigation buttons, mobile nav with accessible expanded state, correct active-state indication, search overlay, and hash routing.
- Added an image carousel (three images supplied with the project), previous/next, direct slide selection, pause/play, automatic cycling, visibility/reduced-motion checks.
- Preserved green/white/lavender visual direction, tuned contrast, spacing, cards, focus states, breakpoints and reduced motion support.
- Added product-detail dialogs, product descriptions marked as examples, category/search/sort states, cart quantity controls, price totals, empty states, and session/local storage support.
- Reconstructed Summit schedule with list/calendar day navigation and session-detail views, while explicitly preserving the source's two sample days and honest empty states for three unsupplied days.
- Strengthened contact, community-interest and newsletter demonstration forms with native validation and truthful no-submission messages.
- Added light Community/About content and service enquiry routes without inventing founders, members, partners, legal terms, staff, speakers or achievements.
- Added keyboard Escape and focus management for dialogs, semantic headings, screen reader labels and skip link.
- Converted the 10 supplied PNG images to efficient local WebP files, preserving their original scenes/composition.

## Data provenance and explicit assumptions
- The supplied `1751.pdf` is one very large, single-page design board. Homepage, Summit and Store composition were treated as primary references. Community and About sections are conservatively inferred from the supplied existing site and the prompt.
- The PDF illustrates October 6–10, 2026 as an **example timetable**. Those dates are now past. Only Days 1 and 2 have detailed sample sessions. Days 3–5 deliberately show unavailable details.
- The original site's `40+` sessions is presented as a reference programme aspiration; no current total has been verified.
- The Great African Asset cover/NGN 2,000 display appear in the design. Seven other catalogue items, their prices and descriptions are examples in the uploaded HTML and MUST be replaced with approved inventory before publication.
- The event artwork used in the carousel is taken only from the supplied archive; actual licensing/permission should be verified by the site owner.
- Training, partner, community, article and legal backends are not connected. Search operates on local preview pages and sample products, not a server index.
- The PDF's unused placeholder blocks were not recreated as fake images, clients or unverifiable marketing claims.

## Backend work remaining (not implemented in Stage 1)
1. Secure event registrations, current dates, approved live programme, speakers, email confirmations and capacity management.
2. Product database/CMS, inventory, licensed digital file delivery, secure checkout/payment gateway and payment verification.
3. Live community accounts, authentication, permissions, discussions and moderation.
4. Contact/partnership/training email delivery, spam controls and administrator workflows.
5. Newsletter mailing list, explicit consent handling, verification and unsubscribe workflows.
6. Editorial CMS, approved story/article copy, publication dates and publishing workflows.
7. Legal Privacy Policy, Terms of Service, cookie/analytics consent, public contacts and production monitoring.

## Browser support and operational notes
- Latest Chrome, Edge, Firefox and Safari are intended. Local storage support can vary under `file://`; use HTTP for production-like testing.
- Optional Google Fonts require an internet connection; system fallbacks remain readable offline.
- No external JS framework, API key, checkout service or analytics tracker has been introduced.
- Recommended production improvements: split the legacy inline CSS/JS into modules, set Content Security Policy, verify source rights/data, run real-device browser QA and connect backend systems with server-side validation.
