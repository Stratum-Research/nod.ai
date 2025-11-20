import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";
import fs from "fs";
import tar from "tar";

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
let backendExtractPromise: Promise<string> | null = null;

type BackendCommand = {
  command: string;
  args: string[];
  cwd: string;
  description: string;
};

const BACKEND_ARCHIVE_NAME = "backend.tar.gz";
const BACKEND_RUNTIME_DIR = "backend-runtime";
const BACKEND_VERSION_FILE = ".version";

async function ensureProductionBackend(): Promise<string> {
  if (backendExtractPromise) {
    return backendExtractPromise;
  }

  backendExtractPromise = (async () => {
    const resourcesDir = process.resourcesPath
      ? process.resourcesPath
      : path.join(path.dirname(process.execPath), "..", "resources");
    const archivePath = path.join(resourcesDir, "backend", BACKEND_ARCHIVE_NAME);
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Backend archive missing at ${archivePath}`);
    }

    const runtimeDir = path.join(app.getPath("userData"), BACKEND_RUNTIME_DIR);
    const versionFile = path.join(runtimeDir, BACKEND_VERSION_FILE);
    const currentVersion = app.getVersion();

    let needsExtract = true;
    if (fs.existsSync(path.join(runtimeDir, "venv"))) {
      if (fs.existsSync(versionFile)) {
        const existingVersion = fs.readFileSync(versionFile, "utf-8").trim();
        needsExtract = existingVersion !== currentVersion;
      }
    }

    if (needsExtract) {
      console.log("⬇️  Extracting backend resources...");
      await fs.promises.rm(runtimeDir, { recursive: true, force: true });
      await fs.promises.mkdir(runtimeDir, { recursive: true });
      await tar.x({
        file: archivePath,
        cwd: runtimeDir,
      });
      await fs.promises.writeFile(versionFile, currentVersion, "utf-8");
      console.log("✅ Backend extraction complete");
    }

    return runtimeDir;
  })();

  backendExtractPromise.catch(() => {
    backendExtractPromise = null;
  });

  return backendExtractPromise;
}

async function resolveBackendCommand(): Promise<BackendCommand> {
  const isWindows = process.platform === "win32";

  if (VITE_DEV_SERVER_URL) {
    const backendDir = path.join(__dirname, "../../backend");
    const python = isWindows
      ? path.join(backendDir, "venv", "Scripts", "python.exe")
      : path.join(backendDir, "venv", "bin", "python");
    return {
      command: python,
      args: ["-m", "uvicorn", "app.app:app", "--host", "127.0.0.1", "--port", "8000"],
      cwd: backendDir,
      description: "development venv",
    };
  }

  const runtimeDir = await ensureProductionBackend();
  const python = isWindows
    ? path.join(runtimeDir, "venv", "Scripts", "python.exe")
    : path.join(runtimeDir, "venv", "bin", "python");

  if (!fs.existsSync(python)) {
    throw new Error(`Python runtime not found at ${python}`);
  }

  return {
    command: python,
    args: ["-m", "uvicorn", "app.app:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd: runtimeDir,
    description: "packaged backend runtime",
  };
}

// Spawn backend process when app starts
async function startBackend() {
  if (backendProcess) {
    return; // Already started
  }

  try {
    const backendCommand = await resolveBackendCommand();

    console.log(
      `Starting backend (${backendCommand.description}): ${backendCommand.command} ${backendCommand.args.join(" ")}`
    );
    console.log(`Working directory: ${backendCommand.cwd}`);

    backendProcess = spawn(backendCommand.command, backendCommand.args, {
      cwd: backendCommand.cwd,
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
  // Get icon path - use PNG for Electron, fallback to SVG if PNG doesn't exist
  const iconPath = path.join(process.env.VITE_PUBLIC, "icon.png");
  const icon = fs.existsSync(iconPath) ? iconPath : path.join(process.env.VITE_PUBLIC, "logo.svg");

  // Create browser window
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: true,
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Set dock icon on macOS (for the app icon in the dock)
  if (process.platform === "darwin" && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }

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

app.whenReady().then(async () => {
  // Start backend process when app starts
  await startBackend();
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
