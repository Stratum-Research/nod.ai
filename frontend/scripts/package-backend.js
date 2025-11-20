#!/usr/bin/env node

import { fileURLToPath } from "url";
import path, { dirname, join } from "path";
import fs, { existsSync, rmSync } from "fs";
import tar from "tar";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..");
const frontendDir = join(repoRoot, "frontend");
const backendDir = join(repoRoot, "backend");
const archivePath = join(backendDir, "backend.tar.gz");
function loadEnvFile() {
  const envPath = join(frontendDir, ".env");
  if (!existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) return;
    const value = rest.join("=").trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const requiredPaths = ["app", "venv"];
const MACHO_MAGICS = new Set([
  0xfeedface,
  0xfeedfacf,
  0xcefaedfe,
  0xcffaedfe,
  0xcafebabe,
  0xbebafeca,
]);
const SIGN_EXTENSIONS = new Set([".so", ".dylib", ".a"]);
const SIGN_BASENAMES = new Set([
  "python",
  "python3",
  "python3.12",
  "main",
  "uvicorn",
]);

function assertPathExists(relativePath) {
  const absolutePath = join(backendDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `Missing backend path "${relativePath}". Please make sure the backend is set up (run python -m venv venv && pip install -r requirements.txt).`
    );
  }
}

function isLikelyMachO(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (SIGN_EXTENSIONS.has(ext)) return true;
  const base = path.basename(filePath);
  if (SIGN_BASENAMES.has(base)) return true;
  return false;
}

function hasMachOMagic(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    if (bytesRead !== 4) return false;
    const be = buffer.readUInt32BE(0);
    const le = buffer.readUInt32LE(0);
    return MACHO_MAGICS.has(be) || MACHO_MAGICS.has(le);
  } catch {
    return false;
  }
}

async function collectCandidateBinaries(rootDir) {
  const stack = [rootDir];
  const results = [];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "__pycache__" ||
          entry.name === "myenv" ||
          entry.name === "test_venv"
        ) {
          continue;
        }
        stack.push(fullPath);
      } else if (entry.isFile()) {
        if (!isLikelyMachO(fullPath)) continue;
        if (hasMachOMagic(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  }
  return results;
}

function signBinary(identity, filePath) {
  execFileSync(
    "codesign",
    [
      "--force",
      "--options",
      "runtime",
      "--timestamp",
      "-s",
      identity,
      filePath,
    ],
    { stdio: "inherit" }
  );
}

async function signBackendBinaries() {
  if (process.platform !== "darwin") {
    console.log("ℹ️  Skipping backend code signing (not macOS)");
    return;
  }

  const identityRaw =
    process.env.APPLE_IDENTITY ||
    process.env.CODESIGN_IDENTITY ||
    process.env.APPLE_SIGNING_IDENTITY ||
    "";
  const identity = identityRaw.trim().replace(/^"(.*)"$/, "$1");

  if (!identity) {
    throw new Error(
      "APPLE_IDENTITY (or CODESIGN_IDENTITY) must be set to sign backend binaries for notarization."
    );
  }

  console.log("🔏 Signing backend binaries using identity:", identity);
  const candidates = await collectCandidateBinaries(join(backendDir, "venv"));
  console.log(`   Found ${candidates.length} Mach-O files to sign...`);

  candidates.forEach((filePath, index) => {
    try {
      signBinary(identity, filePath);
    } catch (error) {
      console.error(`Failed to sign ${filePath}`, error);
      throw error;
    }
    if ((index + 1) % 50 === 0 || index === candidates.length - 1) {
      console.log(`   Signed ${index + 1}/${candidates.length}`);
    }
  });
}

function shouldSkipEntry(relativePath) {
  return (
    relativePath.startsWith("app/manager/myenv") ||
    relativePath.startsWith("app/manager/test_venv") ||
    relativePath.startsWith("venv/share/man") ||
    relativePath.includes("__pycache__")
  );
}

async function packageBackend() {
  console.log("📦 Packaging backend resources into backend/backend.tar.gz");
  requiredPaths.forEach(assertPathExists);

  await signBackendBinaries();

  // Remove previous archive if it exists
  rmSync(archivePath, { force: true });

  await tar.create(
    {
      gzip: true,
      cwd: backendDir,
      file: archivePath,
      portable: true,
      filter: (pathName) => !shouldSkipEntry(pathName),
    },
    ["app", "venv", "requirements.txt", "settings.py", "settings.json"].filter(
      (entry) => existsSync(join(backendDir, entry))
    )
  );

  console.log("✅ Backend archive created at", archivePath);
}

packageBackend().catch((error) => {
  console.error("❌ Failed to package backend:", error);
  process.exit(1);
});

