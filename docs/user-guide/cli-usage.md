# CLI Usage Guide

The MOIDVK command-line interface provides direct access to all tools and features without requiring an MCP client. This guide covers all CLI commands, options, and usage patterns.

## 🎯 Overview

The MOIDVK CLI offers:
- **Direct tool access** - Use tools without MCP client
- **Batch processing** - Process multiple files efficiently
- **Pipeline integration** - Integrate with CI/CD workflows
- **Scripting support** - Automate development tasks
- **JSON output** - Machine-readable results

## 📋 Installation

### Global Installation

```bash
# Install globally with Bun
bun install -g moidvk

# Install globally with npm
npm install -g moidvk

# Verify installation
moidvk --version
```

### Local Installation

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

## 🚀 Basic Commands

### Server Commands

#### Start MCP Server

```bash
# Start the MCP server
moidvk serve

# Start with debug mode
moidvk serve --debug

# Start with custom port
moidvk serve --port 3001

# Start with specific environment
moidvk serve --env production
```

**Options:**
- `--debug` - Enable debug logging
- `--port <number>` - Specify port (default: 3000)
- `--env <environment>` - Set environment (development/production)
- `--config <path>` - Use custom configuration file

#### Server Status

```bash
# Check server status
moidvk status

# Get server information
moidvk info
```

### Code Quality Commands

#### Check Code Practices

```bash
# Check code from stdin
echo "const x = 1" | moidvk check-code

# Check specific file
moidvk check-code -f src/index.js

# Check with production rules
moidvk check-code -f src/server.js --production

# Check with strict mode
moidvk check-code -f src/critical.js --strict

# Output JSON format
moidvk check-code -f src/app.js --format json
```

**Options:**
- `-f, --file <path>` - Input file path
- `--production` - Enable production mode (stricter rules)
- `--strict` - Enable strict mode
- `--format <format>` - Output format (text, json, detailed)
- `--limit <number>` - Maximum issues to report (default: 50)
- `--offset <number>` - Starting index for pagination (default: 0)

#### Format Code

```bash
# Format code from stdin
echo "const x=1;const y=2;" | moidvk format

# Format specific file
moidvk format -f src/messy.js

# Format and save to new file
moidvk format -f src/messy.js -o src/clean.js

# Check if formatting is needed
moidvk format -f src/app.js --check

# Format with specific parser
moidvk format -f src/component.tsx --parser typescript
```

**Options:**
- `-f, --file <path>` - Input file path
- `-o, --output <path>` - Output file path
- `--check` - Check if formatting is needed
- `--parser <parser>` - Specify parser (auto-detected by default)

### Safety and Security Commands

#### Check Safety Rules

```bash
# Check safety rules
moidvk check-safety -f src/critical-system.js

# Check with detailed output
moidvk check-safety -f src/rocket-control.js --format detailed

# Check with custom safety level
moidvk check-safety -f src/medical-device.js --level strict
```

**Options:**
- `-f, --file <path>` - Input file path
- `--level <level>` - Safety level (standard, strict, critical)
- `--format <format>` - Output format (text, json, detailed)

#### Scan Security Vulnerabilities

```bash
# Scan current directory
moidvk scan-security

# Scan specific project
moidvk scan-security -p /path/to/project

# Scan production dependencies only
moidvk scan-security --production

# Scan with specific severity
moidvk scan-security --severity high

# Get detailed vulnerability report
moidvk scan-security --format detailed

# Limit results
moidvk scan-security --limit 20
```

**Options:**
- `-p, --path <path>` - Project path (default: current directory)
- `--production` - Scan only production dependencies
- `--severity <level>` - Minimum severity (low, moderate, high, critical)
- `--format <format>` - Output format (summary, detailed)
- `--limit <number>` - Maximum vulnerabilities to report
- `--offset <number>` - Starting index for pagination

### Production Readiness Commands

#### Check Production Readiness

