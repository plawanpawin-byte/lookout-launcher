'use strict';
// Lookout launcher main process.
// The only network traffic this app makes: reading public release information from
// api.github.com and downloading release installers from github.com, on the user's request.
// The window itself has no network access and no file access.
const { app, BrowserWindow, ipcMain, session, Menu, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const OWNER = 'plawanpawin-byte';
const CATALOG = [
  { id: 'pdfout', name: 'PDFout', group: 'Documents', what: 'PDF reader, annotator and organiser' },
  { id: 'chartout', name: 'Chartout', group: 'Documents', what: 'Flowcharts and diagrams' },
  { id: 'branchout', name: 'Branchout', group: 'Documents', what: 'Mind maps and outlines' },
  { id: 'planout', name: 'Planout', group: 'Documents', what: 'Project plans and Gantt charts' },
  { id: 'frameout', name: 'Frameout', group: 'Documents', what: 'Screen design and prototypes' },
  { id: 'cutout', name: 'Cutout', group: 'Media', what: 'Video editor' },
  { id: 'shiftout', name: 'Shiftout', group: 'Media', what: 'Video and audio converter' },
  { id: 'castout', name: 'Castout', group: 'Media', what: 'Screen recorder' },
  { id: 'mendout', name: 'Mendout', group: 'Media', what: 'Repair and check media files' },
  { id: 'tuneout', name: 'Tuneout', group: 'Media', what: 'Audio editor' },
];
const byId = (id) => { const a = CATALOG.find((x) => x.id === String(id)); if (!a) throw new Error('Unknown app'); return a; };
const API_HOSTS = ['api.github.com'];
const DL_HOSTS = ['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'];
const okUrl = (u, hosts) => { try { const x = new URL(u); return x.protocol === 'https:' && hosts.includes(x.hostname); } catch (_) { return false; } };

let win = null;
const send = (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); };

// ---------- what is installed (Windows uninstall registry, current user) ----------
const UNINST = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
function regDump() {
  return new Promise((resolve) => {
    execFile('reg', ['query', UNINST, '/s'], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (err, out) => {
      if (err && !out) return resolve([]);
      const entries = []; let cur = null;
      for (const raw of String(out).split(/\r?\n/)) {
        if (/^HKEY_/i.test(raw)) { cur = { key: raw.trim() }; entries.push(cur); continue; }
        const m = /^\s+(\w+)\s+REG_\w+\s+(.*)$/.exec(raw); if (m && cur) cur[m[1]] = m[2].trim();
      }
      resolve(entries);
    });
  });
}
async function installedMap() {
  const out = {}; const entries = await regDump();
  for (const a of CATALOG) {
    const e = entries.find((x) => x.DisplayName && new RegExp('^' + a.name + '(\\s|$)', 'i').test(x.DisplayName) && (x.InstallLocation || x.UninstallString));
    if (!e) continue;
    const dir = (e.InstallLocation || '').replace(/^"|"$/g, '') || path.dirname(String(e.UninstallString || '').replace(/^"([^"]+)".*$/, '$1'));
    const exe = path.join(dir, a.name + '.exe');
    if (!fs.existsSync(exe)) continue;
    out[a.id] = { version: e.DisplayVersion || '', dir, exe, uninstall: e.UninstallString || '' };
  }
  return out;
}

// ---------- latest releases ----------
let cache = { t: 0, data: {} };
async function fetchJson(url) {
  if (!okUrl(url, API_HOSTS)) throw new Error('Blocked address');
  const r = await net.fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lookout-launcher' } });
  if (!r.ok) throw new Error('GitHub answered ' + r.status);
  return r.json();
}
async function latest(force) {
  if (!force && Date.now() - cache.t < 10 * 60 * 1000 && Object.keys(cache.data).length) return { data: cache.data, online: true };
  const data = {}; let ok = 0;
  await Promise.all(CATALOG.map(async (a) => {
    try {
      const j = await fetchJson(`https://api.github.com/repos/${OWNER}/${a.id}/releases/latest`);
      const asset = (j.assets || []).find((x) => /-Setup-.*\.exe$/i.test(x.name));
      if (asset) { data[a.id] = { version: String(j.tag_name || '').replace(/^v/, ''), url: asset.browser_download_url, size: asset.size, digest: asset.digest || '', name: asset.name }; ok++; }
    } catch (_) { /* leave missing */ }
  }));
  if (ok) { for (const k of Object.keys(cache.data)) if (!data[k]) data[k] = cache.data[k]; cache = { t: Date.now(), data }; }
  return { data: ok ? data : cache.data, online: ok > 0 };
}
const cmpVer = (a, b) => { const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number); for (let i = 0; i < 4; i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; };

async function listApps(force) {
  const [inst, lat] = await Promise.all([installedMap(), latest(force)]);
  return {
    online: lat.online,
    apps: CATALOG.map((a) => {
      const i = inst[a.id], l = lat.data[a.id];
      return { id: a.id, name: a.name, group: a.group, what: a.what, installed: !!i, version: i ? i.version : '', latest: l ? l.version : '', size: l ? l.size : 0, update: !!(i && l && i.version && cmpVer(l.version, i.version) > 0), available: !!l, busy: busy.has(a.id) };
    }),
  };
}

