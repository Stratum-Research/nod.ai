# macOS Distribution Guide

This guide explains how to code sign and notarize your Electron app for macOS distribution.

## Prerequisites

1. **Apple Developer Account** - You need an active Apple Developer Program membership ($99/year)
2. **Developer ID Certificate** - Required for apps distributed outside the Mac App Store
3. **App-Specific Password** - For notarization

## Step 1: Get Your Certificates

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a **Developer ID Application** certificate:
   - Click the "+" button
   - Select "Developer ID Application"
   - Follow the instructions to create and download the certificate
   - Double-click the `.cer` file to install it in your Keychain

## Step 2: Get Your Team ID

1. In the Apple Developer Portal, go to **Membership**
2. Your **Team ID** is displayed there (e.g., `ABC123DEF4`)
3. Save this for later

## Step 3: Create an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to **Sign-In and Security** → **App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Name it (e.g., "Nod.AI Notarization")
6. Copy the generated password (you won't see it again!)

## Step 4: Set Environment Variables

You have two options:

### Option A: Export in Terminal (Temporary)

```bash
export APPLE_TEAM_ID="YOUR_TEAM_ID"
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASS="your-app-specific-password"
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
```

### Option B: Create a `.env` file (Recommended for CI/CD)

Create a `.env` file in the `frontend/` directory:

```bash
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASS=your-app-specific-password
APPLE_IDENTITY=Developer ID Application: Your Name (TEAM_ID)
```

**Important:** Add `.env` to your `.gitignore` to avoid committing credentials!

## Step 5: Find Your Signing Identity

To find the exact name of your signing identity:

```bash
security find-identity -v -p codesigning
```

Look for "Developer ID Application" and copy the full name. It should look like:
```
Developer ID Application: Your Name (TEAM_ID)
```

## Step 6: Build and Sign

From the `frontend/` directory:

```bash
npm run build-electron
```

The build process will:
1. Sign your app with the Developer ID certificate
2. Notarize it with Apple (if credentials are provided)
3. Create a signed DMG installer

**Note:** The project uses `electron-builder.config.js` which automatically enables notarization when the required environment variables are set. If you see a warning about notarization being disabled, make sure your environment variables are set correctly.

## Step 7: Verify Signing

After building, verify your app is signed:

```bash
codesign --verify --deep --strict --verbose=2 release/0.1.0-beta.1/mac-arm64/Nod.AI.app
```

You should see: `Nod.AI.app: valid on disk`

## Step 8: Check Notarization Status

Check if notarization completed:

```bash
spctl --assess --verbose --type install release/0.1.0-beta.1/mac-arm64/Nod.AI.app
```

Or check the notarization log:

```bash
xcrun notarytool log <submission-id> --keychain-profile "AC_PASSWORD" --apple-id "your-apple-id@example.com" --team-id "YOUR_TEAM_ID"
```

## Troubleshooting

### "No identity found"
- Make sure your Developer ID certificate is installed in Keychain
- Check the identity name matches exactly (case-sensitive)
- Try: `security find-identity -v -p codesigning`

### "Notarization failed"
- Verify your Apple ID and app-specific password are correct
- Check that your Team ID is correct
- Ensure you're using an app-specific password, not your regular Apple ID password

### "Gatekeeper assessment failed"
- Make sure notarization completed successfully
- Wait a few minutes after notarization - it can take time to propagate

## Distribution

Once signed and notarized, you can distribute your DMG file. Users will be able to:
- Download and open the DMG without warnings
- Install the app without "unidentified developer" errors
- Run the app without Gatekeeper blocking it

## CI/CD Integration

For automated builds, set the environment variables in your CI/CD platform:

- **GitHub Actions**: Add secrets in repository settings
- **GitLab CI**: Add variables in CI/CD settings
- **CircleCI**: Add environment variables in project settings

Example for GitHub Actions:

```yaml
env:
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_ID_PASS: ${{ secrets.APPLE_ID_PASS }}
  APPLE_IDENTITY: ${{ secrets.APPLE_IDENTITY }}
```

## Additional Resources

- [Electron Code Signing Guide](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [electron-builder Documentation](https://www.electron.build/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

