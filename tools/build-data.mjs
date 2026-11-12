#!/usr/bin/env node
// Usage: SHIFT_PASSCODE=... node tools/build-data.mjs < events.json > data/schedule.enc.json
// stdin: JSON array of all-day events from the "Richard - Work" calendar:
//   [{ "summary": "☀️ Day Shift", "start": "2027-01-01", "end": "2027-01-02" }, ...]   (end is exclusive, as in Google)
// Writes ONLY the encrypted file. Plaintext is never written to disk.
import { encrypt } from './crypto.mjs';
const pass = process.env.SHIFT_PASSCODE;
if (!pass) { console.error('SHIFT_PASSCODE not set'); process.exit(1); }
let raw = ''; for await (const ch of process.stdin) raw += ch;
const events = JSON.parse(raw);
const days = {};
const kind = (s) => { const t = s.replace(/^[^A-Za-z]+/, '').trim().toLowerCase(); return t === 'night shift' ? 'N' : t === 'day shift' ? 'D' : t === 'vacation' ? 'V' : null; };  // exact names only
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
for (const e of events) {
  const k = kind(e.summary || ''); if (!k) continue;
  for (let d = e.start; d < (e.end || addDays(e.start, 1)); d = addDays(d, 1)) {
    if (days[d] !== 'V') days[d] = k;   // vacation wins over a stray shift bar
  }
}
const n = Object.keys(days).length;
if (n < 30) { console.error('Refusing to write: only ' + n + ' days found'); process.exit(1); }
const out = await encrypt({ updated: new Date().toISOString(), days }, pass);
process.stdout.write(JSON.stringify(out));
console.error('Encrypted ' + n + ' days');