// ---------- install / update ----------
const busy = new Set();
async function download(a, l) {
  if (!okUrl(l.url, DL_HOSTS)) throw new Error('Blocked address');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookout-'));
  const file = path.join(dir, path.basename(l.name).replace(/[^\w.-]/g, '_'));
  const hash = crypto.createHash('sha256'); let got = 0;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    const req = net.request({ url: l.url, redirect: 'manual' });
    req.setHeader('User-Agent', 'Lookout-launcher');
    const fail = (e) => { try { req.abort(); } catch (_) {} out.destroy(); reject(e instanceof Error ? e : new Error(String(e))); };
    req.on('redirect', (_st, _m, url) => { if (okUrl(url, DL_HOSTS)) req.followRedirect(); else fail(new Error('Blocked redirect')); });
    req.on('error', fail);
    req.on('response', (res) => {
      if (res.statusCode !== 200) return fail(new Error('Download failed (' + res.statusCode + ')'));
      const total = l.size || +res.headers['content-length'] || 0;
      res.on('data', (chunk) => { hash.update(chunk); got += chunk.length; out.write(chunk); send('progress', { id: a.id, phase: 'Downloading', pct: total ? Math.min(99, Math.round((got / total) * 100)) : 0 }); });
      res.on('error', fail);
      res.on('end', () => out.end(() => resolve()));
    });
    req.end();
  });
  if (l.size && got !== l.size) throw new Error('The download is incomplete');
  const want = /^sha256:([0-9a-f]{64})$/i.exec(l.digest || '');
  if (want && hash.digest('hex').toLowerCase() !== want[1].toLowerCase()) throw new Error('The download did not match its checksum');
  return { file, dir };
}
function runWait(exe, args) { return new Promise((resolve) => { const c = spawn(exe, args, { windowsHide: true, stdio: 'ignore' }); c.on('error', () => resolve(-1)); c.on('close', (code) => resolve(code)); }); }
async function waitFor(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 700)); } return false; }

async function install(id) {
  const a = byId(id); if (busy.has(a.id)) throw new Error('Already working on this app');
  busy.add(a.id);
  try {
    send('progress', { id: a.id, phase: 'Looking up', pct: 0 });
    const lat = await latest(false); const l = lat.data[a.id]; if (!l) throw new Error('No release found. Check your internet connection.');
    const { file, dir } = await download(a, l);
    try {
      send('progress', { id: a.id, phase: 'Installing', pct: 100 });
      await runWait(file, ['/S']);
      const ok = await waitFor(async () => !!(await installedMap())[a.id], 90000);
      if (!ok) throw new Error('The installer did not finish');
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
    return true;
  } finally { busy.delete(a.id); send('progress', { id: a.id, phase: '', pct: -1 }); }
}
async function uninstall(id) {
  const a = byId(id); if (busy.has(a.id)) throw new Error('Already working on this app');
  busy.add(a.id);
  try {
    const i = (await installedMap())[a.id]; if (!i) return true;
    const m = /^"([^"]+)"/.exec(i.uninstall) || /^(\S+\.exe)/i.exec(i.uninstall); if (!m || !fs.existsSync(m[1])) throw new Error('Uninstaller not found');
    if (path.resolve(path.dirname(m[1])).toLowerCase() !== path.resolve(i.dir).toLowerCase()) throw new Error('Uninstaller is in an unexpected place');
    send('progress', { id: a.id, phase: 'Removing', pct: 100 });
    await runWait(m[1], ['/currentuser', '/S']);
    const gone = await waitFor(async () => !(await installedMap())[a.id], 60000);
    if (!gone) throw new Error('Removal did not finish');
    return true;
  } finally { busy.delete(a.id); send('progress', { id: a.id, phase: '', pct: -1 }); }
}
async function open(id) {
  const a = byId(id); const i = (await installedMap())[a.id]; if (!i) throw new Error('Not installed');
  const c = spawn(i.exe, [], { detached: true, stdio: 'ignore', cwd: i.dir }); c.on('error', () => {}); c.unref(); return true;
}

ipcMain.handle('apps:list', (_e, force) => listApps(!!force));
ipcMain.handle('apps:install', (_e, id) => install(id));
ipcMain.handle('apps:uninstall', (_e, id) => uninstall(id));
ipcMain.handle('apps:open', (_e, id) => open(id));
ipcMain.handle('apps:repo', (_e, id) => { const a = byId(id); return shell.openExternal(`https://github.com/${OWNER}/${a.id}`); });
ipcMain.handle('app:info', () => ({ name: 'Lookout', version: app.getVersion() }));

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 720, minWidth: 760, minHeight: 520,
    title: 'Lookout', backgroundColor: '#262626', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}
if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
module.exports = { listApps, install, uninstall, open };
