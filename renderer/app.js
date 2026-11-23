'use strict';
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
const toast = (m) => { const t = h('div', { class: 'toast', text: m }); document.body.append(t); setTimeout(() => t.remove(), 3500); };
const mb = (n) => n ? (n / 1e6).toFixed(0) + ' MB' : '';

let state = { apps: [], online: true, loading: true };
let filter = 'all';
const progress = {}; // id -> {phase,pct}
const FILTERS = [['all', 'All apps'], ['installed', 'Installed'], ['updates', 'Updates'], ['Documents', 'Documents'], ['Media', 'Media']];

const app = $('#app');
const toolbar = h('div', { class: 'toolbar' });
const side = h('div', { class: 'sidebar', style: 'width:190px' });
const list = h('div', { style: 'flex:1;min-width:0;overflow:auto;padding:6px 18px 18px' });
const main = h('div', { class: 'main', style: 'flex:1;min-height:0;min-width:0;width:100%;overflow:hidden;display:flex' }, side, list);
const status = h('div', { class: 'status' });
app.append(toolbar, main, status);

async function refresh(force) {
  state.loading = true; render();
  try { const r = await window.host.list(force); state = { ...r, loading: false }; }
  catch (e) { state.loading = false; toast('Could not read app status'); }
  render();
}
let q = '';
const search = h('input', { type: 'search', placeholder: 'Search apps', 'aria-label': 'Search apps', oninput: (e) => { q = e.target.value.trim().toLowerCase(); renderList(); } });
const matches = (a) => !q || (a.name + ' ' + (a.group || '')).toLowerCase().includes(q);
const visible = () => state.apps.filter(matches).filter((a) => filter === 'all' || (filter === 'installed' && a.installed) || (filter === 'updates' && a.update) || a.group === filter);

async function act(kind, a) {
  try { await window.host[kind](a.id); if (kind === 'open') return; toast(kind === 'install' ? (a.installed ? a.name + ' updated' : a.name + ' installed') : a.name + ' removed'); }
  catch (e) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '').slice(0, 140)); }
  await refresh(false);
}
async function updateAll() { for (const a of state.apps.filter((x) => x.update && !x.busy)) await act('install', a); }

function row(a) {
  const p = progress[a.id]; const working = p && p.pct >= 0;
  const right = h('div', { style: 'display:flex;gap:8px;align-items:center;flex:none' });
  if (working) right.append(h('div', { style: 'width:170px' }, h('div', { class: 'muted', style: 'font-size:12px;margin-bottom:4px', text: p.phase + (p.phase === 'Downloading' ? ' ' + p.pct + '%' : '...') }), h('div', { class: 'progress' }, h('div', { style: 'width:' + (p.phase === 'Downloading' ? p.pct : 100) + '%' }))));
  else if (a.installed) {
    right.append(...[a.update ? h('button', { class: 'btn primary', onclick: () => act('install', a), text: 'Update' }) : null, h('button', { class: a.update ? 'btn' : 'btn primary', onclick: () => act('open', a), text: 'Open' }),
      h('button', { class: 'btn', title: 'Remove ' + a.name, onclick: () => { if (confirm('Remove ' + a.name + ' from this computer? Your own files are not deleted.')) act('uninstall', a); }, text: 'Remove' })].filter(Boolean));
  } else right.append(h('button', { class: 'btn primary', disabled: !a.available || !state.online, title: a.available ? '' : 'Not available offline', onclick: () => act('install', a), text: 'Install' + (a.size ? ' · ' + mb(a.size) : '') }));
  const bt = a.beta ? ' (beta)' : '';
  const ver = a.installed ? 'Version ' + (a.version || '?') + (a.update ? ' · ' + a.latest + bt + ' available' : ' · up to date') : (a.latest ? 'Version ' + a.latest + bt : 'Not installed');
  return h('div', { class: 'app-row' },
    h('img', { src: 'icons/' + a.id + '.png', width: 48, height: 48, alt: '' }),
    h('div', { style: 'flex:1;min-width:0' }, h('div', { style: 'font-size:15px;font-weight:600', text: a.name }), h('div', { class: 'muted', style: 'font-size:12px', text: a.what }), h('div', { class: 'muted', style: 'font-size:12px;margin-top:2px', text: ver })),
    right,
    h('button', { class: 'btn', title: 'View on GitHub', onclick: () => window.host.repo(a.id), text: 'Info' }));
}
function render() {
  toolbar.textContent = '';
  const upd = state.apps.filter((a) => a.update).length;
  toolbar.append(...[h('img', { src: 'icons/lookout.png', width: 24, height: 24, alt: '' }), h('strong', { text: 'Lookout', style: 'margin-left:8px' }), h('span', { class: 'grow' }), search,
    upd ? h('button', { class: 'btn primary', onclick: updateAll, text: 'Update all (' + upd + ')' }) : null, h('button', { class: 'btn', onclick: () => refresh(true), disabled: state.loading, text: state.loading ? 'Checking...' : 'Check for updates' })].filter(Boolean));
  side.textContent = ''; side.append(h('h3', { text: 'Library' }));
  for (const [k, t] of FILTERS) {
    const n = k === 'installed' ? state.apps.filter((a) => a.installed).length : k === 'updates' ? upd : null;
    side.append(h('div', { class: 'nav' + (filter === k ? ' on' : ''), role: 'button', tabindex: 0, 'aria-pressed': String(filter === k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filter = k; render(); } }, onclick: () => { filter = k; render(); } }, h('span', { text: t }), ...(n != null ? [h('span', { class: 'muted', text: String(n) })] : [])));
  }
  renderList();
  status.textContent = ''; const ni = state.apps.filter((a) => a.installed).length;
  status.append(h('span', { text: ni + ' of ' + state.apps.length + ' installed' }), h('span', { class: 'grow' }), h('span', { text: 'Contacts only GitHub, only to look up and download releases' }));
}
function renderList() {
  list.textContent = '';
  if (!state.online && !state.loading) list.append(h('div', { class: 'notice', text: 'Cannot reach GitHub. Installed apps still open. Connect to the internet to install or update.' }));
  const v = visible();
  if (!v.length && !state.loading) list.append(h('div', { class: 'muted', style: 'padding:30px 4px', text: q ? 'No apps match "' + q + '".' : filter === 'updates' ? 'Everything is up to date.' : 'Nothing here yet.' }));
  for (const a of v) list.append(row(a));
}
window.host.onProgress((p) => { if (p.pct < 0) delete progress[p.id]; else progress[p.id] = p; render(); });
refresh(false);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.focus(); search.select(); }
  else if (e.key === 'Escape' && document.activeElement === search) { search.value = ''; q = ''; renderList(); search.blur(); }
});
