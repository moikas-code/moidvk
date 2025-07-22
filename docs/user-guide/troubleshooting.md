# Troubleshooting Guide

This guide helps you resolve common issues with MOIDVK installation, configuration, and usage.

## 📋 Quick Diagnostics

### System Health Check

```bash
# Run comprehensive diagnostics
moidvk doctor

# Verbose diagnostics with detailed output
moidvk doctor --verbose

# Check specific components
moidvk doctor --check-rust
moidvk doctor --check-python
moidvk doctor --check-mcp
```

### Expected Healthy Output

```
✅ MOIDVK v1.0.0
✅ Rust core: Available (native)
✅ Python tools: Available
✅ MCP server: Ready
✅ Node.js: v18.17.0
✅ Bun: v1.0.25
✅ All 37 tools: Functional
⚡ Performance: Optimal
```

## 🚨 Common Issues

### Installation Issues

#### Issue: `command not found: moidvk`

**Symptoms**: CLI command not recognized after installation

**Solutions**:

```bash
# Check if globally installed
npm list -g @moikas/moidvk
bun pm ls -g | grep moidvk

# Reinstall globally
bun install -g @moikas/moidvk

# Check PATH
echo $PATH
which moidvk

# Use npx as alternative
npx @moikas/moidvk --version
```

#### Issue: Permission denied during installation

**Symptoms**: `EACCES` or permission errors during `npm install -g`

**Solutions**:

```bash
# Fix npm permissions (Linux/macOS)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.bun

# Use npm prefix (alternative)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Use sudo (not recommended)
sudo npm install -g @moikas/moidvk
```

#### Issue: Rust build failures

**Symptoms**: Native module compilation errors

**Solutions**:

```bash
# Update Rust toolchain
rustup update stable

# Install required targets
rustup target add x86_64-unknown-linux-gnu

# Install build dependencies (Ubuntu/Debian)
sudo apt-get install build-essential pkg-config libssl-dev

# Install build dependencies (CentOS/RHEL)
sudo yum groupinstall "Development Tools"
sudo yum install openssl-devel

# Clear cache and rebuild
cd ~/.bun/install/cache/@moikas/moidvk
cargo clean
bun run build:rust

# Use JavaScript fallback
export MOIDVK_USE_JS_FALLBACK=true
```

### Runtime Issues

#### Issue: MCP server fails to start

**Symptoms**: Server crashes or fails to bind to port

**Solutions**:

```bash
# Check port availability
lsof -i :3000
netstat -tulpn | grep 3000

# Use different port
moidvk serve --port 3001

# Check for conflicting processes
ps aux | grep moidvk
pkill -f moidvk

# Start with verbose logging
moidvk serve --verbose

# Check system resources
free -h
df -h
```

#### Issue: Tools return errors or timeouts

**Symptoms**: Individual tools fail with timeout or error messages

**Solutions**:

```bash
# Increase timeout
moidvk check-code -f app.js --timeout 60

# Reduce concurrency
export MOIDVK_MAX_CONCURRENT=2

# Clear cache
moidvk cache clear

# Use JavaScript fallback
MOIDVK_USE_JS_FALLBACK=true moidvk check-code -f app.js

# Check file permissions
ls -la app.js
chmod 644 app.js
```

#### Issue: High memory usage

**Symptoms**: System becomes slow, out of memory errors

**Solutions**:

```bash
# Monitor memory usage
moidvk benchmark --memory

# Reduce concurrent operations
export MOIDVK_MAX_CONCURRENT=2

# Enable streaming mode for large files
moidvk check-code -d src/ --stream

# Increase system swap
sudo swapon --show
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Configuration Issues

#### Issue: Configuration not loaded

**Symptoms**: Custom settings ignored, default behavior used

**Solutions**:

```bash
# Check config file location
ls -la .moidvk.json
ls -la ~/.config/moidvk/config.json

# Validate JSON syntax
cat .moidvk.json | jq .

# Use explicit config path
moidvk check-code -f app.js --config /path/to/config.json

# Check environment variables
env | grep MOIDVK

# Debug config loading
MOIDVK_DEBUG=true moidvk check-code -f app.js
```

#### Issue: MCP client connection failures

**Symptoms**: MCP client can't connect to MOIDVK server

**Solutions**:

```bash
# Test server manually
moidvk serve --test

# Check MCP client configuration
cat ~/.config/claude-desktop/config.json

# Verify command path
which moidvk

# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'

# Check firewall settings
sudo ufw status
sudo iptables -L
```

### Performance Issues

#### Issue: Slow analysis performance

**Symptoms**: Tools take longer than expected to complete

**Solutions**:

```bash
# Enable Rust components
moidvk doctor --check-rust
bun run build:rust

# Enable caching
export MOIDVK_CACHE_ENABLED=true

# Use parallel processing
moidvk check-code -d src/ --parallel

# Profile performance
moidvk benchmark --detailed

# Optimize file patterns
moidvk check-code -f "src/**/*.js" --ignore "node_modules/**"
```

#### Issue: Cache-related problems

**Symptoms**: Stale results, cache corruption errors

**Solutions**:

```bash
# Clear all caches
moidvk cache clear

# Disable caching temporarily
export MOIDVK_CACHE_ENABLED=false

# Check cache directory
ls -la ~/.cache/moidvk/

# Reset cache directory
rm -rf ~/.cache/moidvk/
mkdir -p ~/.cache/moidvk/

# Check disk space
df -h ~/.cache/
```

## 🔧 Platform-Specific Issues

### Linux Issues

#### Issue: Missing system dependencies

**Symptoms**: Build failures, missing library errors

**Solutions**:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential pkg-config libssl-dev python3-dev

# CentOS/RHEL/Fedora
sudo yum groupinstall "Development Tools"
sudo yum install openssl-devel python3-devel

# Arch Linux
sudo pacman -S base-devel openssl python
```

#### Issue: AppImage or Snap conflicts

**Symptoms**: Node.js/Bun version conflicts

**Solutions**:

```bash
# Use system package manager
sudo apt remove nodejs npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bun directly
curl -fsSL https://bun.sh/install | bash
```

### macOS Issues

#### Issue: Xcode Command Line Tools missing

**Symptoms**: Compiler not found, build failures

**Solutions**:

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Update if already installed
sudo xcode-select --reset

# Check installation
xcode-select -p
```

#### Issue: Homebrew conflicts

**Symptoms**: Version conflicts, PATH issues

**Solutions**:

```bash
# Update Homebrew
brew update && brew upgrade

