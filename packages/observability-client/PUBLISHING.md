# Publishing Guide

This guide explains how to publish the `@ai-observability/client` package to npm.

## Pre-Publishing Checklist

### 1. Code Quality

- [ ] All tests pass: `npm test`
- [ ] Test coverage is acceptable: `npm run test:coverage`
- [ ] TypeScript compiles without errors: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

### 2. Documentation

- [ ] README.md is up to date
- [ ] MIGRATION_GUIDE.md is accurate
- [ ] CHANGELOG.md has version entry
- [ ] API documentation is complete
- [ ] Examples are working

### 3. Package Configuration

- [ ] package.json version is correct
- [ ] package.json metadata is complete (author, repo, homepage)
- [ ] files field includes correct files
- [ ] exports field is configured properly
- [ ] .npmignore excludes dev files

### 4. Testing

- [ ] Test in a real project using `npm link`
- [ ] Verify all exports work correctly
- [ ] Test installation from npm (after publishing)
- [ ] Verify TypeScript types work

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backward compatible

## Publishing Steps

### First-Time Setup

1. **Create npm account** (if you don't have one)
   ```bash
   # Visit https://www.npmjs.com/signup
   ```

2. **Login to npm**
   ```bash
   npm login
   ```

3. **Verify login**
   ```bash
   npm whoami
   ```

4. **Check package name availability**
   ```bash
   npm search @ai-observability/client
   ```

### Publishing Process

1. **Update version in package.json**
   ```bash
   # Manually edit package.json version
   # Or use npm version command:
   npm version patch  # 1.0.0 → 1.0.1
   npm version minor  # 1.0.0 → 1.1.0
   npm version major  # 1.0.0 → 2.0.0
   ```

2. **Update CHANGELOG.md**
   ```markdown
   ## [1.0.1] - 2025-01-XX

   ### Fixed
   - Bug fix description
   ```

3. **Run pre-publish checks**
   ```bash
   npm run test
   npm run build
   npm run type-check
   npm run lint
   ```

4. **Create a dry-run package**
   ```bash
   npm pack --dry-run
   ```

5. **Review package contents**
   ```bash
   npm pack
   tar -xvzf ai-observability-client-1.0.0.tgz
   cd package
   # Review files - should only include dist/, README.md, etc.
   cd ..
   rm -rf package ai-observability-client-1.0.0.tgz
   ```

6. **Publish to npm**
   ```bash
   # First time or public package
   npm publish --access public

   # Subsequent publishes
   npm publish
   ```

7. **Verify publication**
   ```bash
   # Check npm
   npm view @ai-observability/client

   # Test installation
   mkdir test-install
   cd test-install
   npm init -y
   npm install @ai-observability/client
   ```

8. **Create git tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

9. **Create GitHub release**
   - Go to GitHub releases page
   - Create release from tag
   - Copy CHANGELOG entry to release notes

## Publishing to Private Registry

If publishing to a private npm registry:

1. **Configure registry**
   ```bash
   # Add to .npmrc
   @ai-observability:registry=https://your-private-registry.com
   ```

2. **Authenticate**
   ```bash
   npm login --registry=https://your-private-registry.com
   ```

3. **Publish**
   ```bash
   npm publish --registry=https://your-private-registry.com
   ```

## Troubleshooting

### Issue: "Package already exists"

**Solution:** You cannot republish the same version. Increment version number.

### Issue: "403 Forbidden"

**Cause:** Not authenticated or no permission

**Solution:**
```bash
npm login
# Verify
npm whoami
```

### Issue: "Package name taken"

**Solution:** Choose a different package name or use scoped package (@your-org/name)

### Issue: "Files missing from package"

**Cause:** .npmignore or files field in package.json

**Solution:**
1. Check .npmignore doesn't exclude important files
2. Check package.json "files" field includes necessary files
3. Use `npm pack` to verify contents

### Issue: TypeScript types not working

**Cause:** types field not set correctly

**Solution:**
```json
{
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js"
    }
  }
}
```

## Automated Publishing (CI/CD)

### GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Package

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: |
          cd packages/observability-client
          npm ci

      - name: Run tests
        run: |
          cd packages/observability-client
          npm test

      - name: Build
        run: |
          cd packages/observability-client
          npm run build

      - name: Publish to npm
        run: |
          cd packages/observability-client
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Setup NPM_TOKEN

1. Generate token on npmjs.com
2. Add to GitHub repository secrets
3. Token should have "Automation" or "Publish" permission

## Post-Publishing

### 1. Announcement

- Update project README with installation instructions
- Post in team chat/channel
- Update documentation site
- Write blog post (optional)

### 2. Monitor

- Check npm download stats
- Monitor GitHub issues
- Watch for bug reports
- Track user feedback

### 3. Support

- Respond to issues promptly
- Update documentation based on feedback
- Plan next release based on requests

## Beta/Alpha Releases

For pre-release versions:

```bash
# Version
npm version 1.1.0-beta.0

# Publish with beta tag
npm publish --tag beta

# Install
npm install @ai-observability/client@beta
```

## Deprecating Old Versions

```bash
# Deprecate a specific version
npm deprecate @ai-observability/client@1.0.0 "Please upgrade to 1.1.0"

# Deprecate all versions below 2.0.0
npm deprecate @ai-observability/client@"<2.0.0" "Please upgrade to 2.x"
```

## Unpublishing (Emergency Only)

**Warning:** Only do this within 72 hours of publishing and if absolutely necessary.

```bash
npm unpublish @ai-observability/client@1.0.0
```

## Release Schedule

Suggested release cadence:

- **Major releases:** Every 6-12 months
- **Minor releases:** Every 1-2 months
- **Patch releases:** As needed for bugs

## Checklist Summary

Before publishing:

- [ ] Tests pass
- [ ] Build succeeds
- [ ] Version updated
- [ ] CHANGELOG updated
- [ ] Documentation updated
- [ ] Package reviewed with `npm pack`
- [ ] Tested with `npm link`
- [ ] Logged into npm
- [ ] Package name available

After publishing:

- [ ] Verified on npm
- [ ] Test installed package
- [ ] Created git tag
- [ ] Created GitHub release
- [ ] Updated documentation
- [ ] Announced to team

## Additional Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm version command](https://docs.npmjs.com/cli/v8/commands/npm-version)
- [npm publish command](https://docs.npmjs.com/cli/v8/commands/npm-publish)
