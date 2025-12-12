# Release Workflow Documentation

## Overview

The Deck of Destiny system uses **semantic versioning** with automated releases triggered on push to `main`. The release process is handled by GitHub Actions and semantic-release.

## How It Works

### Automatic Version Detection

The release workflow uses **conventional commits** to automatically determine the version bump:

- **BREAKING CHANGE** or `!:` → Major version (X.0.0)
- **feat:** → Minor version (0.X.0)
- **fix:** → Patch version (0.0.X)
- **docs:**, **style:**, **refactor:**, **perf:** → No release (changelog entry only)

### Release Process

1. **Commit Detection**: When code is pushed to `main`, the workflow analyzes all commits since the last release
2. **Build**: The system is compiled (SCSS → CSS, packs are processed)
3. **Version Update**: `package.json`, `system.json`, and `CHANGELOG.md` are updated with the new version
4. **Archive Creation**: All system files are zipped into `dod.zip`
5. **GitHub Release**: A new release is created with:
   - Updated `system.json` manifest
   - `dod.zip` system archive
   - Auto-generated release notes from commits
   - Updated `CHANGELOG.md` (committed back to main)

## Commit Message Format

Follow **Conventional Commits** format for automatic version detection:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - A new feature (minor version bump)
- `fix:` - A bug fix (patch version bump)
- `BREAKING CHANGE:` - Breaking changes (major version bump, can be in body)
- `docs:` - Documentation changes (no version bump)
- `style:` - Code style changes (no version bump)
- `refactor:` - Code refactoring (no version bump)
- `perf:` - Performance improvements (no version bump)
- `test:` - Test changes (no version bump)
- `chore:` - Maintenance tasks (no version bump)

### Examples

**Patch Release (0.1.0 → 0.1.1):**
```
fix: correct damage calculation for trauma levels
```

**Minor Release (0.1.0 → 0.2.0):**
```
feat: add power items to character sheet

- Add new power item type
- Integrate with ability system
```

**Major Release (0.1.0 → 1.0.0):**
```
feat: redesign character sheet layout

BREAKING CHANGE: Legacy character sheets are no longer compatible
```

## Pre-release Workflow

For release candidates, the existing `pre-release.yml` workflow is still available:

1. Tag a commit with format: `X.Y.Z-rc.N` (e.g., `0.2.0-rc.1`)
2. Push the tag: `git push origin 0.2.0-rc.1`
3. GitHub Actions automatically:
   - Validates version matches `system.json`
   - Builds the system
   - Creates a pre-release with the archive
   - Tags it as a pre-release on GitHub

## Release Manifest URL

After a release, use this URL in Foundry VTT to install the latest version:

```
https://raw.githubusercontent.com/elsarfhem/foundry-dod/main/system.json
```

The `system.json` manifest always points to the latest release:

```json
{
  "manifest": "https://raw.githubusercontent.com/elsarfhem/foundry-dod/main/system.json",
  "download": "https://github.com/elsarfhem/foundry-dod/releases/download/vX.Y.Z/dod.zip"
}
```

## Configuration Files

- **`.releaserc.json`** - Main semantic-release configuration
- **`scripts/update-system-json.js`** - Custom plugin to update `system.json` with new version and download URL
- **`.github/workflows/release.yml`** - GitHub Actions workflow for automated releases
- **`.github/workflows/pre-release.yml`** - Pre-release workflow (unchanged)

## Manual Operations

### Trigger a Release

Releases are automatic on `main` branch push. No manual action needed.

### Skip Release

Add `[skip ci]` to your commit message to prevent automatic release:

```
fix: minor adjustment

[skip ci]
```

### First Release

If this is the first release from the current version number:

1. Ensure you have some commits with conventional commit messages
2. Push to main
3. The workflow will automatically detect the next version based on commits

## Troubleshooting

### Release Not Created

1. Check that commits use conventional commit format
2. Ensure the push is to `main` branch
3. Check GitHub Actions logs: **Settings → Actions → Workflows → Semantic Release**
4. Verify `system.json` is valid JSON

### Version Mismatch

The `update-system-json.js` plugin automatically syncs:
- `system.json` → `version` field
- `system.json` → `download` URL (includes version tag)
- `package.json` → `version` field

These are committed back to main after release.

### Manifest Not Updating

The manifest URL uses the `main` branch:

```
https://raw.githubusercontent.com/elsarfhem/foundry-dod/main/system.json
```

GitHub may cache this URL. If installation fails:
1. Wait 5-10 minutes for cache to clear
2. Or use the direct release URL instead

