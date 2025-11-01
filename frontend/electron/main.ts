import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup paths
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let backendProcess: ChildProcessWithoutNullStreams | null = null;

// Get backend paths - works for both dev and production
function getBackendPaths() {
  const isWindows = process.platform === "win32";
  
  // In dev: __dirname is dist-electron/, so ../../backend gets us to root/backend
  // In production: backend is in extraResources, accessible via process.resourcesPath
  let backendDir: string;
  
  if (VITE_DEV_SERVER_URL) {
    // Development: use relative path from dist-electron to backend
    backendDir = path.join(__dirname, "../../backend");
  } else {
    // Production: backend is in extraResources (outside asar)
    backendDir = process.resourcesPath
      ? path.join(process.resourcesPath, "backend")
      : path.join(path.dirname(process.execPath), "..", "resources", "backend");
  }
  
  const python = isWindows
    ? path.join(backendDir, "venv", "Scripts", "python.exe")
    : path.join(backendDir, "venv", "bin", "python");
  const backend = path.join(backendDir, "app", "main.py");
  
  return { python, backend, cwd: backendDir };
}

// Spawn backend process when app starts
function startBackend() {
  if (backendProcess) {
    return; // Already started
  }

  try {
    const { python, cwd } = getBackendPaths();

    // Check if Python executable exists
    if (!fs.existsSync(python)) {
      console.error(`Failed to start backend: Python not found at ${python}`);
      return;
    }

    console.log(`Starting backend: ${python} -m uvicorn app.app:app`);
    console.log(`Working directory: ${cwd}`);

    // Spawn backend using uvicorn (same as dev script)
    backendProcess = spawn(python, ["-m", "uvicorn", "app.app:app", "--host", "127.0.0.1", "--port", "8000"], {
      cwd,
      stdio: "inherit",
    }) as ChildProcessWithoutNullStreams;

    backendProcess.on("error", (err) => {
      console.error("Failed to start backend:", err);
      backendProcess = null;
    });

    backendProcess.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend process exited with code ${code} and signal ${signal}`);
      }
      backendProcess = null;
    });
  } catch (err) {
    console.error("Error starting backend:", err);
  }
}

function createWindow() {
  // Create browser window
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: true,
    icon: path.join(process.env.VITE_PUBLIC, "electron.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load renderer
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.webContents.closeDevTools();
    win.removeMenu();
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });
}

function cleanup() {
  if (backendProcess) {
    try {
      console.log("Killing backend process...");
      backendProcess.kill("SIGINT");
      backendProcess = null;
    } catch (err) {
      console.error("Failed to kill backend process:", err);
      backendProcess = null;
    }
  }
}

// Handle process termination and cleanup
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit();
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    cleanup();
    app.quit();
    win = null;
  }
});

app.on("before-quit", () => {
  cleanup();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  // Start backend process when app starts
  startBackend();
  // Then create the window
  createWindow();
});

// API FUNCTIONS
ipcMain.on("open-external", (_event, url) => {
  shell.openExternal(url).catch((err) => {
    console.error("Failed to open URL:", err);
  });
});

ipcMain.handle("open-path", async (_event, folderPath: string) => {
  try {
    // Expand ~ to home directory if present
    let expandedPath = folderPath;
    if (folderPath.startsWith("~")) {
      const restOfPath = folderPath.slice(1); // Remove ~
      expandedPath = path.join(os.homedir(), restOfPath);
    }

    // Ensure the directory exists
    if (!fs.existsSync(expandedPath)) {
      fs.mkdirSync(expandedPath, { recursive: true });
    }

    const result = await shell.openPath(expandedPath);
    // shell.openPath returns an empty string on success, or an error message on failure
    if (result === "") {
      return { success: true };
    } else {
      return { success: false, error: result };
    }
  } catch (err) {
    console.error("Failed to open path:", err);
    return { success: false, error: String(err) };
  }
});
