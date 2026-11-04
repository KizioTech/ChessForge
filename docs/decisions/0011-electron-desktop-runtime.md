# ADR 0011 — Electron Desktop Runtime Selection

**Status:** Accepted  
**Date:** 2026-11-03  
**Deciders:** ChessForge core team

---

## Context

ChessForge requires a desktop container to provide a focused, native chess-training environment with offline access, background computation, and local file handling.

Two primary technologies were evaluated for the desktop wrapper:
1. **Tauri (v1/v2):** Rust core with platform webview (WebView2 on Windows, WebKitGTK on Linux, WKWebView on macOS).
2. **Electron:** Chromium and Node.js bundled runtime.

---

## Decision

We chose **Electron** as the desktop application container for ChessForge.

### Rationale

1. **Deterministic WebAssembly and Web Worker Execution:**
   - Stockfish 19 Lite WASM relies on multi-threaded Web Workers, `WebAssembly.instantiateStreaming`, and high-performance JIT execution.
   - Platform webviews (notably WebKitGTK on Linux and varying WebView2 installations on Windows) exhibit inconsistent WebAssembly performance, thread pooling limits, and divergent Worker memory management. Bundling Chromium guarantees uniform execution, consistent garbage collection, and predictable engine performance across all operating systems.

2. **Isolated Renderer Security Architecture:**
   - Electron enables a hardened configuration with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
   - The renderer is treated as an untrusted client that interacts with desktop APIs solely through explicit, typed context bridge methods in `preload.ts`.

3. **Local File and Origin Consistency:**
   - Electron allows running Web Workers and WASM modules from packaged local files (`app.commandLine.appendSwitch("allow-file-access-from-files")`) without the complex custom protocol and IPC serialization overhead required to stream binary blobs across platform webviews in Tauri.

4. **Developer Ergonomics and Ecosystem:**
   - Seamless integration with Vite, Vitest, and Playwright for automated desktop and web end-to-end testing.

---

## Consequences

- **Positive:** Guaranteed engine execution speed and Web Worker reliability; zero OS-dependent webview rendering bugs; full offline operability; native window frame overlays.
- **Negative:** Larger application download footprint (~80 MB) and higher base memory usage compared to a minimal Tauri shell.

