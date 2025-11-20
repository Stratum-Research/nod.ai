# 🍎 macOS Distribution Setup (Super Simple!)

## What You Need to Provide

I need **3 things** from you:

1. **Apple Team ID** - Found at https://developer.apple.com/account/#/membership/
2. **Apple ID Email** - The email you use for your Apple Developer account
3. **App-Specific Password** - Create one at https://appleid.apple.com → Sign-In and Security → App-Specific Passwords

## Quick Setup (2 minutes)

Just run this command and answer the 3 questions:

```bash
cd frontend
npm run setup-macos
```

That's it! The script will:
- ✅ Check if you have certificates installed
- ✅ Save your credentials securely
- ✅ Configure everything automatically

## Make Sure You Have a Certificate

Before running the setup, make sure you have a **Developer ID Application** certificate:

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click the **"+"** button
3. Select **"Developer ID Application"**
4. Download and **double-click** the `.cer` file to install it

## Build Your Signed App

Once setup is complete, just build normally:

```bash
npm run build-electron
```

The build will automatically:
- ✅ Sign your app
- ✅ Notarize it with Apple
- ✅ Create a signed DMG

## That's It!

Your app is now ready to distribute. Users won't see any security warnings! 🎉

---

**Need help?** Check `MACOS_DISTRIBUTION.md` for detailed troubleshooting.

