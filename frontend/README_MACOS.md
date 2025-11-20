# 🍎 macOS Distribution - Quick Start

## What I Need From You (3 Things)

1. **Apple Team ID** 
   - Get it here: https://developer.apple.com/account/#/membership/
   - Looks like: `ABC123DEF4`

2. **Apple ID Email**
   - The email you use for your Apple Developer account

3. **App-Specific Password**
   - Create it here: https://appleid.apple.com
   - Go to: Sign-In and Security → App-Specific Passwords
   - Click "Generate an app-specific password"
   - Name it "Nod.AI Notarization"
   - Copy the password (you won't see it again!)

## One-Time Setup (2 minutes)

```bash
cd frontend
npm run setup-macos
```

The script will ask you for the 3 things above and save them securely.

## Make Sure You Have a Certificate

Before setup, you need a **Developer ID Application** certificate:

1. Go to: https://developer.apple.com/account/resources/certificates/list
2. Click the **"+"** button
3. Select **"Developer ID Application"**
4. Download the `.cer` file
5. **Double-click** it to install in your Keychain

## Build Your Signed App

That's it! Now just build normally:

```bash
npm run build-electron
```

The build will automatically:
- ✅ Sign your app
- ✅ Notarize it with Apple  
- ✅ Create a signed DMG

Your app is ready to distribute! 🎉

---

**Need more details?** See `SETUP.md` or `MACOS_DISTRIBUTION.md`

