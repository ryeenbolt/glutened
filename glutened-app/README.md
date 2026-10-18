# glutened. — iOS App Store project

A standalone, Capacitor-ready version of the **glutened.** gluten-free food & drink
finder — code Ryan owns outright. Same name, same look, same data as the prototype:
opens on Maumelle, AR, works for any US city search, carries the 32-chain verified
dataset (official allergen guides, Oct 2026) and the GF beer/cider data.

No Mac is needed anywhere in this flow: iOS builds happen on Codemagic's cloud Macs.

## What is in this folder

- `www/` — the web app (open `www/index.html` in a browser to try it).
  - `www/data/places.json` — 15 real Maumelle/Little Rock-area listings.
  - `www/data/chains.json` — 32 chains from official allergen guides (unverified items flagged).
  - `www/data/drinks.json` — truly-GF beer, gluten-removed beer, ciders, discontinued brands.
- `capacitor.config.json` — app id `com.glutened.app`, name `glutened`.
- `package.json` — Capacitor dependencies.
- `codemagic.yaml` — the cloud build recipe (iOS release, TestFlight-ready when you flip the switch).
- This README.

## Ryan's checklist (in order — do nothing until the step before is done)

1. **GitHub account (free).** Create a repo named `glutened-app` and push this folder to it.
2. **Codemagic account (free tier to start).** Add the repo, pick the `ios-workflow` in
   `codemagic.yaml`. The first push builds automatically and proves the pipeline works —
   but it will stop at code signing until step 3.
3. **Connect Apple in Codemagic.** Codemagic → Teams → Integrations → connect
   "Apple Developer Portal" (or add an App Store Connect API key). This is where
   signing certificates get created — nothing is stored in this folder.
4. **Apple Developer Program — $99/year.** Enroll with your Apple ID, your name.
   Wait to do this until you're close to submitting; it starts billing yearly.
5. **Submit.** In Codemagic, flip `submit_to_testflight: true` for a beta, or publish
   the .ipa artifact to App Store Connect and submit for review (you'll add
   screenshots, the description, and the privacy policy in App Store Connect —
   I can draft all of that).

## What is NOT done yet

- **Apple enrollment / code signing** — only Ryan can do this (legal agreements, payment).
- **A shared backend** — saved places and safety reports currently use the phone's
  local storage (fine for v0.1; a shared backend like Supabase comes later).
- **Google Places key** — nationwide live listings plug in under your own billing later.
- **Formal trademark clearance** — a web search found no app or USPTO mark named
  "Glutened", but a real launch should run an official USPTO search first.
- **Domain** — grab glutened.com (or .app) when you're committed to the name.

## Rebuild notes

- `npm install && npx cap sync ios` regenerates the iOS project from `www/`.
- Data refreshes: edit the JSON files under `www/data/`; the app re-reads them on launch.
- The allergen dataset recommends quarterly re-verification — chains re-date their guides.
