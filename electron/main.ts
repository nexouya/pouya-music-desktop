import { app, BrowserWindow, shell, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { fork, ChildProcess } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
const SERVER_PORT = 3000;

function startBackendServer() {
  const isDev = process.env.NODE_ENV !== "production";
  const serverPath = isDev
    ? path.join(__dirname, "..", "server.ts")
    : path.join(__dirname, "..", "dist", "server.cjs");

  console.log(`[Electron] Starting embedded server from: ${serverPath}`);
  
  if (isDev) {
    // In dev, use tsx
    serverProcess = fork(serverPath, [], {
      execArgv: ["--import", "tsx"],
      env: { ...process.env, PORT: SERVER_PORT.toString() },
      stdio: "inherit"
    });
  } else {
    // In production, run compiled server bundle
    serverProcess = fork(serverPath, [], {
      env: { ...process.env, PORT: SERVER_PORT.toString(), NODE_ENV: "production" },
      stdio: "inherit"
    });
  }

  serverProcess.on("error", (err) => {
    console.error("[Electron Server Error]", err);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: "#030712",
    title: "Pouya Music",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    vibrancy: "under-window", // macOS Apple glass vibrancy
    visualEffectState: "active",
    frame: process.platform !== "darwin", // Custom smooth frame on macOS
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows cross-origin streams & local file access
    },
  });

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Load from local embedded server
  const appUrl = `http://localhost:${SERVER_PORT}`;
  
  // Wait briefly for the server to be ready before loading
  setTimeout(() => {
    mainWindow?.loadURL(appUrl).catch(() => {
      setTimeout(() => mainWindow?.loadURL(appUrl), 1500);
    });
  }, 1000);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window:close", () => mainWindow?.close());
}

// macOS dock and window lifecycle
app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
