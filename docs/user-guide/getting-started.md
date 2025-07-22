# Getting Started Guide

Welcome to MOIDVK! This guide will walk you through your first steps with MOIDVK, from installation to running your first code analysis.

## 🎯 What You'll Learn

By the end of this guide, you'll be able to:
- Install MOIDVK on your system
- Configure it with your MCP client
- Run your first code quality check
- Understand the basic workflow
- Troubleshoot common issues

## 📋 Prerequisites

Before you begin, make sure you have:

- **Operating System**: macOS 10.15+, Windows 10+, or Linux (Ubuntu 18.04+)
- **Bun**: Version 1.0.0 or higher
- **MCP Client**: Claude Desktop, Cursor, or another MCP-compatible client
- **Basic Command Line**: Familiarity with terminal/command prompt
- **Internet Connection**: For initial setup and updates

## 🚀 Quick Start (5 Minutes)

### Step 1: Install MOIDVK

```bash
# Install globally with Bun
bun install -g moidvk

# Verify installation
moidvk --version
```

### Step 2: Configure Your MCP Client

#### Claude Desktop
```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"]
    }
  }
}
```

#### Cursor
```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"]
    }
  }
}
```

### Step 3: Test Your Installation

```bash
# Test basic functionality
moidvk --help

# Test code quality checking
echo "const x = 1" | moidvk check-code

# Test code formatting
echo "const x=1;const y=2;" | moidvk format
```

### Step 4: Your First Code Analysis

1. **Restart your MCP client**
2. **Start a new conversation**
3. **Test with a simple command**:

```
"Check this code for best practices:
const x = 1
if (x == '1') console.log('match')"
```

**Expected Response**: Claude should use the `check_code_practices` tool and provide feedback about using `===` instead of `==`.

## 📚 First Steps (Detailed Walkthrough)

### Installation Options

#### Global Installation (Recommended)
```bash
# Install globally
bun install -g moidvk

# Verify installation
moidvk --version
```

#### Local Installation
```bash
# Clone repository
git clone https://github.com/your-org/moidvk.git
cd moidvk

# Install dependencies
bun install

# Create global link
bun link

# Verify installation
moidvk --help
```

### MCP Client Configuration

#### Claude Desktop Setup

1. **Open Claude Desktop**
2. **Go to Settings** (gear icon)
3. **Navigate to MCP Servers**
4. **Click Add Server**
5. **Add Configuration**:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"]
    }
  }
}
```

6. **Restart Claude Desktop**

#### Cursor Setup

1. **Open Cursor**
2. **Go to Settings** (Cmd/Ctrl + ,)
3. **Navigate to Extensions → MCP**
4. **Add Server Configuration**:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"]
    }
  }
}
```

5. **Restart Cursor**

#### VS Code Setup

1. **Install MCP Extension**
2. **Open Settings** (Cmd/Ctrl + ,)
3. **Search for "mcp"**
4. **Add Configuration**:

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

### Testing Your Setup

#### Test via CLI

```bash
# Test basic functionality
moidvk --help

# Test code quality checking
echo "const x = 1" | moidvk check-code

# Test code formatting
echo "const x=1;const y=2;" | moidvk format

# Test server
moidvk serve --test
```

#### Test via MCP Client

1. **Restart your MCP client**
2. **Start a new conversation**
3. **Test with a simple command**:

```
"Check this code for best practices:
const x = 1
if (x == '1') console.log('match')"
```

**Expected Response**: Claude should use the `check_code_practices` tool and provide feedback about using `===` instead of `==`.

## 🎯 Your First Workflow

### Basic Code Quality Check

Create a test file `test.js`:

```javascript
// test.js
var x = 1;
if (x == '1') {
  console.log('match');
}
```

**Check the code**:
```
"Check this code for best practices:
var x = 1;
if (x == '1') {
  console.log('match');
}"
```

**Expected Feedback**:
- Use `const` instead of `var`
- Use `===` instead of `==`
- Remove `console.log` for production

### Code Formatting

**Format the code**:
```
"Format this code:
var x = 1;if (x == '1') {console.log('match');}"
```

**Expected Output**:
```javascript
const x = 1;
if (x === "1") {
  console.log("match");
}
```

### Production Readiness Check

**Check production readiness**:
```
"Check if this code is production ready:
const API_KEY = 'sk-1234'; // TODO: move to env
console.log('Starting server...');
function processPayment() { /* TODO: implement */ }"
```

**Expected Feedback**:
- Hardcoded API key detected
- Console.log statement found
- TODO comment indicates incomplete implementation

## 🛠️ Explore Available Tools

### List Available Tools

```
"What MOIDVK tools are available to you?"
```

**Expected Response**: List of available tools including:
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

### Try Different Tools

#### Safety Analysis
```
"Check this code for safety violations:
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}"
```

#### Security Scanning
```
"Scan my project for security vulnerabilities"
```

#### Accessibility Testing
```
"Check this HTML for accessibility:
<html><head><title>Test</title></head><body>
<img src='logo.jpg'>
<button>Click me</button>
</body></html>"
```

## 📁 Filesystem Operations

### Basic File Operations

