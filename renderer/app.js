'use strict';
// Lookout launcher renderer: Google-style dark home (top app bar, nav drawer, app cards).
// Talks to the main process only through window.host (list/install/uninstall/open/repo/info/onProgress).
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const NS = 'http://www.w3.org/2000/svg';
// Material Symbols (Outlined) style icons, fill-based, 24px grid. Path data in the style of Google's Material icons (Apache-2.0).
const ICONS = {
  apps: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
  installed: 'M16.59 7.58L10 14.17l-3.59-3.58L5 12l5 5 8-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  update: 'M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z',
  docs: 'M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
  media: 'M4 6.47L5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  open: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  del: 'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  offline: 'M24 15c0-2.64-2.05-4.78-4.65-4.96C18.67 6.59 15.64 4 12 4c-1.33 0-2.57.36-3.65.97l1.49 1.49C10.51 6.17 11.23 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 .99-.48 1.85-1.21 2.4l1.41 1.41c1.09-.92 1.8-2.27 1.8-3.81zM4.41 3.86L3 5.27l2.77 2.77h-.42C2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h11.73l2 2 1.41-1.41L4.41 3.86zM6 18c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73l8 8H6z',
  download: 'M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2zm-1-4l-1.41-1.41L13 12.17V4h-2v8.17L8.41 9.59 7 11l5 5 5-5z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm7 10c0 4.52-2.98 8.69-7 9.93-4.02-1.24-7-5.41-7-9.93V6.3l7-3.11 7 3.11V11z',
};
const icon = (name, size = 20) => {
  const s = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', 'aria-hidden': 'true', class: 'ms' })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONS[name]); s.append(p); return s;
};
// circular icon button; the visible-hidden label keeps the button's text (and its accessible name) in plain English
const ib = (name, label, onclick, extra = {}) => h('button', { type: 'button', class: 'ib', title: extra.title || label, 'aria-label': extra.title || label, onclick, ...extra.attrs }, icon(name), h('span', { class: 'vh', text: label }));
const pill = (cls, iconName, text, onclick, attrs = {}) => h('button', { type: 'button', class: 'pill ' + cls, onclick, ...attrs }, iconName ? icon(iconName, 18) : null, h('span', { text }));

const toast = (m) => {
  const box = $('.snacks') || document.body.appendChild(h('div', { class: 'snacks', role: 'status', 'aria-live': 'polite' }));
  const t = h('div', { class: 'toast', text: m }); box.append(t); setTimeout(() => t.remove(), 3500);
};
const mb = (n) => n ? (n / 1e6).toFixed(0) + ' MB' : '';

let state = { apps: [], online: true, loading: true };
let filter = 'all';
const progress = {}; // id -> {phase,pct}
// Nav filters. Groups come from the CATALOG in main.js, which only has Documents and Media.
const FILTERS = [['all', 'All apps', 'apps'], ['installed', 'Installed', 'installed'], ['updates', 'Updates', 'update'], ['Documents', 'Documents', 'docs'], ['Media', 'Media', 'media']];
const HEADS = { all: 'Library', installed: 'Installed on this computer', updates: 'Updates available', Documents: 'Document apps', Media: 'Media apps' };

// ---------- layout (built once; render() only updates it) ----------
const app = $('#app');
let q = '';
const search = h('input', { type: 'search', placeholder: 'Search apps', 'aria-label': 'Search apps', spellcheck: 'false', oninput: (e) => { q = e.target.value.trim().toLowerCase(); syncSearch(); renderList(); } });
const clearBtn = ib('close', 'Clear search', () => { search.value = ''; q = ''; syncSearch(); renderList(); search.focus(); });
const searchBox = h('div', { class: 'searchbox', onclick: (e) => { if (e.target === searchBox) search.focus(); } }, icon('search'), search, clearBtn);
function syncSearch() { clearBtn.hidden = !search.value; }
const updAllBtn = pill('primary', 'update', 'Update all', () => updateAll(), { 'aria-label': 'Update all' });
const refreshBtn = ib('refresh', 'Check for updates', () => refresh(true));
const topbar = h('header', { class: 'topbar' },
  h('div', { class: 'brand-g' }, h('img', { src: 'icons/lookout.png', width: 32, height: 32, alt: '' }), h('span', { text: 'Lookout' })),
  searchBox, h('span', { class: 'grow' }), updAllBtn, refreshBtn);

