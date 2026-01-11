# Rebuild Instructions for Package Fixes

## When to Rebuild

After any changes to the package source code, you **MUST** rebuild the package for changes to take effect in consuming applications.

## Steps to Rebuild

1. **Navigate to package directory:**
   ```bash
   cd packages/observability-client
   ```

2. **Rebuild the package:**
   ```bash
   npm run build
   ```

3. **In your consuming app, restart the dev server:**
   ```bash
   # Stop the current dev server (Ctrl+C)
   # Then restart it
   npm start
   # or
   npm run dev
   ```

## If Using npm link

If you're using `npm link`:

1. Rebuild the package (steps above)
2. **Re-link** (optional but recommended):
   ```bash
   # In package directory
   npm link
   
   # In your app directory
   npm link @ai-observability/client
   ```
3. Restart your dev server

## If Using file: Protocol

If your `package.json` uses:
```json
"@ai-observability/client": "file:../packages/observability-client"
```

1. Rebuild the package (steps above)
2. Restart your dev server (the file: protocol picks up changes automatically after rebuild)

## Verify the Fix

After rebuilding and restarting:
1. Check browser console - errors should stop
2. Check observability dashboard - new errors should not appear
3. If errors persist, clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Common Issue: Still Seeing Old Errors

If you're still seeing the same errors after rebuilding:

1. **Clear browser cache** - Old JavaScript bundles might be cached
2. **Hard refresh** - Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
3. **Check build output** - Verify `dist/` folder has new timestamps
4. **Check if package is linked correctly** - Run `npm list @ai-observability/client` in your app

## Quick Check

To verify you're using the latest version, check the build timestamp:
```bash
ls -la packages/observability-client/dist/
```

The files should have recent timestamps matching when you ran `npm run build`.
