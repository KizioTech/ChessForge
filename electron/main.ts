import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import fs from "node:fs";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

// Allow local file access for Web Workers and WASM binaries in packaged desktop builds (file://)
app.commandLine.appendSwitch("allow-file-access-from-files");

function getAppIcon(): string | undefined {
  const iconCandidates = [
    path.join(__dirname, isDev ? "../public/logo.ico" : "../dist/logo.ico"),
    path.join(__dirname, isDev ? "../public/logo.png" : "../dist/logo.png"),
    path.join(process.cwd(), "public", "logo.ico"),
    path.join(process.cwd(), "public", "logo.png"),
  ];
  for (const candidate of iconCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindow() {
  const icon = getAppIcon();
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: "#101820",
    title: "ChessForge",
    icon,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#101820",
      symbolColor: "#dce5e2",
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
