# Lookout launcher: Google-style UI

Spec: the user's request (2026-11-25, Thai): "Go do Lookout" — i.e. bring the Google/Gemini/NotebookLM look already shipped in Frameout 1.0.31 to the Lookout launcher (the front door of the app family). No written spec beyond that; rulings are provisional and logged in D:/Lookout-apps/NOTES.md. Reference implementation: D:/Lookout-apps/frameout (renderer/app.css, renderer/app.js home screen, renderer/kit.js icon helpers).

## Global Constraints

- App: D:/Lookout-apps/lookout-launcher (Electron, plain JS, no build step). Renderer files: renderer/index.html, kit.js (shared kit copy), lookout.css (shared Google-dark tokens: --bg #131314, surfaces #1e1f20/#282a2c/#333537, accent #a8c7fa, accent ink #062e6f), app.css (launcher styles, currently ~9 lines), app.js (89 lines, global classic script). main.js / preload.js must keep the same IPC contract: window.host.list/install/uninstall/open/repo/onProgress, 'app:info'.
- Privacy: the launcher is the ONLY app that talks to GitHub, only in main.js; CSP stays strict (`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'`). No external fonts/scripts/images. Icons: inline SVG (Material Symbols Outlined path data allowed) plus existing renderer/icons/*.png app icons.
- Dark Google theme only. Plain English UI text, no emoji. Keep every existing feature: search (Ctrl+F, Esc clears), filters (All apps, Installed, Updates, Documents, Media), Update all, Refresh, Install/Update/Open/Remove/Info per app, progress bar, offline notice, beta labels, status bar privacy line, keyboard operation of the nav (Enter/Space), aria labels.
- Do not change the data/installer logic in main.js. Do not change package name; do not bump the version or release; do not push. Commit on branch google-ui in D:/Lookout-apps/lookout-launcher.
- Test harness: D:/Lookout-apps/_tools/multi-main.js runs an app with a steps file: `LK_APP=D:/Lookout-apps/lookout-launcher LK_STEPS=D:/Lookout-apps/_tools/<steps>.js LK_LOG=D:/Lookout-apps/_tools/test/out/<name>.log LK_USERDATA=<fresh dir under D:/Lookout-apps/_tools/test/> timeout 150 D:/Lookout-apps/frameout/node_modules/.bin/electron.cmd D:/Lookout-apps/_tools/multi-main.js` (see D:/Lookout-apps/_tools/run-fo.sh for the exact pattern; copy it to a launcher variant). Steps: module.exports=[{code,wait,input,shot}]; results in <name>.log.res, renderer console in <name>.log. Existing launcher step files: _tools/st-launcher.js, st-launcher-list.js, st-launcher-net.js, st-launcher-search.js, st-launcher-keys.js — run them all as a baseline first and keep them green.

## Task 1: Google-style launcher UI

Restyle the launcher like Gemini / NotebookLM home (same family as Frameout 1.0.31):
- 56-64px top app bar: Lookout mark + name, a rounded pill search field (Ctrl+F still focuses it), circular 40px icon buttons (Refresh), primary pill "Update all (N)" when updates exist.
- Left navigation drawer: pill nav items with Material outlined icons and tonal active fill (All apps, Installed, Updates with a count badge, Documents, Media). Decide and add any useful extra categories that make sense for the 11 apps (e.g. group labels such as Design & Video & Audio if the app data supports it from main.js; do not invent data) and log the ruling. Section headers in Google style.
- Main area: a "Welcome to Lookout" style header, apps shown as rounded (16px+) cards in a responsive grid (app icon, name, one-line description, version / update state chip, primary action pill + overflow actions Open / Remove / Info as icon buttons), hover state, progress as a thin linear indicator inside the card. Empty/offline/loading states styled like Google (notice banner pill, skeleton or text).
- Panels as rounded surfaces with 8px gutters like Frameout's editor; M3 dialogs (replace window.confirm for Remove with an in-app M3 dialog if feasible; Esc cancels, focus returns), snackbar toasts.
- Keep keyboard accessibility (tab order, Enter/Space on nav, focus rings), aria-labels, titles on icon buttons.
- Screenshots after: D:/Lookout-apps/_tools/test/out/lau-*.png (library all, installed, updates filter, media, offline notice, remove dialog, search with no match, narrow window ~700px).
- Everything must keep working: run the existing launcher step files before and after.
