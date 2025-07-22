# Getting Started with MOIDVK

Welcome to MOIDVK - The Ultimate DevKit! This guide will help you get up and running quickly with
our comprehensive development toolkit.

## 🎯 What is MOIDVK?

MOIDVK is a Model Context Protocol (MCP) server that provides 37+ intelligent development tools for
JavaScript/TypeScript, Rust, and Python. It combines code analysis, security scanning, performance
optimization, and intelligent development assistance into a single, powerful toolkit.

## 🚀 Quick Start (5 Minutes)

### 1. Install MOIDVK

```bash
# Using Bun (recommended)
bun install -g @moikas/moidvk

# Verify installation
moidvk --version
```

### 2. Start the MCP Server

```bash
# Start the server
moidvk serve

# Server will start on default port with all tools available
```

### 3. Configure Your MCP Client

#### Claude Desktop

Add to your `~/.config/claude-desktop/config.json`:

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

#### Other MCP Clients

```json
{
  "servers": {
    "moidvk": {
      "command": "moidvk serve",
      "description": "MOIDVK - The Ultimate DevKit"
    }
  }
}
```

### 4. Test Your Setup

```bash
# Test the MCP server
moidvk serve --test

# Run a quick diagnostic
moidvk doctor
```

## 🛠️ First Steps with Tools

### Analyze JavaScript Code

```bash
# Create a test file
echo "const x = 1; console.log(x);" > test.js

# Analyze with MOIDVK
moidvk check-code -f test.js
```

### Format Code

```bash
# Format JavaScript
moidvk format -f test.js

# Format Rust
echo "fn main(){println!(\"Hello\");}" > test.rs
moidvk rust-format -f test.rs
```

### Security Scan

```bash
# Scan project for vulnerabilities
moidvk scan-security

# Check production readiness
moidvk check-production -f test.js
```

## 🎨 Using with MCP Clients

### With Claude Desktop

Once configured, you can use MOIDVK tools directly in Claude conversations:

```
User: "Analyze this JavaScript code for best practices"
[paste your code]

Claude: I'll analyze your code using MOIDVK's code practices checker...
[uses check_code_practices tool]
```

### With VS Code MCP Extension

1. Install the MCP extension for VS Code
2. Add MOIDVK to your MCP configuration
3. Use tools via the command palette or inline suggestions

### Programmatic Usage

```javascript
import { createMCPClient } from '@modelcontextprotocol/client';

const client = createMCPClient({
  command: 'moidvk',
  args: ['serve'],
});

// Analyze code
const result = await client.callTool('check_code_practices', {
  code: 'const x = 1;',
  production: true,
});

console.log(result);
```

## 🔧 Essential Tools Overview

### Code Quality Tools

- **`check_code_practices`** - ESLint analysis for JavaScript/TypeScript
- **`rust_code_practices`** - Clippy analysis for Rust
- **`python_code_analyzer`** - Ruff analysis for Python

### Formatting Tools

- **`format_code`** - Prettier formatting for JS/TS/CSS/HTML/MD
- **`rust_formatter`** - rustfmt for Rust code
- **`python_formatter`** - Black formatting for Python

### Security Tools

- **`scan_security_vulnerabilities`** - Dependency vulnerability scanning
- **`check_safety_rules`** - NASA JPL safety rules compliance
- **`python_security_scanner`** - Bandit security analysis

### Production Tools

- **`check_production_readiness`** - Production deployment validation
- **`check_accessibility`** - WCAG accessibility compliance
- **`bundle_size_analyzer`** - Bundle size optimization

## 📊 Example Workflows

### 1. Code Review Workflow

```bash
# 1. Analyze code quality
moidvk check-code -f src/

# 2. Check security
moidvk scan-security

# 3. Verify accessibility
moidvk check-accessibility -f src/components/

# 4. Check production readiness
moidvk check-production -f src/ --strict
```

### 2. Pre-Commit Workflow

```bash
# Format all code
moidvk format -f src/

# Run quality checks
moidvk check-code -f src/ --production

# Security scan
moidvk scan-security --severity high

# Performance check
moidvk js-performance -f src/
```

### 3. CI/CD Integration

