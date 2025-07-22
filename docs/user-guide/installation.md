# Installation Guide

This comprehensive guide covers installation and setup for MOIDVK across different platforms and MCP clients.

## 📋 System Requirements

### Minimum Requirements
- **Operating System**: macOS 10.15+, Windows 10+, or Linux (Ubuntu 18.04+)
- **Node.js**: 18.0.0 or higher
- **Bun**: 1.0.0 or higher
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 2GB free space
- **Network**: Internet connection for initial setup

### Recommended Requirements
- **Operating System**: Latest stable version
- **Node.js**: 20.0.0 or higher
- **Bun**: Latest stable version
- **Memory**: 8GB RAM or higher
- **Storage**: 5GB free space
- **Network**: Stable internet connection

## 🚀 Installation Methods

### Method 1: Install from Source (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/moidvk.git
cd moidvk

# Install dependencies using Bun
bun install

# Create a global link
bun link

# Verify the CLI is available
moidvk --help
```

### Method 2: Global Installation via Package Manager

#### Using Bun (Recommended)
```bash
# Install globally
bun install -g moidvk

# Verify installation
moidvk --version
```

#### Using npm
```bash
# Install globally
npm install -g moidvk

# Verify installation
moidvk --version
```

### Method 3: Docker Installation

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build
EXPOSE 3000
ENTRYPOINT ["bun", "run", "serve"]
```

## 🔧 Platform-Specific Instructions

### macOS Installation

#### Using Homebrew (Recommended)
```bash
# Install Bun via Homebrew
brew install bun

# Install MOIDVK
bun install -g moidvk
```

#### Manual Installation
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH (add to ~/.zshrc or ~/.bash_profile)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install MOIDVK
bun install -g moidvk
```

### Windows Installation

#### Using Chocolatey
```bash
# Install Bun
choco install bun

# Install MOIDVK
bun install -g moidvk
```

#### Using PowerShell
```bash
# Install Bun
powershell -c "irm bun.sh/install.ps1 | iex"

# Install MOIDVK
bun install -g moidvk
```

### Linux Installation

#### Ubuntu/Debian
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Install MOIDVK
bun install -g moidvk
```

## 🖥️ MCP Client Setup

### Claude Desktop Configuration

#### Prerequisites
1. Claude Desktop installed and running
2. MOIDVK installed on your system
3. Bun installed on your system

#### Configuration Steps

1. **Locate Claude Desktop Settings**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Add MCP Server Configuration**
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

3. **Alternative Configuration (Direct Path)**
   ```json
   {
     "mcpServers": {
       "moidvk": {
         "command": "bun",
         "args": ["run", "/absolute/path/to/@moidvk/server.js"],
         "env": {}
       }
     }
   }
   ```

4. **Restart Claude Desktop**

#### Verifying Claude Desktop Connection
1. Open Claude Desktop
2. Start a new conversation
3. Ask: "Can you check if this JavaScript code follows best practices?"
4. Provide some JavaScript code
5. Claude should use the `check_code_practices` tool automatically

### Cursor Configuration

#### Recommended Configuration (Simple)
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

#### Configuration Steps
1. **Locate your Cursor MCP configuration file:**
   - Usually at: `~/.config/cursor/mcp.json`
   - Or sometimes: `~/.cursor/mcp.json`

2. **Add the moidvk server configuration using the simple command above**

#### Alternative Configurations

**Direct server.js approach:**
```json
{
  "mcpServers": {
    "moidvk": {
      "command": "/Users/username/.bun/bin/bun",
      "args": ["run", "/Users/username/Documents/code/@moidvk/server.js"],
      "env": {
        "MCP_SECURITY_MODE": "block",
        "MCP_SECURITY_ENABLED": "true"
      }
    }
  }
}
```

**Using npm/node instead of bun:**
```json
{
  "mcpServers": {
    "moidvk": {
      "command": "node",
      "args": ["/path/to/@moidvk/server.js"],
      "env": {
        "MCP_SECURITY_MODE": "block"
      }
    }
  }
}
```

**Using npx:**
```json
{
  "mcpServers": {
    "moidvk": {
      "command": "npx",
      "args": ["moidvk"],
      "cwd": "/path/to/@moidvk"
    }
  }
}
```

#### Verifying Cursor Connection
Once configured, restart Cursor and check if the moidvk tools appear:
- Look for tools like: `check_code_practices`, `format_code`, `check_safety_rules`, etc.
- Try using a tool: "Check this code with moidvk: console.log('test')"