const navBtns = {};
const navCount = {};
const navList = (keys) => h('div', { class: 'navlist' }, keys.map((k) => {
  const [, label, ic] = FILTERS.find((f) => f[0] === k);
  navCount[k] = h('span', { class: 'cnt' });
  navBtns[k] = h('button', { type: 'button', class: 'nv', title: label, 'aria-label': label, 'data-filter': k, onclick: () => setFilter(k) }, h('span', { class: 'nic' }, icon(ic)), h('span', { class: 'nlabel', text: label }), navCount[k]);
  return navBtns[k];
}));
const verLine = h('div', { class: 'drawer-foot' });
const drawer = h('nav', { class: 'drawer', 'aria-label': 'Library' },
  h('div', { class: 'dsec', text: 'Library' }), navList(['all', 'installed', 'updates']),
  h('div', { class: 'dsec', text: 'Categories' }), navList(['Documents', 'Media']),
  h('span', { class: 'grow' }), verLine);
const heading = h('h2', { class: 'sechd' });
const noticeBox = h('div');
const grid = h('div', { class: 'cards', role: 'list' });
const content = h('main', { class: 'content' }, h('div', { class: 'inner' },
  h('div', { class: 'hero' }, h('h1', { text: 'Welcome to Lookout' }), h('p', { class: 'lead', text: 'Install, update and open the Lookout apps. Every app runs on this computer.' })),
  noticeBox, heading, grid));
const footer = h('footer', { class: 'foot' });
app.append(topbar, h('div', { class: 'body' }, drawer, content), footer);
syncSearch();
try { window.host.info().then((i) => { if (i && i.version) verLine.textContent = i.name + ' ' + i.version; }).catch(() => {}); } catch (_) { /* optional */ }

function setFilter(k) { filter = k; render(); }

async function refresh(force) {
  state.loading = true; render();
  try { const r = await window.host.list(force); state = { ...r, loading: false }; }
  catch (e) { state.loading = false; toast('Could not read app status'); }
  render();
}
const matches = (a) => !q || (a.name + ' ' + (a.group || '') + ' ' + (a.what || '')).toLowerCase().includes(q);
const visible = () => state.apps.filter(matches).filter((a) => filter === 'all' || (filter === 'installed' && a.installed) || (filter === 'updates' && a.update) || a.group === filter);

async function act(kind, a) {
  try { await window.host[kind](a.id); if (kind === 'open') return; toast(kind === 'install' ? (a.installed ? a.name + ' updated' : a.name + ' installed') : a.name + ' removed'); }
  catch (e) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '').slice(0, 140)); }
  await refresh(false);
}
async function updateAll() { for (const a of state.apps.filter((x) => x.update && !x.busy)) await act('install', a); }

// ---------- M3 dialog: Esc or Cancel closes, focus returns to the button that opened it ----------
function confirmDialog({ title, body, ok, opener }) {
  return new Promise((resolve) => {
    const prev = opener || document.activeElement;
    const close = (v) => {
      back.remove(); window.removeEventListener('keydown', onKey, true);
      let f = prev && prev.isConnected ? prev : null;
      if (!f && prev && prev.dataset && prev.dataset.act) f = document.querySelector('[data-act="' + prev.dataset.act + '"][data-id="' + prev.dataset.id + '"]');
      if (f) f.focus();
      resolve(v);
    };
    const cancel = h('button', { type: 'button', class: 'pill text', onclick: () => close(false) }, h('span', { text: 'Cancel' }));
    const yes = h('button', { type: 'button', class: 'pill primary', onclick: () => close(true) }, h('span', { text: ok }));
    const dlg = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t', 'aria-describedby': 'dlg-b' },
      h('h2', { id: 'dlg-t', text: title }), h('p', { id: 'dlg-b', text: body }), h('div', { class: 'dlg-acts' }, cancel, yes));
    const back = h('div', { class: 'scrim', onmousedown: (e) => { if (e.target === back) close(false); } }, dlg);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Tab') { const f = [cancel, yes], i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    document.body.append(back); cancel.focus();
  });
}
async function askRemove(a, btn) {
  if (await confirmDialog({ title: 'Remove ' + a.name + '?', body: a.name + ' will be removed from this computer. Your own files are not deleted.', ok: 'Remove', opener: btn })) act('uninstall', a);
}

