'use strict';
const TZ = 'America/Vancouver';
const $ = (s) => document.querySelector(s);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['S','M','T','W','T','F','S'];
const LABEL = { D: 'Day', N: 'Night', V: 'Vacation' };
const HOURS = { D: '6:00 am – 6:00 pm', N: '6:00 pm – 6:00 am (ends next morning)', V: 'Time off' };
const PRESET_TAGS = ['No Aleta', 'OT', 'R-Day'];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let days = {};                      // 'YYYY-MM-DD' -> D|N|V
let tags = store.get('tags', {});   // 'YYYY-MM-DD' -> [tag]
let custom = store.get('customTags', []);
let view = 'month', cur = todayParts();  // {y, m}
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
function todayParts() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-').map(Number);
  return { y: p[0], m: p[1] - 1, d: p[2] };
}
const todayISO = () => { const t = todayParts(); return iso(t.y, t.m, t.d); };

/* ---------- crypto (matches tools/crypto.mjs) ---------- */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (u) => btoa(String.fromCharCode(...u));
async function deriveRaw(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, 256));
}
async function decrypt(blob, rawKey) {
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function loadBlob() {
  try { const r = await fetch('data/schedule.enc.json', { cache: 'no-cache' }); if (r.ok) { const j = await r.json(); store.set('blob', j); return j; } } catch {}
  return store.get('blob', null);
}
async function openWith(pass) {
  const blob = await loadBlob(); if (!blob) throw new Error('No schedule data found yet.');
  const raw = await deriveRaw(pass, b64(blob.salt), blob.iter);
  return decrypt(blob, raw);                       // throws on wrong passcode
}
async function unlock(pass) { const d = await openWith(pass); store.set('pass', pass); return d; }
async function tryStoredKey() {
  const p = store.get('pass', null); if (!p) return false;
  try { days = (await openWith(p)).days; return true; } catch { return false; }
}

/* ---------- rendering ---------- */
function monthCells(y, m) {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const start = new Date(Date.UTC(y, m, 1 - first));
  const rows = Math.ceil((first + dim) / 7);
  const out = [];
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(start.getTime() + i * 864e5);
    out.push({ y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), in: d.getUTCMonth() === m });
  }
  return { cells: out, rows };
}
function monthHTML(y, m, withTags) {
  const { cells, rows } = monthCells(y, m);
  const t = todayISO();
  let h = `<div class="month"><div class="dow">${DOW.map((x) => `<span>${x}</span>`).join('')}</div><div class="grid" style="grid-template-rows:repeat(${rows},1fr)">`;
  cells.forEach((c, i) => {
    const k = iso(c.y, c.m, c.d), s = days[k] || '', tg = withTags ? (tags[k] || []) : [];
    const at = (j) => cells[j] && cells[j].in;
    const col = i % 7, e = [];
    if (c.in) {
      if (!at(i - 7)) e.push('inset 0 2.5px 0 #14213D');
      if (!at(i + 7)) e.push('inset 0 -2.5px 0 #14213D');
      if (col === 0 || !at(i - 1)) e.push('inset 2.5px 0 0 #14213D');
      if (col === 6 || !at(i + 1)) e.push('inset -2.5px 0 0 #14213D');
    }
    h += `<div class="cell ${s} ${c.in ? '' : 'out'} ${k === t ? 'today' : ''}" data-d="${k}" style="${e.length ? 'box-shadow:' + e.join(',') : ''}">` +
      `<div class="top"><span class="n">${c.d}</span>${s ? `<span class="lab">${LABEL[s]}</span>` : ''}</div>` +
      (tg.length ? `<div class="tg">${tg.join(' · ')}</div>` : '') + '</div>';
  });
  return h + '</div></div>';
}
function yearHTML(y, withTags) {
  const t = todayISO();
  let h = '<div class="year">';
  for (let m = 0; m < 12; m++) {
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cur_ = todayParts();
    h += `<div class="mm ${cur_.y === y && cur_.m === m ? 'cur' : ''}" data-m="${m}"><h3>${MONTHS[m].slice(0, 3)}</h3><div class="mg">`;
    for (let i = 0; i < first; i++) h += '<b class="e"></b>';
    for (let d = 1; d <= dim; d++) {
      const k = iso(y, m, d);
      h += `<b class="${days[k] || ''} ${k === t ? 't' : ''} ${withTags && (tags[k] || []).length ? 'tg' : ''}">${d}</b>`;
    }
    h += '</div></div>';
  }
  return h + '</div>';
}
function legendHTML() {
  return `<span class="lg"><i style="background:var(--day)"></i>Day</span><span class="lg"><i style="background:var(--night)"></i>Night</span><span class="lg"><i style="background:var(--vac)"></i>Vacation</span><span class="lg"><i style="background:var(--free);outline:1px solid var(--line)"></i>Off</span>`;
}
let dir = 0;
function render() {
  $('#title').textContent = view === 'month' ? `${MONTHS[cur.m]} ${cur.y}` : String(cur.y);
  $('#vMonth').classList.toggle('on', view === 'month'); $('#vYear').classList.toggle('on', view === 'year');
  const el = $('#view');
  el.innerHTML = view === 'month' ? monthHTML(cur.y, cur.m, true) : yearHTML(cur.y, true);
  if (dir) el.animate([{ transform: `translateX(${dir * 36}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  else el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180 });
  dir = 0;
  $('#legend').innerHTML = legendHTML();
}
function step(n) {
  dir = n;
  if (view === 'month') { let m = cur.m + n, y = cur.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } cur = { y, m }; }
  else cur = { y: cur.y + n, m: cur.m };
  render();
}
function goToday() { const t = todayParts(); dir = (t.y * 12 + t.m) > (cur.y * 12 + cur.m) ? 1 : -1; if (t.y === cur.y && t.m === cur.m) dir = 0; cur = { y: t.y, m: t.m }; render(); }

/* ---------- sheets ---------- */
function openSheet(k, mode) {
  const [y, mo, d] = k.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const pretty = dt.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const s = days[k], my = tags[k] || [];
  const all = [...PRESET_TAGS, ...custom.filter((c) => !PRESET_TAGS.includes(c))];
  $('#sheet').innerHTML = `<h2>${pretty}</h2><span class="chip ${s || 'F'}">${s ? LABEL[s] : 'Day off'}</span>` +
    `<div class="hours">${s ? HOURS[s] : 'No shift'}</div>` +
    `<div class="sec">Personal tags</div><div class="tags">${all.map((t) => `<button class="tagbtn ${my.includes(t) ? 'on' : ''}" data-t="${t.replace(/"/g, '&quot;')}">${t}</button>`).join('')}</div>` +
    `<form class="addtag"><input placeholder="New tag…" maxlength="18"><button class="pill">Add</button></form>`;
  $('#sheet').dataset.k = k;
  $('#sheet').hidden = $('#sheetBack').hidden = false;
}
function closeSheet() { $('#sheet').hidden = $('#sheetBack').hidden = true; }
function toggleTag(k, t) {
  const a = tags[k] || []; const i = a.indexOf(t);
  if (i >= 0) a.splice(i, 1); else a.push(t);
  if (a.length) tags[k] = a; else delete tags[k];
  store.set('tags', tags);
}
$('#sheet').addEventListener('click', (e) => {
  const b = e.target.closest('.tagbtn'); if (!b) return;
  const k = $('#sheet').dataset.k; toggleTag(k, b.dataset.t); b.classList.toggle('on'); render();
});
$('#sheet').addEventListener('submit', (e) => {
  e.preventDefault(); const inp = e.target.querySelector('input'); const t = inp.value.trim(); if (!t) return;
  const k = $('#sheet').dataset.k;
  if (!PRESET_TAGS.includes(t) && !custom.includes(t)) { custom.push(t); store.set('customTags', custom); }
  if (!(tags[k] || []).includes(t)) toggleTag(k, t);
  openSheet(k); render();
});
$('#sheetBack').addEventListener('click', closeSheet);

/* ---------- gestures ---------- */
let pressTimer = null, sx = 0, sy = 0, moved = false, longFired = false;
const stage = $('#stage');
stage.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; longFired = false;
  const c = e.target.closest('.cell');
  if (c && view === 'month') pressTimer = setTimeout(() => { longFired = true; navigator.vibrate && navigator.vibrate(15); openSheet(c.dataset.d); }, 480);
}, { passive: true });
stage.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) { moved = true; clearTimeout(pressTimer); } }, { passive: true });
stage.addEventListener('touchend', (e) => {
  clearTimeout(pressTimer);
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  if (moved && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { step(dx < 0 ? 1 : -1); e.preventDefault(); }
}, { passive: false });
stage.addEventListener('click', (e) => {
  if (longFired) { longFired = false; return; }
  const c = e.target.closest('.cell'); if (c) return openSheet(c.dataset.d);
  const m = e.target.closest('.mm'); if (m) { cur = { y: cur.y, m: +m.dataset.m }; view = 'month'; dir = 1; render(); }
});
stage.addEventListener('contextmenu', (e) => { if (e.target.closest('.cell')) e.preventDefault(); });
// desktop long-press / long-click via mouse
stage.addEventListener('mousedown', (e) => { const c = e.target.closest('.cell'); if (c && view === 'month' && e.button === 0) pressTimer = setTimeout(() => { longFired = true; openSheet(c.dataset.d); }, 520); });
['mouseup', 'mouseleave'].forEach((n) => stage.addEventListener(n, () => clearTimeout(pressTimer)));
document.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); if (e.key === 'Escape') closeSheet(); });

$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1); $('#today').onclick = goToday;
$('#vMonth').onclick = () => { view = 'month'; render(); }; $('#vYear').onclick = () => { view = 'year'; render(); };

/* ---------- share mode ---------- */
let shareView = 'month';
function renderShare() {
  const wt = $('#shareTags').checked;
  const title = shareView === 'month' ? `Richard's Schedule, ${MONTHS[cur.m]}${cur.y !== todayParts().y ? ' ' + cur.y : ''}` : `Richard's Schedule, ${cur.y}`;
  $('#shareCanvas').innerHTML = `<h1>${title}</h1>` + (shareView === 'month' ? monthHTML(cur.y, cur.m, wt) : yearHTML(cur.y, wt)) + `<div class="lgrow">${legendHTML()}</div>`;
  $('#sMonth').classList.toggle('on', shareView === 'month'); $('#sYear').classList.toggle('on', shareView === 'year');
}
$('#share').onclick = () => { shareView = view; $('#shareView').hidden = false; $('#shareView').classList.remove('clean'); renderShare(); };
$('#shareTags').onchange = renderShare;
$('#sMonth').onclick = () => { shareView = 'month'; renderShare(); }; $('#sYear').onclick = () => { shareView = 'year'; renderShare(); };
$('#shareHide').onclick = () => { $('#shareView').classList.add('clean'); $('#shareShow').hidden = false; };
$('#shareShow').onclick = () => { $('#shareView').classList.remove('clean'); $('#shareShow').hidden = true; };
$('#shareClose').onclick = () => { $('#shareView').hidden = true; };

/* ---------- boot ---------- */
function start() { $('#lock').hidden = true; $('#app').hidden = false; render(); }
$('#lockForm').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#lockMsg').textContent = '';
  try { days = (await unlock($('#pass').value)).days; start(); }
  catch (err) { $('#lockMsg').textContent = err.message.includes('No schedule') ? err.message : 'That passcode didn’t work.'; }
});
(async () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (await tryStoredKey()) start();
})();
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#app').hidden) { tryStoredKey().then((ok) => ok && render()); } });
