# Wafex — Website Redesign

A modern redesign of wafex.com: Australia's leading family-owned flower company,
founded by Craig Musson in 1991. Static frontend served by Express — zero-config
deployable on Railway.

## Design system — "Botanical Atlas"

- **Palette:** eucalypt pine greens on cool mist paper, waxflower magenta accent,
  banksia gold highlights (CSS custom properties in `public/css/style.css`)
- **Type:** Fraunces (display serif) · Instrument Sans (body) · Spline Sans Mono (data labels)
- **Signature:** hand-drawn SVG botanical line art of Wafex's actual crops
  (waxflower, king protea, kangaroo paw, banksia) in `public/img/flowers.svg`
- Fully responsive, keyboard-accessible, `prefers-reduced-motion` respected

## Pages

| Route       | File                      | Contents |
|-------------|---------------------------|----------|
| `/`         | `public/index.html`       | Hero, stats, signature flowers, family teaser, global regions, pillars |
| `/story`    | `public/story.html`       | Craig Musson & the Musson family story, timeline 1991→today, values |
| `/flowers`  | `public/flowers.html`     | Range catalogue, Helix™ & Ayoba™ programs, interactive bloom calendar |
| `/contact`  | `public/contact.html`     | Regional desks, offices, validated enquiry form, supplier section |

## Run locally

```bash
npm install
npm start          # http://localhost:3000
```

## Deploy on Railway

1. Push this folder to a GitHub repository.
2. In Railway: **New Project → Deploy from GitHub repo** and select it.
3. Railway (Nixpacks) auto-detects Node, runs `npm install` and `npm start`.
   The server binds to `0.0.0.0` and reads `process.env.PORT` — no variables needed.
4. Add a domain under **Settings → Networking → Generate Domain**.

Alternatively, with the Railway CLI: `railway init && railway up`.

## Notes

- The enquiry form is wired client-side (validation + success state). To send real
  email, point the submit handler in `public/js/main.js` at your endpoint or a
  service like Formspree/Resend.
- Bloom calendar data is indicative and easy to edit in `public/js/main.js` (the `rows` array).
