# MCP Integration Guide

This guide explains how to integrate MOIDVK with various Model Context Protocol (MCP) clients, including Claude Desktop, Cursor, VS Code, and Neovim.

## 🎯 What is MCP?

The Model Context Protocol (MCP) is a standard that allows AI assistants to interact with external tools and data sources. MOIDVK implements this protocol to provide development tools directly within your AI-powered editor.

## 📋 Prerequisites

Before integrating MOIDVK with your MCP client:

1. **Install MOIDVK** - Follow the [Installation Guide](installation.md)
2. **Verify Installation** - Run `moidvk --help` to confirm it's working
3. **Choose Your MCP Client** - Select from the supported clients below

## 🔧 Claude Desktop Integration

Claude Desktop is the official desktop application for Claude AI, providing a native experience with MCP support.

### Step 1: Install Claude Desktop

1. Download from [claude.ai/download](https://claude.ai/download)
2. Install and launch the application
3. Sign in with your Anthropic account

### Step 2: Configure MCP Server

1. Open Claude Desktop
2. Go to **Settings** (gear icon)
3. Navigate to **MCP Servers**
4. Click **Add Server**

### Step 3: Server Configuration

Add the following configuration:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Step 4: Test Integration

1. Restart Claude Desktop
2. Start a new conversation
3. Test with a simple command:

```
"Check this code for best practices:
const x = 1
if (x == '1') console.log('match')"
```

### Claude Desktop Features

- **Native Integration**: Seamless tool usage within conversations
- **Context Awareness**: Tools understand your current conversation
- **Multi-tool Support**: Use multiple MOIDVK tools in sequence
- **Error Handling**: Graceful error messages and suggestions

## 🖥️ Cursor Integration

Cursor is a modern AI-powered code editor with built-in MCP support.

### Step 1: Install Cursor

1. Download from [cursor.sh](https://cursor.sh/)
2. Install and launch Cursor
3. Sign in with your account

### Step 2: Configure MCP Server

1. Open Cursor
2. Go to **Settings** (Cmd/Ctrl + ,)
3. Navigate to **Extensions** → **MCP**
4. Click **Add Server**

### Step 3: Server Configuration

Add the following configuration:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Step 4: Test Integration

1. Restart Cursor
2. Open a JavaScript file
3. Use the command palette (Cmd/Ctrl + Shift + P)
4. Type "MCP" to see available commands
5. Test with a code quality check

### Cursor-Specific Features

- **File Context**: Tools automatically work with open files
- **Inline Suggestions**: Get suggestions directly in your code
- **Command Palette**: Quick access to MCP tools
- **Multi-file Support**: Analyze entire projects

## 🔧 VS Code Integration

VS Code can be extended with MCP support through extensions.

### Step 1: Install MCP Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "MCP" or "Model Context Protocol"
4. Install the MCP extension

### Step 2: Configure MCP Server

1. Open VS Code settings (Ctrl+,)
2. Search for "mcp"
3. Add server configuration:

```json
{
  "mcp.servers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Step 3: Test Integration

1. Restart VS Code
2. Open a JavaScript file
3. Use the command palette (Ctrl+Shift+P)
4. Type "MCP" to access tools

## 🐍 Neovim Integration

Neovim can be configured with MCP support through plugins.

### Step 1: Install MCP Plugin

Add to your `init.lua` or `init.vim`:

```lua
-- Using lazy.nvim
{
  "mcp-plugins/mcp.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  config = function()
    require("mcp").setup({
      servers = {
        moidvk = {
          command = "moidvk",
          args = { "serve" },
          env = {
            NODE_ENV = "development"
          }
        }
      }
    })
  end
}
```

### Step 2: Configure Keybindings

Add keybindings to your Neovim config:

```lua
-- MCP tool keybindings
vim.keymap.set("n", "<leader>mc", "<cmd>MCPCheckCode<cr>", { desc = "Check code quality" })
vim.keymap.set("n", "<leader>mf", "<cmd>MCPFormatCode<cr>", { desc = "Format code" })
vim.keymap.set("n", "<leader>ms", "<cmd>MCPScanSecurity<cr>", { desc = "Scan security" })
```

## 🔧 Advanced Configuration

### Environment Variables

Configure environment-specific settings:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "false",
        "LOG_LEVEL": "info",
        "SECURITY_LEVEL": "strict",
        "EXPLICIT_CONSENT": "true"
      }
    }
  }
}
```

### Multiple Server Instances

Run multiple MOIDVK instances for different purposes:

```json
{
  "mcpServers": {
    "moidvk-dev": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "true"
      }
    },
    "moidvk-prod": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "production",
        "SECURITY_LEVEL": "strict"
      }
    }
  }
}
```

### Custom Server Paths

If MOIDVK is not in your PATH:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "/full/path/to/moidvk",
      "args": ["serve"]
    }
  }
}
```

## 🧪 Testing Your Integration

### Basic Functionality Test

Test that MOIDVK is working correctly:

```
"Test MOIDVK integration by checking this code:
const x = 1
if (x == '1') console.log('match')"
```

Expected response should include:
- Tool usage confirmation
- Code analysis results
- Specific recommendations

### Tool Availability Test

Check which tools are available:

```
"What MOIDVK tools are available to you?"
```

You should see a list of available tools like:
- `check_code_practices`
- `format_code`
- `check_safety_rules`
- `scan_security_vulnerabilities`
- `check_production_readiness`
- `check_accessibility`
- `check_graphql_schema`
- `check_graphql_query`
- `check_redux_patterns`
- Filesystem tools

### Error Handling Test

Test error handling with invalid input:

```
"Check this invalid code:
function test() {
  return
}"
```

## 🚨 Troubleshooting

### Common Integration Issues

#### "Server connection failed"

**Symptoms**: MCP client can't connect to MOIDVK

**Solutions**:
```bash
# Check if server is running
moidvk serve

