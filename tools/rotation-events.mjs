#!/usr/bin/env node
// Fallback/seed: prints events.json from the 8-day rotation (day 1 = 2026-10-29) plus vacation blocks.
// Normal path is reading the Google calendar; this is only for bootstrapping/testing.
const VAC = [['2027-01-09','2027-01-12'],['2027-03-06','2027-03-09'],['2027-03-22','2027-03-25'],['2027-04-15','2027-04-18'],['2027-05-09','2027-05-12'],['2027-09-06','2027-09-09'],['2027-09-30','2027-10-03'],['2027-12-19','2027-12-22']];
const add = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ev = [];
for (let d = '2026-10-29'; d <= '2027-12-31'; d = add(d, 1)) {
  const i = Math.round((Date.parse(d) - Date.parse('2026-10-29')) / 864e5) % 8;
  const vac = VAC.some(([a, b]) => d >= a && d <= b);
  const s = vac ? '🌴 Vacation' : i < 2 ? '☀️ Day Shift' : i < 4 ? '🌙 Night Shift' : null;
  if (s) ev.push({ summary: s, start: d, end: add(d, 1) });
}
console.log(JSON.stringify(ev));
