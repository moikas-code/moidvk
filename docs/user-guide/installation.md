# Installation Guide

This guide covers all installation methods for MOIDVK across different platforms and environments.

## 📋 Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows
- **Memory**: Minimum 2GB RAM, 4GB recommended
- **Storage**: 500MB free space for installation
- **Network**: Internet connection for initial setup and updates

### Runtime Requirements

- **Bun** v1.0+ (recommended) or **Node.js** v18+
- **Rust** v1.70+ (for building native components)
- **Python** v3.8+ (optional, for Python tool integration)

## 🚀 Quick Installation

### Using Bun (Recommended)

```bash
# Install globally
bun install -g @moikas/moidvk

# Verify installation
moidvk --version
```

### Using npm

```bash
# Install globally
npm install -g @moikas/moidvk

# Verify installation
moidvk --version
```

### Using yarn

```bash
# Install globally
yarn global add @moikas/moidvk

# Verify installation
moidvk --version
```

## 🔧 Platform-Specific Installation

### Linux (Ubuntu/Debian)

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install MOIDVK
bun install -g @moikas/moidvk
```

### macOS

```bash
# Install Bun using Homebrew
brew install oven-sh/bun/bun

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install MOIDVK
bun install -g @moikas/moidvk
```

### Windows

```powershell
# Install Bun
powershell -c "irm bun.sh/install.ps1 | iex"

# Install Rust
# Download and run rustup-init.exe from https://rustup.rs/

# Install MOIDVK
bun install -g @moikas/moidvk
```

## 🏗️ Building from Source

### Clone and Build

```bash
# Clone the repository
git clone https://github.com/moikas-code/moidvk.git
cd moidvk

# Install dependencies
bun install

# Build Rust components
bun run build:rust

# Build NAPI bindings
bun run build:napi

# Install globally from source
bun link
```

### Development Build

```bash
# Clone repository
git clone https://github.com/moikas-code/moidvk.git
cd moidvk

# Install dependencies
bun install

# Build in development mode
bun run build:rust:debug
bun run build:napi:debug

# Start development server
bun run dev
```

## 🐳 Docker Installation

### Using Docker

```bash
# Pull the official image
docker pull moikas/moidvk:latest

# Run as MCP server
docker run -p 3000:3000 moikas/moidvk:latest serve

# Run with volume mount for project analysis
docker run -v $(pwd):/workspace moikas/moidvk:latest analyze /workspace
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  moidvk:
    image: moikas/moidvk:latest
    ports:
      - '3000:3000'
    volumes:
      - ./:/workspace
    command: serve
    environment:
      - MOIDVK_LOG_LEVEL=info
```

## 🔧 Post-Installation Setup

### Verify Installation

```bash
# Check version
moidvk --version

# Test MCP server
moidvk serve --test

# Run diagnostics
moidvk doctor
```

### Configure MCP Client

#### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {}
    }
  }
}
```

#### VS Code with MCP Extension

```json
{
  "mcp.servers": [
    {
      "name": "moidvk",
      "command": "moidvk serve",
      "description": "MOIDVK - The Ultimate DevKit"
    }
  ]
}
```

## 🔍 Troubleshooting Installation

### Common Issues

#### Rust Build Failures

```bash
# Update Rust toolchain
rustup update

# Install required targets
rustup target add x86_64-unknown-linux-gnu

# Clear cache and rebuild
cargo clean
bun run build:rust
```

#### Permission Errors

```bash
# Fix npm permissions (Linux/macOS)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/.bun

# Use npx for one-time execution
npx @moikas/moidvk serve
```

#### Native Module Issues

```bash
# Rebuild native modules
bun run build:napi

# Check system compatibility
moidvk doctor --verbose

# Use JavaScript fallback
MOIDVK_USE_JS_FALLBACK=true moidvk serve
```

### Platform-Specific Issues

#### Linux: Missing Dependencies

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential pkg-config libssl-dev

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install openssl-devel
```

#### macOS: Xcode Command Line Tools

```bash
# Install Xcode command line tools
xcode-select --install

# Update if already installed
sudo xcode-select --reset
```

#### Windows: Visual Studio Build Tools

```powershell
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Or use chocolatey
choco install visualstudio2022buildtools
```

## 🔄 Updating MOIDVK

### Automatic Updates

```bash
# Update to latest version
bun update -g @moikas/moidvk

# Check for updates
moidvk update --check

# Update with automatic rebuild
moidvk update --rebuild
```

### Manual Updates

```bash
# Uninstall current version
bun remove -g @moikas/moidvk

# Install latest version
bun install -g @moikas/moidvk@latest

# Verify update
moidvk --version
```

## 🗑️ Uninstallation

### Complete Removal

```bash
# Uninstall package
bun remove -g @moikas/moidvk

# Remove configuration files
rm -rf ~/.moidvk
rm -rf ~/.config/moidvk

# Remove cache
rm -rf ~/.cache/moidvk
```

### Clean Reinstall

```bash
# Complete removal
bun remove -g @moikas/moidvk
rm -rf ~/.moidvk ~/.config/moidvk ~/.cache/moidvk

# Fresh installation
bun install -g @moikas/moidvk

# Verify clean install
moidvk doctor
```

## 📊 Installation Verification

### Health Check

```bash
# Comprehensive system check
moidvk doctor

# Test all tools
moidvk test --all

# Performance benchmark
moidvk benchmark --quick
```

### Expected Output

```
✅ MOIDVK v1.0.0 installed successfully
✅ Rust core: Available (native)
✅ Python tools: Available
✅ MCP server: Ready
✅ All 37 tools: Functional
⚡ Performance: Optimal
```

## 🆘 Getting Help

If you encounter issues during installation:

1. **Check the [Troubleshooting Guide](troubleshooting.md)**
2. **Run diagnostics**: `moidvk doctor --verbose`
3. **Check system requirements** above
4. **Search [existing issues](https://github.com/moikas-code/moidvk/issues)**
5. **Create a new issue** with diagnostic output

---

**Next Steps**: Once installed, check out the [Getting Started Guide](getting-started.md) to begin
using MOIDVK.
