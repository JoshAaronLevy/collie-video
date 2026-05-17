# video-audit-electron

Private macOS Electron version of the existing `video-audit` app.

The legacy reference app lives in a sibling workspace folder named `video-audit`.

This repo must become standalone. It may copy/adapt logic from the legacy repo, but it must not import from it or depend on it.

## Development

Use Node 20 or newer. This repo includes an `.nvmrc`, so if you use nvm:

```sh
nvm use
```

Install dependencies:

```sh
npm install
```

Run the Electron app locally:

```sh
npm run dev
```

Check TypeScript:

```sh
npm run typecheck
```

Build the Electron/Vite output:

```sh
npm run build
```

## Stage 1 Scope

The current app is a scaffold only. It includes:

- Electron main process window creation
- Vite React renderer
- TypeScript configuration
- PrimeReact, PrimeFlex, and PrimeIcons styling
- `contextIsolation: true`
- `nodeIntegration: false`
- typed preload API at `window.videoAudit`
- basic app/version/platform info returned through IPC