// ---------- cards ----------
function card(a) {
  const p = progress[a.id]; const working = p && p.pct >= 0;
  const bt = a.beta ? ' (beta)' : '';
  const ver = a.installed ? 'Version ' + (a.version || '?') + (a.update ? ' · ' + a.latest + bt + ' available' : ' · up to date') : (a.latest ? 'Version ' + a.latest + bt : 'Not installed');
  const chips = h('div', { class: 'chips' });
  if (a.update) chips.append(h('span', { class: 'chip tonal', text: 'Update available' }));
  else if (a.installed) chips.append(h('span', { class: 'chip ok' }, icon('installed', 16), h('span', { text: 'On this computer' })));
  if (a.beta) chips.append(h('span', { class: 'chip beta', text: 'Beta', title: 'The newest release is a beta (pre-release)' }));
  const acts = h('div', { class: 'acts' });
  if (working) {
    const det = p.phase === 'Downloading';
    acts.append(h('div', { class: 'prog' },
      h('div', { class: 'plabel', text: p.phase + (det ? ' ' + p.pct + '%' : '...') }),
      h('div', { class: 'progress lin' + (det ? '' : ' indet'), role: 'progressbar', 'aria-label': p.phase + ' ' + a.name, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': det ? p.pct : null }, h('div', { style: 'width:' + (det ? p.pct : 100) + '%' }))));
  } else if (a.installed) {
    acts.append(a.update ? pill('primary', 'update', 'Update', () => act('install', a)) : pill('primary', 'open', 'Open', () => act('open', a)), h('span', { class: 'grow' }));
    if (a.update) acts.append(ib('open', 'Open', () => act('open', a), { title: 'Open ' + a.name }));
    const rm = ib('del', 'Remove', () => askRemove(a, rm), { title: 'Remove ' + a.name, attrs: { 'data-act': 'uninstall', 'data-id': a.id } });
    acts.append(rm);
  } else {
    const can = a.available && state.online;
    acts.append(pill('primary', 'download', 'Install' + (a.size ? ' · ' + mb(a.size) : ''), () => act('install', a), { disabled: !can, title: can ? 'Install ' + a.name : 'Not available offline' }), h('span', { class: 'grow' }));
  }
  acts.append(ib('info', 'Info', () => window.host.repo(a.id), { title: 'View ' + a.name + ' on GitHub' }));
  return h('article', { class: 'card' + (working ? ' busy' : ''), role: 'listitem', 'aria-label': a.name, 'data-id': a.id },
    h('div', { class: 'ctop' }, h('img', { src: 'icons/' + a.id + '.png', width: 48, height: 48, alt: '' }),
      h('div', { class: 'cnames' }, h('h3', { class: 'cname', text: a.name }), h('div', { class: 'cwhat', text: a.what }))),
    h('div', { class: 'cver', text: ver }), chips, acts);
}
const skeleton = () => h('div', { class: 'card skel', 'aria-hidden': 'true' }, h('div', { class: 'ctop' }, h('i', { class: 'sk ico' }), h('div', { class: 'cnames' }, h('i', { class: 'sk l1' }), h('i', { class: 'sk l2' }))), h('i', { class: 'sk l3' }), h('i', { class: 'sk btn' }));

function render() {
  const upd = state.apps.filter((a) => a.update).length;
  const ni = state.apps.filter((a) => a.installed).length;
  updAllBtn.hidden = !upd; updAllBtn.querySelector('span').textContent = 'Update all (' + upd + ')'; updAllBtn.setAttribute('aria-label', 'Update all (' + upd + ')');
  refreshBtn.disabled = state.loading; refreshBtn.classList.toggle('spin', !!state.loading);
  refreshBtn.title = state.loading ? 'Checking...' : 'Check for updates'; refreshBtn.setAttribute('aria-label', refreshBtn.title);
  for (const [k] of FILTERS) {
    const on = filter === k, b = navBtns[k];
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    const n = k === 'installed' ? ni : k === 'updates' ? upd : null;
    navCount[k].textContent = n != null && (k !== 'updates' || n) ? String(n) : '';
    navCount[k].classList.toggle('badge', k === 'updates' && upd > 0);
  }
  renderList();
  footer.textContent = '';
  footer.append(h('span', { text: ni + ' of ' + state.apps.length + ' installed' }), h('span', { class: 'grow' }), icon('shield', 16), h('span', { text: 'Contacts only GitHub, only to look up and download releases' }));
}
function renderList() {
  noticeBox.textContent = ''; grid.textContent = '';
  heading.textContent = HEADS[filter] || 'Library';
  if (!state.online && !state.loading) noticeBox.append(h('div', { class: 'notice', role: 'status' }, icon('offline'), h('span', { text: 'Cannot reach GitHub. Installed apps still open. Connect to the internet to install or update.' })));
  if (state.loading && !state.apps.length) { for (let i = 0; i < 6; i++) grid.append(skeleton()); return; }
  const v = visible();
  if (!v.length && !state.loading) {
    const msg = q ? 'No apps match "' + q + '".' : filter === 'updates' ? 'Everything is up to date.' : 'Nothing here yet.';
    grid.append(h('div', { class: 'empty-g', role: 'status' }, icon(q ? 'search' : filter === 'updates' ? 'installed' : 'apps', 40), h('div', { class: 'etitle', text: msg }),
      q ? h('div', { class: 'esub', text: 'Try a different name, or press Esc to clear the search.' }) : null));
  }
  for (const a of v) grid.append(card(a));
}
window.host.onProgress((p) => { if (p.pct < 0) delete progress[p.id]; else progress[p.id] = p; render(); });
refresh(false);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); search.select(); }
  else if (e.key === 'Escape' && document.activeElement === search) { search.value = ''; q = ''; syncSearch(); renderList(); search.blur(); }
});