#### Create a File
```
"Create a file named config.js with content:
export const API_URL = 'https://api.example.com';
export const DEBUG = false;"
```

#### Read a File
```
"Read the file config.js"
```

#### Update a File
```
"Update config.js to change DEBUG to true"
```

#### List Directory
```
"List all files in the current directory"
```

### Search Operations

#### Search for Files
```
"Search for all JavaScript files"
```

#### Search in Files
```
"Search for 'TODO' in all JavaScript files"
```

## 🔍 Understand the Results

### Code Quality Results

When you run a code quality check, you'll see:

```
🔍 Code Quality Analysis Results:

✅ Passed: 2 checks
⚠️ Warnings: 1 issue
❌ Errors: 1 issue

Issues Found:
- Line 2: Use '===' instead of '==' for comparison (eqeqeq)
- Line 3: Avoid console.log in production code (no-console)

💡 Recommendations:
- Use strict equality operators (===)
- Remove debug statements before production
```

### Understanding Severity Levels

- **✅ Passed**: Code follows best practices
- **⚠️ Warnings**: Minor issues that should be fixed
- **❌ Errors**: Issues that need immediate attention
- **💡 Recommendations**: Suggestions for improvement

### Understanding Tool Output

Each tool provides:
- **Summary**: Overview of results
- **Issues**: Specific problems found
- **Recommendations**: How to fix issues
- **Score**: Numerical assessment (where applicable)

## 🚨 Troubleshooting Common Issues

### "Command not found"

```bash
# Check if bun is in PATH
which bun

# Add bun to PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Reinstall MOIDVK
bun install -g moidvk
```

### "MCP server connection failed"

```bash
# Check if server is running
moidvk serve

# Check configuration
# Verify MCP client configuration is correct
# Restart MCP client
```

### "Permission denied"

```bash
# Fix permissions
chmod +x $(which moidvk)

# Check ownership
ls -la $(which moidvk)
```

### "Tool not available"

```bash
# Check available tools
moidvk list-tools

# Restart MCP client
# Verify tool registration
```

## 📚 Next Steps

### Explore Documentation

1. **Read the [Tool Reference](tool-reference.md)** - Learn about all available tools
2. **Check [Workflow Examples](workflow-examples.md)** - See real-world usage
3. **Review [CLI Usage](cli-usage.md)** - Learn command-line options
4. **Explore [Production Deployment](production-deployment.md)** - Prepare for production

### Set Up Your Workflow

#### Daily Development Workflow

1. **Write Code** → Use your normal development process
2. **Check Quality** → Run `check_code_practices` on new code
3. **Format Code** → Use `format_code` for consistent style
4. **Check Production** → Use `check_production_readiness` before deployment
5. **Scan Security** → Use `scan_security_vulnerabilities` regularly

#### Integration with Your Tools

- **VS Code**: Set up tasks and keybindings
- **Git Hooks**: Add pre-commit checks
- **CI/CD**: Integrate into your build pipeline
- **Code Reviews**: Use MOIDVK tools during reviews

### Advanced Features

#### Custom Configuration

Create `.moidvk.json` in your project:

```json
{
  "project": {
    "name": "my-project",
    "security_level": "strict"
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "strict": true
    }
  }
}
```

#### Batch Processing

```bash
# Check all JavaScript files
find . -name "*.js" -exec moidvk check-code -f {} \;

# Format all files
find . -name "*.js" | xargs -I {} moidvk format -f {} -o {}
```

## 🎉 Congratulations!

You've successfully:
- ✅ Installed MOIDVK
- ✅ Configured your MCP client
- ✅ Run your first code analysis
- ✅ Explored available tools
- ✅ Learned to interpret results
- ✅ Set up your development workflow

## 🆘 Getting Help

### Self-Service Resources

- **Documentation**: [Main Documentation](README.md)
- **Quick Start**: [Quick Start Guide](quick-start.md)
- **Troubleshooting**: [Troubleshooting Guide](troubleshooting.md)
- **Examples**: [Workflow Examples](workflow-examples.md)

### Community Support

- **GitHub Issues**: [Repository Issues](https://github.com/your-org/moidvk/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/moidvk/discussions)
- **Community**: Join the community forums

### Professional Support

- **Email**: support@moidvk.com
- **Documentation**: [Documentation Site](https://docs.moidvk.com)
- **Training**: Request training sessions for your team

## 📈 Tips for Success

### Best Practices

1. **Use MOIDVK Early**: Check code quality from the start
2. **Automate**: Integrate tools into your workflow
3. **Regular Scans**: Schedule security vulnerability scans
4. **Team Adoption**: Share tools with your team
5. **Continuous Learning**: Explore new tools and features

### Pro Tips

- **Golden Rule**: Always use MOIDVK tools before manual analysis
- **Batch Processing**: Use CLI for processing multiple files
- **Customization**: Configure tools for your specific needs
- **Integration**: Connect with your existing tools and workflows
- **Monitoring**: Track improvements over time

---

**Getting Started Complete!** 🎉 You're now ready to use MOIDVK effectively in your development workflow. Remember to explore the advanced features and integrate MOIDVK into your team's processes.