# Quick Fix: "Cannot find module" Error

## Immediate Solution

Run these commands in order:

```bash
# 1. Build the package (CRITICAL - must be done first!)
cd packages/observability-client
npm run build

# 2. Verify dist folder exists
ls dist/
# Should show: index.js, index.esm.js, index.d.ts

# 3. Link the package
npm link

# 4. In your project directory, link it
cd /path/to/your/project
npm link @ai-observability/client

# 5. RESTART your dev server (important!)
# Stop with Ctrl+C, then:
npm start
# or
npm run dev
```

## Most Common Cause

**The package wasn't built before linking!**

The `dist/` folder must exist with compiled files. Always run `npm run build` first.

## If Still Not Working

Try the `file:` protocol instead of `npm link`:

**In your project's `package.json`:**
```json
{
  "dependencies": {
    "@ai-observability/client": "file:../packages/observability-client"
  }
}
```

Then:
```bash
cd /path/to/your/project
npm install
```

This is more reliable than `npm link` for some setups.