```yaml
# .github/workflows/moidvk.yml
name: MOIDVK Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install MOIDVK
        run: bun install -g @moikas/moidvk

      - name: Code Quality Check
        run: moidvk check-code -f src/ --production

      - name: Security Scan
        run: moidvk scan-security --severity medium

      - name: Production Readiness
        run: moidvk check-production -f src/ --strict
```

## 🧠 Intelligent Features

### Semantic Code Search

```bash
# Search for authentication logic
moidvk search-semantic --query "authentication logic" --path src/

# Find similar code patterns
moidvk search-semantic --query "error handling" --type similar_code
```

### Development Session Management

```bash
# Start a development session
moidvk session start --project myapp

# Resume previous session
moidvk session resume --id session-123

# Export session data
moidvk session export --format json
```

### Intelligent Tool Routing

```bash
# Let MOIDVK choose the best tools for your project
moidvk analyze --intelligent --path src/

# Optimize tool sequence for performance
moidvk analyze --optimize --goals "security,performance"
```

## 📈 Performance Tips

### 1. Use Native Rust Components

```bash
# Ensure Rust components are built
moidvk doctor --check-rust

# Rebuild if needed
bun run build:rust
```

### 2. Enable Caching

```bash
# Enable result caching
export MOIDVK_CACHE_ENABLED=true
export MOIDVK_CACHE_TTL=3600

# Clear cache if needed
moidvk cache clear
```

### 3. Parallel Processing

```bash
# Run multiple tools in parallel
moidvk analyze --parallel --max-concurrent 5
```

## 🔍 Common Use Cases

### Frontend Development

```bash
# React/Vue/Angular projects
moidvk check-code -f src/ --framework react
moidvk check-accessibility -f src/components/
moidvk bundle-size -f dist/
```

### Backend Development

```bash
# Node.js/Express projects
moidvk check-code -f src/ --production
moidvk scan-security --include-dev false
moidvk js-performance -f src/ --focus node
```

### Full-Stack Projects

```bash
# Comprehensive analysis
moidvk analyze --all --path .
moidvk check-production --strict
moidvk scan-security --severity low
```

### Rust Projects

```bash
# Rust development workflow
moidvk rust-practices -f src/
moidvk rust-safety -f src/
moidvk rust-performance -f src/
moidvk rust-production -f src/
```

### Python Projects

```bash
# Python development workflow
moidvk python-analyze -f src/
moidvk python-security -f src/
moidvk python-test -f tests/
moidvk python-deps --check-outdated
```

## 🔧 Configuration

### Basic Configuration

Create `.moidvk.json` in your project root:

```json
{
  "defaultLanguage": "javascript",
  "strictMode": true,
  "caching": {
    "enabled": true,
    "ttl": 3600
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "severity": "warning"
    },
    "scan_security_vulnerabilities": {
      "severity": "medium"
    }
  }
}
```

### Environment Variables

```bash
# Performance settings
export MOIDVK_MAX_CONCURRENT=5
export MOIDVK_TIMEOUT=30000

# Feature flags
export MOIDVK_USE_RUST=true
export MOIDVK_ENABLE_CACHE=true

# Logging
export MOIDVK_LOG_LEVEL=info
export MOIDVK_LOG_FORMAT=json
```

## 🆘 Getting Help

### Built-in Help

```bash
# General help
moidvk --help

# Tool-specific help
moidvk check-code --help

# Diagnostic information
moidvk doctor --verbose
```

### Documentation

- **[Tool Reference](../technical/tool-reference.md)** - Complete tool documentation
- **[Configuration Guide](../technical/configuration.md)** - Advanced configuration
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

### Community Support

- **[GitHub Issues](https://github.com/moikas-code/moidvk/issues)** - Bug reports and feature
  requests
- **[Discussions](https://github.com/moikas-code/moidvk/discussions)** - Community Q&A
- **[Discord](https://discord.gg/moidvk)** - Real-time community support

## 🎯 Next Steps

Now that you're set up with MOIDVK, explore these advanced features:

1. **[CLI Usage Guide](cli-usage.md)** - Master the command-line interface
2. **[Workflow Examples](workflow-examples.md)** - Real-world usage patterns
3. **[Integration Guide](../technical/mcp-integration.md)** - Advanced MCP integration
4. **[Performance Optimization](../technical/performance.md)** - Optimize for your workflow

---

**Ready to dive deeper?** Check out our
[comprehensive tool reference](../technical/tool-reference.md) to explore all 37+ available tools!
