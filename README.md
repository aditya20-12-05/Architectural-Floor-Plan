# Blueprint Floor-Plan Generator

A dynamic 3D, orbit-controllable floor-plan generator drawn as a clean
architectural line drawing on white paper. Enter floor and room details and the
plan packs itself with a squarified treemap; change any room's area (or drag a
block onto another) and the whole layout re-flows and animates.

Built with **Vite + React + TypeScript** and **three / @react-three/fiber /
@react-three/drei**. Installable as a desktop app (PWA).

## Features

- Squarified-treemap room layout, each block sized proportional to its sq ft
- **Drag a block onto another in 3D to swap them**; the plan re-packs and animates
- Live area readout (allocated rooms vs carpet − walkable) with a balance warning
- Control panel: floor areas, rooms (category + flagship + drag-reorder), view toggles
- Floating room labels, room schedule, title block, north arrow
- Orbit / zoom / pan, reset view, snap-to-isometric, locked-isometric
- PNG export (sheet frame + title block + schedule), JSON import/export
- Config persists to localStorage
- Installable PWA (offline-capable) with its own window and icon

## Run locally

```bash
npm install
npm run dev
```

Requires Node 18+ (a current LTS). Other scripts: `npm run build`,
`npm run preview`, `npm run typecheck`.

## Deploy

Vercel auto-detects the Vite config (`vercel.json` is included). Push to `main`
and Vercel rebuilds. The deployed HTTPS URL is shareable and installable: open it
in Chrome/Edge and choose **Install** to add it to your desktop.

## Icons

App icons are generated from `public/icon.svg`:

```bash
node scripts/gen-icons.mjs
```
