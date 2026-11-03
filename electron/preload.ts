import { contextBridge } from "electron";

// Keep the renderer isolated. Expose only narrowly scoped desktop capabilities
// here as ChessForge gains file import/export and native desktop integrations.
contextBridge.exposeInMainWorld("chessForgeDesktop", {
  platform: process.platform,
  version: "0.1.0"
});