### VS Code Configuration

1. **Install MCP Extension**
2. **Open Settings** (Cmd/Ctrl + ,)
3. **Search for "mcp"**
4. **Add Configuration:**
   ```json
   {
     "mcp.servers": {
       "moidvk": {
         "command": "moidvk",
         "args": ["serve"]
       }
     }
   }
   ```
5. **Restart VS Code**

## ✅ Verification and Testing

### Basic Verification
```bash
# Check installation
moidvk --version

# Check dependencies
bun list

# Run tests
bun test
```

### Integration Testing
```bash
# Test MCP server
bun run dev

# In another terminal, test CLI
echo "const x = 1" | moidvk check-code

# Test code formatting
echo "const x=1;const y=2;" | moidvk format

# Test security scanning
moidvk scan-security
```

### Manual Integration Test
```bash
# Run comprehensive test
bun run test/manual-test.js
```

## 🔧 Configuration

### Global Configuration
Create `~/.moidvk/config.json`:
```json
{
  "defaults": {
    "security_level": "balanced",
    "explicit_consent": true,
    "max_file_size": 10485760,
    "timeout": 30000
  },
  "tools": {
    "check_code_practices": {
      "production": false,
      "strict": false
    },
    "format_code": {
      "check_only": false
    }
  }
}
```

### Project-Specific Configuration
Create `.moidvk.json` in your project root:
```json
{
  "project": {
    "name": "my-project",
    "security_level": "strict",
    "explicit_consent": true
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "strict": true
    }
  }
}
```

## 🚨 Troubleshooting

### Common Installation Issues

#### "Command not found: moidvk"
```bash
# Check if bun is in PATH
which bun

# Reinstall globally
bun install -g moidvk

# Check installation location
bun pm bin
```

#### "Permission denied"
```bash
# Fix permissions
chmod +x bin/moidvk

# Or install with sudo (not recommended)
sudo bun install -g moidvk
```

#### "Module not found" errors
```bash
# Clear cache and reinstall
bun pm cache rm
bun install

# Check node_modules
ls node_modules
```

### MCP Client Connection Issues

#### Server Not Connecting
1. Check the path in your configuration is absolute, not relative
2. Ensure the server.js file exists at the specified path
3. Verify Bun is installed and available in your PATH
4. Check MCP client logs for error messages

#### Permission Issues
On macOS/Linux, ensure the server.js file has execute permissions:
```bash
chmod +x /path/to/@moidvk/server.js
```

#### Viewing Logs
To see server logs, you can run the server manually:
```bash
cd /path/to/@moidvk
bun run server.js
```

### Platform-Specific Issues

#### macOS Issues
```bash
# Fix Homebrew permissions
sudo chown -R $(whoami) /usr/local/bin /usr/local/lib /usr/local/sbin
chmod u+w /usr/local/bin /usr/local/lib /usr/local/sbin

# Reinstall Bun
brew uninstall bun
brew install bun
```

#### Windows Issues
```bash
# Run PowerShell as Administrator
# Set execution policy
Set-ExecutionPolicy RemoteSigned

# Reinstall Bun
irm bun.sh/install.ps1 | iex
```

#### Linux Issues
```bash
# Fix PATH issues
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Check permissions
ls -la ~/.bun/bin
```

### Debug Mode
Enable debug mode for detailed troubleshooting:
```bash
# Enable debug logging
DEBUG=true moidvk check-code -f app.js

# Verbose output
moidvk check-code -f app.js --debug

# Check server logs
moidvk serve --debug
```

## 📚 Next Steps

After successful installation:

1. **Read the [Getting Started Guide](getting-started.md)** - Get up and running quickly
2. **Explore the tools** - Check [Tool Reference](tool-reference.md)
3. **Set up your workflow** - Review [Workflow Examples](workflow-examples.md)
4. **Configure security** - Review [Security Guide](security.md)

## 🆘 Getting Help

If you encounter issues during installation:

1. **Check the [Troubleshooting Guide](troubleshooting.md)**
2. **Search existing issues** in the GitHub repository
3. **Create a new issue** with detailed error information
4. **Contact the support team** for urgent issues

---

**Installation Complete!** 🎉 Now proceed to the [Getting Started Guide](getting-started.md) to begin using MOIDVK.