```bash
# Check production readiness
moidvk check-production -f src/server.js

# Check with strict mode
moidvk check-production -f src/api.js --strict

# Check with custom categories
moidvk check-production -f src/app.js --categories todos,console-logs

# Get detailed checklist
moidvk check-production -f src/critical.js --format detailed
```

**Options:**
- `-f, --file <path>` - Input file path
- `--strict` - Enable strict mode
- `--categories <list>` - Specific categories to check
- `--format <format>` - Output format (text, json, detailed)

### Accessibility Commands

#### Check Accessibility

```bash
# Check HTML file
moidvk check-accessibility -f index.html

# Check React component
moidvk check-accessibility -f Component.jsx

# Check with specific standard
moidvk check-accessibility -f page.html --standard AAA

# Check with minimal rules
moidvk check-accessibility -f form.html --rule-set minimal

# Check without contrast validation
moidvk check-accessibility -f app.html --no-contrast
```

**Options:**
- `-f, --file <path>` - Input file path
- `--standard <level>` - WCAG standard (A, AA, AAA)
- `--rule-set <set>` - Rule set (minimal, forms, content, navigation, full)
- `--no-contrast` - Skip color contrast checking
- `--environment <env>` - Environment (development, production)

### GraphQL Commands

#### Check GraphQL Schema

```bash
# Check schema file
moidvk check-graphql-schema -f schema.graphql

# Check with strict mode
moidvk check-graphql-schema -f schema.graphql --strict

# Check with custom limits
moidvk check-graphql-schema -f schema.graphql --limit 30

# Check specific categories
moidvk check-graphql-schema -f schema.graphql --categories security,design
```

**Options:**
- `-f, --file <path>` - Input file path
- `--strict` - Enable strict mode
- `--limit <number>` - Maximum issues to report
- `--categories <list>` - Specific categories to check

#### Check GraphQL Query

```bash
# Check query file
moidvk check-graphql-query -f query.graphql

# Check with custom depth limit
moidvk check-graphql-query -f query.graphql --max-depth 3

# Check with complexity limit
moidvk check-graphql-query -f query.graphql --max-complexity 50

# Check with schema validation
moidvk check-graphql-query -f query.graphql --schema schema.graphql
```

**Options:**
- `-f, --file <path>` - Input file path
- `--max-depth <number>` - Maximum query depth (default: 7)
- `--max-complexity <number>` - Maximum complexity (default: 100)
- `--schema <path>` - Schema file for validation

### Redux Commands

#### Check Redux Patterns

```bash
# Check Redux file
moidvk check-redux -f store.js

# Check with strict mode
moidvk check-redux -f reducer.js --strict

# Check specific code type
moidvk check-redux -f slice.js --code-type slice

# Check with custom limits
moidvk check-redux -f store.js --limit 25
```

**Options:**
- `-f, --file <path>` - Input file path
- `--strict` - Enable strict mode
- `--code-type <type>` - Code type (auto, reducer, action, store, selector, middleware, component)
- `--limit <number>` - Maximum issues to report

## 🔄 Advanced Usage

### Batch Processing

#### Process Multiple Files

```bash
# Check all JavaScript files
find . -name "*.js" -exec moidvk check-code -f {} \;

# Format all TypeScript files
for file in src/**/*.ts; do
  moidvk format -f "$file" -o "$file"
done

# Check all files in parallel
find . -name "*.js" | xargs -P 4 -I {} moidvk check-code -f {}
```

#### Directory Processing

```bash
# Check entire directory
moidvk check-code -d src/

# Format entire directory
moidvk format -d src/ -o formatted/

# Scan security for multiple projects
for project in projects/*; do
  echo "Scanning $project..."
  moidvk scan-security -p "$project"
done
```

### Pipeline Integration

#### Git Hooks

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# Check staged JavaScript files
files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$')
for file in $files; do
  moidvk check-production -f "$file" --strict || exit 1
