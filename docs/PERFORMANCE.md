# Performance and accessibility — 14 October 2026

Measured with Lighthouse 13.5.0 and Chromium 154 on the local HTTP fixture application using
simulated mobile/desktop throttling. Provider responses are explicit doubles, not actual network
latencies. Scores vary with machine load and are not field Core Web Vitals or deployed acceptance.
The final run completed without runtime errors or run warnings.

| Profile | Performance | Accessibility | Best practices | SEO | FCP | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile | 97 | 100 | 100 | 100 | 1.5 s | 2.2 s | 0.068 | 0 ms |
| Desktop | 78 | 100 | 100 | 100 | 1.5 s | 2.7 s | 0.046 | 90 ms |

Ten original WebP images are retained. The original DM Sans/Manrope font families are now
self-hosted as licensed variable WOFF2 files, removing the blocked external font request. Public
routes render approved records/metadata on the server; public cache times are bounded and private
routes are no-store. Query/export/storage sizes are capped. No heavy client framework was added.

The desktop performance score of 78 and 2.7s lab LCP leave optimization work before a demanding
performance target can be accepted. Remaining lab opportunities include original image dimension/
loading hints, render-blocking CSS and unused/unminified browser code. This release preserves the
existing architecture/layout; agree deployment performance targets and measure the real preview
with actual data before launch. Do not present the mobile score as evidence for all pages/devices.

Axe on authenticated admin overview and public home found no serious/critical violations. Browser
checks exercise native dialog focus/Escape and widths 320–1920 for admin, 375/768/1440 on original
public pages/account. Carousel targets/contrast and heading/cart labels were corrected additively.
Lighthouse accessibility 100 does not certify WCAG 2.2 AA. Human keyboard/screen-reader, low vision,
reduced-motion and full-flow verification remain acceptance requirements.

HTML reports and machine-readable results are included under docs/evidence/. Screenshots are
local test records only; they are not deployed inventory or production customer data.
