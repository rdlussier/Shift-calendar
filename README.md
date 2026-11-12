# Shift Calendar

Private shift schedule viewer (static PWA for GitHub Pages). Month and Year views, offline, "Harbour Dusk" theme.

## Data and privacy
The page is public, so **only encrypted data is committed**: `data/schedule.enc.json` (PBKDF2-SHA256 200k iterations, AES-GCM). The passcode is entered once per device and stored only in that device's browser. Personal tags live only in the browser (`localStorage`), never in Google or this repo.

## Updating the data
A scheduled job reads the Google calendar "Richard - Work" (all-day Day Shift / Night Shift / Vacation) and runs:

    SHIFT_PASSCODE=... node tools/build-data.mjs < events.json > data/schedule.enc.json

`events.json` is `[{"summary":"☀️ Day Shift","start":"2027-01-01","end":"2027-01-02"}, ...]` (end exclusive). Never commit `events.json`.
`tools/rotation-events.mjs` can generate a fallback from the 8-day rotation.
Keep the passcode in a secret (never in the repo).

## Hosting
GitHub Pages, deploy from the main branch root.