done
```

#### CI/CD Integration

GitHub Actions example:

```yaml
name: Code Quality Check
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install -g moidvk
      - run: moidvk check-production -f src/index.js --strict
      - run: moidvk scan-security --severity high
```

#### VS Code Tasks

`.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Check Code Quality",
      "type": "shell",
      "command": "moidvk",
      "args": ["check-code", "-f", "${file}"],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    }
  ]
}
```

### Scripting Examples

#### Quality Check Script

```bash
#!/bin/bash
# quality-check.sh

echo "🔍 Running code quality checks..."

# Check all JavaScript files
find . -name "*.js" -not -path "./node_modules/*" | while read file; do
  echo "Checking $file..."
  moidvk check-code -f "$file" --production || exit 1
done

# Check production readiness
find . -name "*.js" -not -path "./node_modules/*" | while read file; do
  echo "Checking production readiness for $file..."
  moidvk check-production -f "$file" --strict || exit 1
done

# Scan for security vulnerabilities
echo "🔒 Scanning for security vulnerabilities..."
moidvk scan-security --severity high || exit 1

echo "✅ All checks passed!"
```

#### Format All Files Script

```bash
#!/bin/bash
# format-all.sh

echo "🎨 Formatting all code files..."

# Format JavaScript files
find . -name "*.js" -not -path "./node_modules/*" | while read file; do
  echo "Formatting $file..."
  moidvk format -f "$file" -o "$file"
done

# Format TypeScript files
find . -name "*.ts" -not -path "./node_modules/*" | while read file; do
  echo "Formatting $file..."
  moidvk format -f "$file" -o "$file"
done

# Format JSX/TSX files
find . -name "*.jsx" -o -name "*.tsx" | grep -v node_modules | while read file; do
  echo "Formatting $file..."
  moidvk format -f "$file" -o "$file"
done

echo "✅ All files formatted!"
```

### JSON Output Processing

#### Parse Results with jq

```bash
# Get issue count
moidvk check-code -f app.js --format json | jq '.issues | length'

# Get high severity issues
moidvk scan-security --format json | jq '.vulnerabilities[] | select(.severity == "high")'

# Get production readiness score
moidvk check-production -f server.js --format json | jq '.score'

# Get accessibility violations
moidvk check-accessibility -f page.html --format json | jq '.violations[] | .description'
```

#### Generate Reports

```bash
#!/bin/bash
# generate-report.sh

echo "📊 Generating quality report..."

# Create report directory
mkdir -p reports

# Generate code quality report
moidvk check-code -f src/ -d src/ --format json > reports/code-quality.json

# Generate security report
moidvk scan-security --format json > reports/security.json

# Generate production readiness report
find . -name "*.js" | head -10 | while read file; do
  moidvk check-production -f "$file" --format json >> reports/production-readiness.json
done

echo "📄 Reports generated in reports/ directory"
```

## 📊 Output Formats

### Text Format (Default)

Human-readable output with emojis and formatting:

```
🔍 Code Quality Analysis Results:

✅ Passed: 3 checks
⚠️ Warnings: 2 issues
❌ Errors: 1 issue

Issues Found:
- Line 2: Use '===' instead of '==' for comparison
- Line 3: Avoid console.log in production code
- Line 1: Consider using 'const' instead of 'var'

💡 Recommendations:
- Use strict equality operators (===)
- Remove debug statements before production
- Prefer const/let over var
```

### JSON Format

Machine-readable output for automation:

```json
{
  "tool": "check_code_practices",
  "timestamp": "2025-07-18T14:30:00Z",
  "file": "src/app.js",
  "score": 85,
  "issues": [
    {
      "line": 2,
      "column": 7,
      "severity": "error",
      "rule": "eqeqeq",
      "message": "Use '===' instead of '==' for comparison"
    }
  ],
  "summary": {
    "passed": 3,
    "warnings": 2,
    "errors": 1
  }
}
```

### Detailed Format

Comprehensive output with additional context:

```
🔍 Code Quality Analysis Results:

