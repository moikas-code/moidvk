# GitHub Workflows

This directory contains GitHub Actions workflows for the moidvk project.

## Workflows

### 1. CI (`ci.yml`)

**Trigger**: Push to `main`/`develop` branches, Pull Requests

**Purpose**: Continuous Integration testing

- Tests on multiple Bun versions
- Builds and tests Rust components
- Runs linting and security audits
- Cross-platform compatibility testing

### 2. Release (`release.yml`)

**Trigger**: Git tags matching `v*` pattern

**Purpose**: Automated production releases

- Builds binaries for multiple platforms
- Runs comprehensive tests
- Publishes to npm with `latest` tag
- Creates GitHub releases

**Usage**:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 3. Pre-release (`prerelease.yml`)

**Trigger**: Push to `develop`/`beta`/`alpha` branches, Manual dispatch

**Purpose**: Automated pre-release publishing

- Publishes with `alpha`/`beta` tags
- Timestamp-based versioning
- Creates pre-release GitHub releases

### 4. Manual Publish (`manual-publish.yml`)

**Trigger**: Manual workflow dispatch

**Purpose**: Manual publishing with custom options

- Custom version specification
- Choice of npm tag (`latest`, `beta`, `alpha`)
- Dry run option for testing

**Usage**: Go to Actions tab → Manual Publish → Run workflow

### 5. Dependency Update (`dependency-update.yml`)

**Trigger**: Weekly schedule (Mondays 9 AM UTC), Manual dispatch

**Purpose**: Automated dependency maintenance

- Updates Bun and Rust dependencies
- Runs tests after updates
- Creates PR with changes
- Security audit integration

## Setup Requirements

### Secrets

Add these secrets to your GitHub repository:

1. **`NPM_TOKEN`**: npm authentication token

   ```bash
   # Create token at https://www.npmjs.com/settings/tokens
   # Add as repository secret
   ```

2. **`GITHUB_TOKEN`**: Automatically provided by GitHub Actions

### npm Token Setup

1. Go to [npm tokens page](https://www.npmjs.com/settings/tokens)
2. Create a new "Automation" token
3. Add it as `NPM_TOKEN` in repository secrets

## Publishing Process

### Production Release

1. Ensure all changes are merged to `main`
2. Update version in `package.json` if needed
3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The release workflow will automatically:
   - Build and test the project
   - Publish to npm
   - Create GitHub release

### Pre-release

1. Push to `develop`, `beta`, or `alpha` branch
2. The pre-release workflow will automatically:
   - Generate timestamped version
   - Publish with appropriate tag
   - Create pre-release on GitHub

### Manual Publishing

1. Go to Actions tab
2. Select "Manual Publish" workflow
3. Click "Run workflow"
4. Specify version and options
5. Use dry run to test first

## Monitoring

### CI Status

- All PRs must pass CI before merging
- Check status in PR or Actions tab

### Release Status

- Monitor release progress in Actions tab
- Check npm for published packages
- Verify GitHub releases are created

### Dependency Updates

- Review weekly dependency update PRs
- Merge after testing if changes look good
- Monitor for security vulnerabilities

## Troubleshooting

### Failed Builds

1. Check Rust toolchain compatibility
2. Verify Bun version requirements
3. Review dependency conflicts

### Publishing Issues

1. Verify npm token is valid
2. Check package name availability
3. Ensure version number is unique

### Security Audits

1. Review audit results in workflow logs
2. Update vulnerable dependencies
3. Consider security patches

## Local Testing

Before pushing tags, test locally:

```bash
# Test build
bun run build:all

# Test package
bun pack --dry-run

# Test CLI
bun run serve --help
```
