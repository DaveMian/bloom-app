# Bloom

A private, responsive routine and goals app based on the supplied build brief.

## Run locally

Requires Node.js 20.9 or newer and pnpm. In this folder:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Run `pnpm build` to create a static site in `out/`.

## Cloudflare deployment

Live site: https://bloom-routine-app.pages.dev

The static `out/` build is deployed to the Cloudflare Pages project `bloom-routine-app`. After future changes, rebuild and deploy `out/` to that project. The site URL is public; the app has no account or access gate. Personal entries remain in the visitor's own browser storage.

## Data and delivery

Bloom stores data in this browser's `localStorage`. Export JSON backups regularly from Settings. Importing a backup replaces existing local data. The desktop and iPhone will have separate data unless you manually export and import.

To use on an iPhone, open the live HTTPS URL in Safari and test the interface on the device. Home Screen installation and offline use have not been verified. There is no account, cloud sync, automatic phone usage tracking, notification, or partner view.

The sample makeup and project management lessons are placeholders; replace them with the real syllabus. The default timezone is `Asia/Dubai`. The driving goal is tailored to Abu Dhabi's TAMM licensing flow, but the 31 December 2026 date is a planning target. Confirm whether she needs a new licence or qualifies to exchange an existing one, then check required documents and appointment availability in TAMM.
