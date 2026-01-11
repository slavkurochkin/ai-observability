# Troubleshooting: npm link Issues

## Error: "Cannot find module '@ai-observability/client'"

This usually happens when:
1. Package hasn't been built (no `dist/` folder)
2. Symlink isn't set up correctly
3. Dev server needs restart
4. Node modules cache issue

## Solution Steps

### Step 1: Build the Package

**CRITICAL**: The package must be built before linking!

```bash
cd packages/observability-client
npm install
npm run build
```

**Verify**: Check that `dist/` folder exists with:
- `dist/index.js`
- `dist/index.esm.js`
- `dist/index.d.ts`

### Step 2: Link the Package

```bash
# In package directory - this automatically cleans React and builds
cd packages/observability-client
npm run link
```

**Note**: The `npm run link` script automatically removes any local React installation to prevent duplicate React issues.

### Step 3: Link in Your Project

```bash
# In your project directory
cd /path/to/your/project
npm link @ai-observability/client
```

### Step 4: Restart Dev Server

**IMPORTANT**: Always restart your dev server after linking!

```bash
# Stop your dev server (Ctrl+C)
# Then restart
npm start
# or
npm run dev
```

### Step 5: Clear Cache (if still not working)

```bash
# In your project
rm -rf node_modules/.cache
rm -rf node_modules/@ai-observability
npm link @ai-observability/client
```

## Common Issues

### Issue 1: "Module not found" after linking

**Cause**: Package not built or dist folder missing

**Fix**:
```bash
cd packages/observability-client
npm run build
# Verify dist/ folder exists
ls dist/
# Then re-link
npm link
```

### Issue 2: Changes not reflected

**Cause**: Need to rebuild after code changes

**Fix**:
```bash
# Option A: Rebuild manually
cd packages/observability-client
npm run build

# Option B: Use watch mode (recommended)
cd packages/observability-client
npm run dev  # Runs in watch mode
```

### Issue 3: Webpack/Module resolution errors

**Cause**: Webpack might not resolve symlinks correctly

**Fix**: Add to your project's `webpack.config.js` or `vite.config.ts`:

**For Webpack:**
```javascript
module.exports = {
  resolve: {
    symlinks: true, // Enable symlink resolution
  },
};
```

**For Vite:**
```typescript
export default defineConfig({
  resolve: {
    preserveSymlinks: false, // Should be false for npm link
  },
});
```

### Issue 4: TypeScript can't find types

**Cause**: TypeScript might not resolve symlinked packages

**Fix**: Check `tsconfig.json`:
```json
{
  "compilerOptions": {
    "preserveSymlinks": false
  }
}
```

### Issue 5: React version mismatch

**Cause**: Peer dependency issue

**Fix**: Make sure your project has React installed:
```bash
npm install react@^18.2.0
```

### Issue 6: "Objects are not valid as a React child" (found: object with keys {$$typeof, ...})

**Cause**: Duplicate React instances. This often happens when using `npm link`, where the package uses its own `node_modules/react` and your project uses its own `node_modules/react`.

**Fix 1 (Recommended): Webpack Alias**
If you are using webpack (e.g., Create React App, Next.js), add an alias to force resolving React from your project's node_modules.

To your `webpack.config.js` or `next.config.js`:
```javascript
const path = require('path');

module.exports = {
  // ...
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    };
    return config;
  },
};
```

**Fix 2: Delete nested React**
Delete the `react` installation inside the linked package to force it to use the host's react.

```bash
cd packages/observability-client
rm -rf node_modules/react node_modules/react-dom
# You might need to reinstall it later to run tests or build the package
```

## Verification Checklist

Run these to verify setup:

```bash
# 1. Check package is built
cd packages/observability-client
ls dist/  # Should show index.js, index.esm.js, index.d.ts

# 2. Check link exists
npm ls -g --depth=0 | grep @ai-observability

# 3. Check link in project
cd /path/to/your/project
ls -la node_modules/@ai-observability  # Should be a symlink

# 4. Check package.json
cat node_modules/@ai-observability/client/package.json  # Should show correct exports
```

## Alternative: Use file: Protocol

If `npm link` continues to cause issues, use the `file:` protocol instead:

**In your project's `package.json`:**
```json
{
  "dependencies": {
    "@ai-observability/client": "file:../path/to/packages/observability-client"
  }
}
```

Then:
```bash
npm install
```

**Note**: With `file:` protocol, you need to rebuild the package and restart your dev server after changes.

## Quick Fix Script

Create this script to quickly rebuild and relink:

```bash
#!/bin/bash
# rebuild-and-link.sh

cd packages/observability-client
echo "🔨 Building package..."
npm run build

echo "🔗 Linking package..."
npm link

echo "✅ Done! Now run 'npm link @ai-observability/client' in your project"
```

## Still Not Working?

1. **Check Node version**: Make sure you're using a compatible Node version
2. **Clear all caches**:
   ```bash
   # In your project
   rm -rf node_modules
   rm -rf .cache
   npm install
   npm link @ai-observability/client
   ```
3. **Check file permissions**: Make sure you have read access to the package directory
4. **Try absolute path**: Use absolute path in `file:` protocol instead of relative
