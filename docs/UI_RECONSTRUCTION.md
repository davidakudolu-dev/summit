# 1751 UI reference reconstruction — 17 October 2026

This implementation follows the three PNGs in the uploaded **1751 homepage.zip**. The other two
uploaded projects were inspected for assets and existing architecture; their embedded instructions
were treated as reference material. The current working application remains the functional base.

## Downloads and review

- [Dashboard static preview ZIP](https://github.com/davidakudolu-dev/summit/raw/refs/heads/cloudflare-sandbox-package/1751_DASHBOARD_UPLOAD_STATIC_ONLY.zip) — upload this one to Pages Direct Upload; 39 public files.
- [Full Wrangler source ZIP](https://github.com/davidakudolu-dev/summit/raw/refs/heads/cloudflare-sandbox-package/1751_WRANGLER_FULL_SOURCE_DO_NOT_UPLOAD_TO_DASHBOARD.zip) — extract and deploy with Wrangler; never dashboard-upload this ZIP.
- [Screenshots and comparisons ZIP](https://github.com/davidakudolu-dev/summit/raw/refs/heads/cloudflare-sandbox-package/1751_UI_SCREENSHOTS_AND_COMPARISONS.zip) — nine browser renders plus three side-by-side reference comparisons and measurement reports.
- [Windows deployment instructions](CLOUDFLARE_WINDOWS.md).

## Reference architecture

| View | Components, in reference order | Original desktop canvas |
| --- | --- | --- |
| Home | Lavender navigation; split hero/slideshow; interactive ecosystem diagram; six ecosystem cards; Africa potential feature; student initiative; horizontal products; community/media; three editorial cards; quotation controls; dark collaboration panel; newsletter; footer | 1440 × 7814 |
| Store | Shared navigation; dark book feature; category/search/sort controls; two product rows; promotional panel; footer | 1440 × 3195 |
| Summit | Shared navigation; image/text hero; partner placeholders; schedule overview/statistics; upcoming-events panel and month calendar; daily session panel; four attendee cards; registration strip; footer | 1440 × 3620 |

Desktop section boundaries were measured from the original PNGs. The home boundaries are 80, 860,
905, 2728, 2743, 3376, 3416, 4015, 4829, 5439, 6529, 6649, 7149 and 7388 pixels. They are reproduced
by real HTML/CSS components, not by rendering an entire artboard as a background image.

`reference.css` owns the reference presentation and responsive rules. `reference.js` provides the
month calendar, daily session presentation, shared header behavior, slideshow controls and quote
controls. The existing data adapters and event handlers still own forms, requests and mutations.
SVG symbols in `assets/icons.svg` are reusable. The logo, team photograph and book artwork were
extracted as image assets from the supplied screenshots; the speaker uses the original image asset.
Original images, stylesheets and every existing destination remain available.

## Visual validation

Chromium rendered all three routes at **1440, 768 and 375 pixels**. Each was checked for document
horizontal overflow, console exceptions and responsive navigation. Slideshow next-image, calendar
month changes and day-to-session navigation were exercised. The matching desktop renders and
side-by-side comparisons are in the screenshot download.

Multiple comparison passes corrected section heights, image crops, header alignment, card spacing,
footer layout, mobile diagram sizing and clipped text. The final desktop canvas heights match the
three references. Pixel measurements are in `comparison-metrics.json` in the screenshots ZIP.
Mean absolute RGB differences are diagnostic values, not a percentage accuracy or certification:
font rasterization, content and small alignment differences still contribute.

The screenshot harness omits only the fixed **Static preview only** notice from comparison captures.
That notice stays visible in the delivered preview. The preview uses explicitly labelled sample
content to reproduce the reference. Full application screenshots with live published content will
vary with that content. No comparison is claimed for an actual Cloudflare-hosted deployment.

## Functional preservation and checks

- 44 backend/database tests passed.
- 13 public browser scenarios passed: account lifecycle, persistence, authoritative checkout,
  verified Paystack test payment, private downloads, registration, community discussion, inquiries,
  newsletter opt-in/unsubscribe, search and error handling.
- 8 admin/browser scenarios passed, including genuine TOTP flow, permissions, CRUD, settings,
  responsive dialogs and automated checks with no serious/critical accessibility violations.
- Actual Cloudflare workerd check passed with compiled source Functions, SSR/catalog, cookies,
  admin MFA/RBAC, Paystack test verification, registration and protected asset boundaries.
- Static preview check passed: explicit 503 for mutations and zero backend network requests.
- Public-asset allowlists and both Pages deployment structures validated.
- All 14 existing files under backend/, functions/, supabase/ and admin/ are byte-identical to the
  previously published project. No credentials, server logic or migrations were replaced.

The public browser test now explicitly selects **List** before checking the session list, because
the reconstructed interface initially opens the reference's **Calendar** view. Registration and
both view modes are still exercised. A formatting pass briefly broke the exact SSR slot markers;
the markers were restored and the actual workerd SSR check was rerun successfully.

Tests use isolated PostgreSQL/PGlite and explicit provider doubles. Live Supabase, Paystack, email
and Cloudflare credentials were not used. Legal policies and retention/backup approval remain the
previously agreed launch blockers.

## Details the reference cannot establish

- No tablet/mobile artboards or source typography specifications were supplied. Responsive layouts
  preserve the visual hierarchy using stacked sections, horizontal product scrolling and a menu.
  Available self-hosted DM Sans is retained; exact font outlines and rasterization are not certified.
- Original icon vectors are unavailable; matching SVG icons are reconstructed. The grey community,
  collaboration and daily-session blocks and sponsor-logo squares remain intentional placeholders.
- The reference's homepage book price is ₦18,000 while its store feature shows ₦2,000; generic cards
  show ₦15,000. These are preview-only examples, not purchasable prices. Full checkout always uses
  the authoritative published catalog and server verification.
- The reference calendar has duplicated/mistyped dates. The implemented calendar uses correct dates
  and real published sessions, rather than reproducing invalid date logic.
- The reference lacks account/cart controls and newsletter consent. A compact account/cart menu
  and required consent remain available to preserve the existing features. Dot hit areas and badge
  contrast were adjusted to retain accessibility. Search and story filtering remain usable.
- Social destinations were not supplied. Placeholder social controls open the contact inquiry;
  approved social URLs can still be supplied through the existing admin settings.
- Sample counts, generic daily-session text, product cards and the promotional offer belong to the
  supplied design. The static preview does not enable checkout, authentication, registration, admin
  writes, membership grants or email delivery. Full application data comes from configured services.

## Reproduce locally

The existing Node installation and startup workflow are unchanged. No new dependency is required.

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run build
npm.cmd run build:static
npm.cmd run validate:deployment
npm.cmd run build:functions
npm.cmd run dev
```

For the optional automated screenshot check, use a Chromium installation and set `CHROMIUM_PATH`
to its executable, then run `npm.cmd run test:reference`. Other checks are `npm.cmd test`,
`npm.cmd run test:browser`, `npm.cmd run test:admin`, `npm.cmd run test:static` and
`npm.cmd run test:cloudflare`. Full Wrangler setup and provider configuration are documented in
the Windows guide. The PowerShell commands are provided for Windows; execution was verified on Linux.