📁 File: src/app.js
📅 Timestamp: 2025-07-18T14:30:00Z
🎯 Tool: check_code_practices
📊 Score: 85/100

✅ Passed Checks (3):
  ✓ Variable declarations use const/let
  ✓ Function names follow camelCase
  ✓ No unused variables detected

⚠️ Warnings (2):
  - Line 2: Use '===' instead of '==' for comparison
  - Line 3: Avoid console.log in production code

❌ Errors (1):
  - Line 1: Consider using 'const' instead of 'var'

💡 Recommendations:
  - Use strict equality operators (===)
  - Remove debug statements before production
  - Prefer const/let over var

🔧 Fix Commands:
  - Replace '==' with '===' on line 2
  - Remove console.log on line 3
  - Change 'var' to 'const' on line 1
```

## 🚨 Exit Codes

The CLI uses standard exit codes:

- `0` - Success, no issues found or all operations completed
- `1` - Error or issues found (warnings/errors in code analysis)
- `2` - Invalid usage or arguments
- `3` - Configuration error
- `4` - File not found or permission denied
- `5` - Network or external service error

### Handling Exit Codes

```bash
#!/bin/bash
# check-with-exit-codes.sh

moidvk check-code -f app.js
case $? in
  0) echo "✅ No issues found" ;;
  1) echo "⚠️ Issues found but fixable" ;;
  2) echo "❌ Invalid command usage" ;;
  3) echo "❌ Configuration error" ;;
  4) echo "❌ File not found" ;;
  5) echo "❌ Network error" ;;
esac
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
      "strict": false,
      "limit": 50
    },
    "format_code": {
      "check_only": false
    },
    "scan_security_vulnerabilities": {
      "severity": "low",
      "production_only": false
    }
  }
}
```

### Project Configuration

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
    },
    "check_production_readiness": {
      "strict": true
    }
  },
  "ignore": [
    "node_modules/**",
    "dist/**",
    "*.min.js"
  ]
}
```

## 🚨 Troubleshooting

### Common Issues

#### "Command not found"

```bash
# Check installation
which moidvk

# Reinstall globally
bun install -g moidvk

# Check PATH
echo $PATH
```

#### "Permission denied"

```bash
# Fix permissions
chmod +x $(which moidvk)

# Check ownership
ls -la $(which moidvk)
```

#### "File not found"

```bash
# Check file path
ls -la src/app.js

# Use absolute path
moidvk check-code -f /full/path/to/file.js
```

#### "Invalid JSON output"

```bash
# Check JSON syntax
moidvk check-code -f app.js --format json | jq .

# Validate output
moidvk check-code -f app.js --format json > output.json
cat output.json | jq .
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

### Performance Issues

```bash
# Check file size limits
moidvk check-code -f large-file.js --max-size 10485760

# Use pagination for large results
moidvk check-code -f app.js --limit 10 --offset 0

# Process files in batches
find . -name "*.js" | xargs -n 10 moidvk check-code
```

## 📚 Next Steps

After mastering the CLI:

1. **Explore [Tool Reference](tool-reference.md)** - Learn about all available tools
2. **Check [Workflow Examples](workflow-examples.md)** - See real-world usage patterns
3. **Review [Production Deployment](production-deployment.md)** - Prepare for production use
4. **Set up CI/CD integration** - Automate your workflow

## 🆘 Getting Help

For CLI-specific issues:

1. **Check this troubleshooting section**
2. **Run with debug mode**: `DEBUG=true moidvk <command>`
3. **Check help**: `moidvk <command> --help`
4. **Review [Troubleshooting Guide](troubleshooting.md)**
5. **Create an issue** in the GitHub repository

---

**CLI Mastery Complete!** 🎉 You now have full command-line control over MOIDVK. Explore the [Tool Reference](tool-reference.md) to learn about all available tools and their options.