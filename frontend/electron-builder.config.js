// @see - https://www.electron.build/configuration/configuration
// This JavaScript config allows dynamic configuration based on environment variables

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  });
}

const config = {
  appId: "ai.nod.app",
  asar: true,
  productName: "Nod.AI",
  directories: {
    output: "release/${version}",
  },
  files: ["dist", "dist-electron", "!backend/**"],
  extraResources: [
    {
      from: "../backend/backend.tar.gz",
      to: "backend/backend.tar.gz",
    },
  ],
  mac: {
    target: ["dmg"],
    artifactName: "${productName}-Mac-${version}-${arch}-Installer.${ext}",
    icon: "public/icon.png",
    // Build for both architectures - electron-builder will use the runner's architecture
    // For universal binaries, use: arch: ["x64", "arm64"]
    // For now, we build separately for each arch in CI
    category: "public.app-category.medical",
    hardenedRuntime: true,
    gatekeeperAssess: true,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    // Code signing - electron-builder will automatically use:
    // - APPLE_IDENTITY environment variable, or
    // - The first "Developer ID Application" certificate in your keychain
    signIgnore: [],
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    artifactName: "${productName}-Windows-${version}-Setup.${ext}",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
  },
  linux: {
    target: ["AppImage"],
    artifactName: "${productName}-Linux-${version}.${ext}",
  },
};

// Enable notarization if credentials are provided
// electron-builder reads notarization from environment variables automatically
const SKIP_NOTARIZATION = process.env.SKIP_NOTARIZATION === "true";
const hasNotarizationCreds =
  !SKIP_NOTARIZATION &&
  Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_ID && process.env.APPLE_ID_PASS);

if (hasNotarizationCreds) {
  // Map APPLE_ID_PASS to APPLE_APP_SPECIFIC_PASSWORD for electron-builder
  process.env.APPLE_APP_SPECIFIC_PASSWORD = process.env.APPLE_ID_PASS;
  // Set other required env vars for notarization
  process.env.APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
  process.env.APPLE_ID = process.env.APPLE_ID;
  config.mac.notarize = {
    teamId: process.env.APPLE_TEAM_ID,
  };
  console.log("✓ Notarization enabled (credentials found in environment)");
} else {
  config.mac.notarize = undefined;
  console.log(
    "⚠ Notarization disabled (ensure APPLE_TEAM_ID, APPLE_ID, APPLE_ID_PASS are set and SKIP_NOTARIZATION is not 'true' to enable)"
  );
}

// Use custom identity if provided
if (process.env.APPLE_IDENTITY) {
  config.mac.identity = process.env.APPLE_IDENTITY;
  console.log(`✓ Using signing identity: ${process.env.APPLE_IDENTITY}`);
}

export default config;