# Fix Homebrew permissions
sudo chown -R $(whoami) $(brew --prefix)/*

# Reset Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Windows Issues

#### Issue: PowerShell execution policy

**Symptoms**: Scripts cannot be executed

**Solutions**:

```powershell
# Check current policy
Get-ExecutionPolicy

# Set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Bypass for single command
powershell -ExecutionPolicy Bypass -Command "moidvk --version"
```

#### Issue: Visual Studio Build Tools missing

**Symptoms**: Native module compilation failures

**Solutions**:

```powershell
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Or use chocolatey
choco install visualstudio2022buildtools

# Or use winget
winget install Microsoft.VisualStudio.2022.BuildTools
```

#### Issue: Windows Defender interference

**Symptoms**: Slow performance, files blocked

**Solutions**:

```powershell
# Add exclusions to Windows Defender
Add-MpPreference -ExclusionPath "C:\Users\%USERNAME%\.bun"
Add-MpPreference -ExclusionPath "C:\Users\%USERNAME%\.npm"
Add-MpPreference -ExclusionPath "C:\Users\%USERNAME%\.cache\moidvk"
```

## 🐛 Error Code Reference

### MOIDVK Error Codes

#### `MOIDVK_001`: Tool execution timeout

**Cause**: Tool took longer than configured timeout **Solution**: Increase timeout or reduce file
size

```bash
moidvk check-code -f app.js --timeout 120
```

#### `MOIDVK_002`: Rust component unavailable

**Cause**: Native Rust modules not built or incompatible **Solution**: Rebuild Rust components or
use JavaScript fallback

```bash
bun run build:rust
# or
export MOIDVK_USE_JS_FALLBACK=true
```

#### `MOIDVK_003`: Configuration parse error

**Cause**: Invalid JSON in configuration file **Solution**: Validate and fix configuration syntax

```bash
cat .moidvk.json | jq .
```

#### `MOIDVK_004`: File access denied

**Cause**: Insufficient permissions to read/write files **Solution**: Check file permissions and
ownership

```bash
chmod 644 file.js
chown $(whoami) file.js
```

#### `MOIDVK_005`: Memory limit exceeded

**Cause**: Analysis requires more memory than available **Solution**: Reduce concurrency or increase
system memory

```bash
export MOIDVK_MAX_CONCURRENT=1
```

#### `MOIDVK_006`: Network connectivity error

**Cause**: Cannot connect to external services (npm registry, etc.) **Solution**: Check network
connection and proxy settings

```bash
npm config get proxy
npm config get https-proxy
```

### System Error Codes

#### Exit Code 1: General error

**Common causes**: Invalid arguments, file not found **Solution**: Check command syntax and file
paths

#### Exit Code 2: Configuration error

**Common causes**: Invalid configuration, missing required settings **Solution**: Validate
configuration file

#### Exit Code 130: Interrupted by user

**Common causes**: Ctrl+C pressed during execution **Solution**: Normal behavior, no action needed

## 🔍 Debugging Techniques

### Enable Debug Mode

```bash
# Enable debug logging
export MOIDVK_DEBUG=true
export MOIDVK_LOG_LEVEL=debug

# Run with debug output
MOIDVK_DEBUG=true moidvk check-code -f app.js

# Save debug output
MOIDVK_DEBUG=true moidvk check-code -f app.js 2> debug.log
```

### Verbose Output

```bash
# Enable verbose mode
moidvk check-code -f app.js --verbose

# Maximum verbosity
moidvk check-code -f app.js -vvv
```

### Performance Profiling

```bash
# Profile tool execution
moidvk benchmark --tool check_code_practices

# Memory profiling
moidvk benchmark --memory --tool check_code_practices

# Detailed timing
time moidvk check-code -f app.js
```

### Network Debugging

```bash
# Test MCP server connectivity
curl -v http://localhost:3000/health

# Check DNS resolution
nslookup registry.npmjs.org

# Test with different network
moidvk scan-security --offline
```

## 🛠️ Recovery Procedures

### Complete Reset

```bash
# Uninstall completely
bun remove -g @moikas/moidvk
npm uninstall -g @moikas/moidvk

# Remove all data
rm -rf ~/.moidvk
rm -rf ~/.config/moidvk
rm -rf ~/.cache/moidvk

# Clear npm/bun cache
npm cache clean --force
bun pm cache rm

# Fresh installation
bun install -g @moikas/moidvk

# Verify installation
moidvk doctor
```

### Rebuild Native Components

```bash
# Navigate to installation directory
cd $(npm root -g)/@moikas/moidvk

# Clean and rebuild
cargo clean
bun run build:rust
bun run build:napi

# Test rebuilt components
moidvk doctor --check-rust
```

### Reset Configuration

```bash
# Backup current config
cp .moidvk.json .moidvk.json.backup

# Generate default config
moidvk config init

# Restore specific settings
moidvk config set tools.check_code_practices.production true
```

## 📊 Performance Optimization

### System Optimization

```bash
# Increase file descriptor limits
ulimit -n 4096

# Optimize for SSD
echo madvise | sudo tee /sys/kernel/mm/transparent_hugepage/enabled

# Increase inotify limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### MOIDVK Optimization

```bash
# Enable all performance features
export MOIDVK_USE_RUST=true
export MOIDVK_CACHE_ENABLED=true
export MOIDVK_MAX_CONCURRENT=4

# Optimize for your workflow
moidvk config set performance.caching.enabled true
moidvk config set performance.parallel.maxConcurrent 4
moidvk config set performance.rust.enabled true
```

## 🆘 Getting Help

### Self-Help Resources

1. **Run diagnostics**: `moidvk doctor --verbose`
2. **Check logs**: `~/.cache/moidvk/logs/`
3. **Review configuration**: `moidvk config show`
4. **Test individual tools**: `moidvk <tool> --help`

### Community Support

- **[GitHub Issues](https://github.com/moikas-code/moidvk/issues)** - Bug reports and feature
  requests
- **[Discussions](https://github.com/moikas-code/moidvk/discussions)** - Community Q&A
- **[Discord](https://discord.gg/moidvk)** - Real-time support

### Reporting Issues

When reporting issues, include:

```bash
# System information
moidvk doctor --verbose > system-info.txt

# Error logs
cat ~/.cache/moidvk/logs/error.log

# Configuration
cat .moidvk.json

# Environment
env | grep MOIDVK
```

### Emergency Contacts

For critical production issues:

- **Email**: support@moidvk.dev
- **Priority Support**: Available for enterprise users

---

**Still having issues?** Create a [GitHub issue](https://github.com/moikas-code/moidvk/issues/new)
with your diagnostic output and we'll help you resolve it quickly.