# Verify command path
which moidvk

# Check permissions
ls -la $(which moidvk)
```

#### "Command not found"

**Symptoms**: MCP client reports command not found

**Solutions**:
```bash
# Reinstall globally
bun install -g moidvk

# Check PATH
echo $PATH

# Test command directly
moidvk --help
```

#### "Permission denied"

**Symptoms**: Permission errors when starting server

**Solutions**:
```bash
# Fix permissions
chmod +x $(which moidvk)

# Check ownership
ls -la $(which moidvk)
```

#### "Tool not available"

**Symptoms**: Specific tools not showing up

**Solutions**:
```bash
# Check server logs
moidvk serve --verbose

# Verify tool registration
moidvk --help
```

### Client-Specific Issues

#### Claude Desktop Issues

- **Restart Required**: Always restart after configuration changes
- **Configuration Location**: Check `~/Library/Application Support/Claude/` (macOS) or `%APPDATA%\Claude\` (Windows)
- **Logs**: Check console logs for detailed error messages

#### Cursor Issues

- **Extension Conflicts**: Disable conflicting extensions
- **Workspace Settings**: Check `.vscode/settings.json` for conflicts
- **Command Palette**: Use Cmd/Ctrl + Shift + P to access MCP commands

#### VS Code Issues

- **Extension Version**: Ensure MCP extension is up to date
- **Settings Conflicts**: Check for conflicting settings
- **Workspace Trust**: Ensure workspace is trusted

#### Neovim Issues

- **Plugin Dependencies**: Ensure all dependencies are installed
- **Lua Version**: Check Lua version compatibility
- **Keybindings**: Verify keybindings are not conflicting

### Debug Mode

Enable debug mode for detailed troubleshooting:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve", "--debug"],
      "env": {
        "DEBUG": "true",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Log Analysis

Check logs for specific error messages:

```bash
# Run server with verbose logging
moidvk serve --verbose

# Check system logs
journalctl -u moidvk  # Linux
log show --predicate 'process == "moidvk"'  # macOS
```

## 🔄 Updating Integration

### Updating MOIDVK

```bash
# Update from source
cd /path/to/moidvk
git pull
bun install
bun link

# Or update global installation
bun install -g moidvk@latest
```

### Updating MCP Client

- **Claude Desktop**: Updates automatically
- **Cursor**: Updates automatically
- **VS Code**: Update MCP extension
- **Neovim**: Update MCP plugin

### Configuration Migration

When updating, check for configuration changes:

1. **Backup Configuration**: Save current MCP settings
2. **Check Changelog**: Review [changelog.md](changelog.md)
3. **Update Configuration**: Apply any new required settings
4. **Test Integration**: Verify everything still works

## 📚 Best Practices

### Security Considerations

- **Explicit Consent**: Enable explicit consent for sensitive operations
- **Path Restrictions**: Configure workspace boundaries
- **Logging**: Monitor logs for unusual activity
- **Updates**: Keep MOIDVK and clients updated

### Performance Optimization

- **Resource Limits**: Set appropriate file size and timeout limits
- **Caching**: Enable embedding caching for better performance
- **Background Processing**: Use background mode for long-running operations

### Workflow Integration

- **Pre-commit Hooks**: Integrate MOIDVK into your Git workflow
- **CI/CD Pipeline**: Add MOIDVK checks to your build process
- **Code Reviews**: Use MOIDVK tools during code reviews

## 🆘 Getting Help

If you encounter issues with MCP integration:

1. **Check this troubleshooting section**
2. **Review the [Troubleshooting Guide](troubleshooting.md)**
3. **Search existing issues** in the GitHub repository
4. **Create a new issue** with detailed information:
   - MCP client and version
   - MOIDVK version
   - Error messages and logs
   - Steps to reproduce

---

**Integration Complete!** 🎉 Your MCP client is now connected to MOIDVK. Proceed to the [Tool Reference](tool-reference.md) to learn about all available tools.