# CLI Usage Guide

MOIDVK provides a comprehensive command-line interface for standalone usage and integration into
development workflows. This guide covers all CLI commands and usage patterns.

## 📋 Table of Contents

- [Basic Commands](#basic-commands)
- [Code Analysis Commands](#code-analysis-commands)
- [Formatting Commands](#formatting-commands)
- [Security Commands](#security-commands)
- [Performance Commands](#performance-commands)
- [Production Commands](#production-commands)
- [Utility Commands](#utility-commands)
- [Global Options](#global-options)
- [Configuration](#configuration)
- [Examples & Workflows](#examples--workflows)

## 🚀 Basic Commands

### Server Management

```bash
# Start MCP server
moidvk serve

# Start with custom port
moidvk serve --port 3001

# Start with verbose logging
moidvk serve --verbose

# Test server functionality
moidvk serve --test

# Start in development mode
moidvk serve --dev
```

### System Information

```bash
# Show version
moidvk --version
moidvk -v

# Show help
moidvk --help
moidvk -h

# Show help for specific command
moidvk check-code --help

# System diagnostics
moidvk doctor
moidvk doctor --verbose
```

## 🔍 Code Analysis Commands

### JavaScript/TypeScript Analysis

```bash
# Analyze single file
moidvk check-code -f src/app.js

# Analyze directory
moidvk check-code -d src/

# Analyze with production rules
moidvk check-code -f src/app.js --production

# Filter by severity
moidvk check-code -f src/app.js --severity error

# Limit results
moidvk check-code -f src/app.js --limit 10

# Output as JSON
moidvk check-code -f src/app.js --json

# Analyze from stdin
echo "const x = 1;" | moidvk check-code --stdin
```

### Rust Analysis

```bash
# Analyze Rust file
moidvk rust-practices -f src/lib.rs

# Use specific Rust edition
moidvk rust-practices -f src/lib.rs --edition 2021

# Enable pedantic lints
moidvk rust-practices -f src/lib.rs --pedantic

# Filter by category
moidvk rust-practices -f src/lib.rs --category performance

# Set lint level
moidvk rust-practices -f src/lib.rs --level deny
```

### Python Analysis

```bash
# Analyze Python file
moidvk python-analyze -f src/app.py

# Specify Python version
moidvk python-analyze -f src/app.py --python-version 3

# Select specific rules
moidvk python-analyze -f src/app.py --select E,F,W

# Ignore specific rules
moidvk python-analyze -f src/app.py --ignore E501,W503

# Filter by category
moidvk python-analyze -f src/app.py --category security
```

## 🎨 Formatting Commands

### Multi-Language Formatting

```bash
# Format JavaScript/TypeScript
moidvk format -f src/app.js

# Format multiple files
moidvk format -f src/*.js

# Check formatting without changes
moidvk format -f src/app.js --check

# Format from stdin
echo "const x=1;" | moidvk format --stdin

# Format with specific config
moidvk format -f src/app.js --config .prettierrc
```

### Rust Formatting

```bash
# Format Rust file
moidvk rust-format -f src/lib.rs

# Check formatting
moidvk rust-format -f src/lib.rs --check

# Custom line width
moidvk rust-format -f src/lib.rs --max-width 120

# Specific edition
moidvk rust-format -f src/lib.rs --edition 2021
```

### Python Formatting

```bash
# Format Python file
moidvk python-format -f src/app.py

# Custom line length
moidvk python-format -f src/app.py --line-length 100

# Check formatting
moidvk python-format -f src/app.py --check

# Skip string normalization
moidvk python-format -f src/app.py --skip-string-normalization
```

## 🔒 Security Commands

### Vulnerability Scanning

```bash
# Scan project dependencies
moidvk scan-security

# Scan specific directory
moidvk scan-security -p /path/to/project

# Filter by severity
moidvk scan-security --severity high

# Production dependencies only
moidvk scan-security --production

# Output detailed report
moidvk scan-security --format detailed

# Save report to file
moidvk scan-security --output security-report.json
```

### Safety Rules

```bash
# Check NASA JPL safety rules
moidvk check-safety -f src/critical.js

# Analyze from stdin
cat src/app.js | moidvk check-safety --stdin
```

### Language-Specific Security

```bash
# Rust safety check
moidvk rust-safety -f src/lib.rs

# Strict mode
moidvk rust-safety -f src/lib.rs --strict

# Python security scan
moidvk python-security -f src/app.py

# Filter by confidence
moidvk python-security -f src/app.py --confidence high
```

## ⚡ Performance Commands

### JavaScript Performance

```bash
# Analyze JavaScript performance
moidvk js-performance -f src/app.js

# Focus on specific category
moidvk js-performance -f src/app.js --category memory

# Browser-specific analysis
moidvk js-performance -f src/app.js --focus browser

# Include metrics
moidvk js-performance -f src/app.js --include-metrics
```

### Rust Performance

```bash
# Analyze Rust performance
moidvk rust-performance -f src/lib.rs

# Focus on allocations
moidvk rust-performance -f src/lib.rs --category allocation

# Memory-focused analysis
moidvk rust-performance -f src/lib.rs --focus memory
```

### Python Performance

```bash
# Analyze Python performance
moidvk python-performance -f src/app.py

# Data science focus
moidvk python-performance -f src/app.py --focus data_science

# Include complexity analysis
moidvk python-performance -f src/app.py --include-complexity
```

### Bundle Analysis

```bash
# Analyze bundle size
moidvk bundle-size

# Specific entry point
moidvk bundle-size --entry src/index.js

# Custom size budget
moidvk bundle-size --budget 200

# Analyze tree shaking
moidvk bundle-size --tree-shaking
```

## 🚀 Production Commands

### Production Readiness

```bash
# Check production readiness
moidvk check-production -f src/app.js

# Strict mode
moidvk check-production -f src/app.js --strict

# Filter by category
moidvk check-production -f src/app.js --category console-logs

# Rust production check
moidvk rust-production -f src/lib.rs
```

### Accessibility

```bash
# Check accessibility
moidvk check-accessibility -f src/component.jsx

# WCAG AAA compliance
moidvk check-accessibility -f src/component.jsx --standard AAA

# Specific rule set
moidvk check-accessibility -f src/component.jsx --rule-set forms

# Include color contrast
moidvk check-accessibility -f src/component.jsx --include-contrast
```

### API Validation

```bash
# Validate GraphQL schema
moidvk graphql-schema -f schema.graphql

# Check GraphQL query
moidvk graphql-query -f query.graphql --schema schema.graphql

# Validate OpenAPI spec
moidvk openapi-validate -f api.yaml

# Check Redux patterns
moidvk redux-patterns -f src/store.js
```

## 🛠️ Utility Commands

### Testing

```bash
# Analyze JavaScript tests
moidvk js-test -f tests/app.test.js

# Python test analysis
moidvk python-test -f tests/test_app.py

# Include metrics
moidvk js-test -f tests/ --include-metrics
```

### Documentation

```bash
# Check documentation quality
moidvk doc-quality -f src/

# Specific documentation type
moidvk doc-quality -f src/ --doc-type api

# Include spelling check
moidvk doc-quality -f README.md --check-spelling
```

### Infrastructure

```bash
# Scan container security
moidvk container-security

# Analyze CI/CD configuration
moidvk cicd-analyze

# Check license compliance
moidvk license-scan

# Validate environment config
moidvk env-validate
```

### Git Analysis

```bash
# Git blame analysis
moidvk git-blame -f src/app.js

# Specific line range
moidvk git-blame -f src/app.js --start 10 --end 20

# Show email addresses
moidvk git-blame -f src/app.js --show-email
```

## 🌐 Global Options

### Common Options

```bash
# Verbose output
moidvk <command> --verbose
moidvk <command> -v

# Quiet mode
moidvk <command> --quiet
moidvk <command> -q

# JSON output
moidvk <command> --json

# Output to file
moidvk <command> --output report.json
moidvk <command> -o report.json

# Configuration file
moidvk <command> --config .moidvk.json
moidvk <command> -c .moidvk.json

# Working directory
moidvk <command> --cwd /path/to/project

# Timeout (in seconds)
moidvk <command> --timeout 60
```

### Input Options

```bash
# File input
moidvk <command> --file path/to/file
moidvk <command> -f path/to/file

# Directory input
moidvk <command> --directory path/to/dir
moidvk <command> -d path/to/dir

# Stdin input
moidvk <command> --stdin

# Multiple files
moidvk <command> -f file1.js -f file2.js

# Glob patterns
moidvk <command> -f "src/**/*.js"
```

### Filtering Options

```bash
# Severity filtering
moidvk <command> --severity error
moidvk <command> --severity warning,error

# Category filtering
moidvk <command> --category security
moidvk <command> --category security,performance

# Limit results
moidvk <command> --limit 50

# Offset for pagination
moidvk <command> --offset 10

# Sort results
moidvk <command> --sort-by severity
moidvk <command> --sort-order desc
```

## ⚙️ Configuration

### Configuration File

Create `.moidvk.json` in your project root:

```json
{
  "defaultSeverity": "warning",
  "outputFormat": "json",
  "caching": {
    "enabled": true,
    "ttl": 3600
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "ruleCategory": "all"
    },
    "scan_security_vulnerabilities": {
      "severity": "medium"
    }
  },
  "ignore": ["node_modules/", "dist/", "*.min.js"]
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

# Paths
export MOIDVK_CONFIG_PATH=/path/to/config
export MOIDVK_CACHE_DIR=/path/to/cache
```

### Per-Command Configuration

```bash
# Override config for specific command
moidvk check-code -f src/app.js --config-override '{"production": true}'

# Disable caching for command
moidvk check-code -f src/app.js --no-cache

# Force JavaScript fallback
moidvk check-code -f src/app.js --no-rust
```

## 📊 Examples & Workflows

### Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Format code
moidvk format -d src/ --check || {
  echo "Code formatting required"
  exit 1
}

# Check code quality
moidvk check-code -d src/ --production --severity error || {
  echo "Code quality issues found"
  exit 1
}

# Security scan
moidvk scan-security --severity high || {
  echo "Security vulnerabilities found"
  exit 1
}
```

### CI/CD Pipeline

```bash
#!/bin/bash
# ci/analyze.sh

set -e

echo "Running MOIDVK analysis..."

# Code quality
moidvk check-code -d src/ --production --json > reports/code-quality.json

# Security scan
moidvk scan-security --json > reports/security.json

# Performance analysis
moidvk js-performance -d src/ --json > reports/performance.json

# Production readiness
moidvk check-production -d src/ --strict --json > reports/production.json

# Accessibility check
moidvk check-accessibility -d src/ --json > reports/accessibility.json

echo "Analysis complete. Reports saved to reports/"
```

### Development Workflow

```bash
#!/bin/bash
# scripts/dev-check.sh

# Quick development checks
echo "🔍 Analyzing code..."
moidvk check-code -f $1 --severity warning

echo "🎨 Checking format..."
moidvk format -f $1 --check

echo "🔒 Security check..."
moidvk scan-security --severity medium

echo "⚡ Performance check..."
moidvk js-performance -f $1 --category memory,cpu

echo "✅ Development checks complete!"
```

### Batch Processing

```bash
# Process multiple files
find src/ -name "*.js" -exec moidvk check-code -f {} \;

# Process with xargs
find src/ -name "*.js" | xargs -I {} moidvk check-code -f {}

# Parallel processing
find src/ -name "*.js" | xargs -P 4 -I {} moidvk check-code -f {}
```

## 🔧 Advanced Usage

### Piping and Chaining

```bash
# Chain commands
moidvk check-code -f src/app.js --json | jq '.issues[] | select(.severity == "error")'

# Combine with other tools
moidvk scan-security --json | jq -r '.vulnerabilities[].package' | sort | uniq

# Filter and format
moidvk check-code -d src/ --json | jq '.issues[] | select(.line > 100)'
```

### Custom Scripts

```bash
#!/bin/bash
# Custom analysis script

FILES=$(find src/ -name "*.js" -o -name "*.ts")

for file in $FILES; do
  echo "Analyzing $file..."

  # Code quality
  moidvk check-code -f "$file" --production

  # Performance
  moidvk js-performance -f "$file" --category memory

  # Production readiness
  moidvk check-production -f "$file"
done
```

### Integration with Make

```makefile
# Makefile
.PHONY: analyze format security

analyze:
	moidvk check-code -d src/ --production

format:
	moidvk format -d src/

security:
	moidvk scan-security --severity medium

all: format analyze security
```

## 🆘 Troubleshooting

### Common Issues

```bash
# Check system status
moidvk doctor --verbose

# Clear cache
moidvk cache clear

# Force rebuild
moidvk rebuild --force

# Use JavaScript fallback
MOIDVK_USE_JS_FALLBACK=true moidvk check-code -f src/app.js

# Debug mode
MOIDVK_DEBUG=true moidvk check-code -f src/app.js
```

### Performance Issues

```bash
# Reduce concurrency
moidvk check-code -d src/ --max-concurrent 2

# Increase timeout
moidvk check-code -d src/ --timeout 120

# Use streaming mode
moidvk check-code -d src/ --stream
```

## 📚 Additional Resources

- **[Tool Reference](../technical/tool-reference.md)** - Complete tool documentation
- **[Configuration Guide](../technical/configuration.md)** - Advanced configuration
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions
- **[Workflow Examples](workflow-examples.md)** - Real-world usage patterns

---

**Need help?** Use `moidvk --help` or `moidvk <command> --help` for detailed command information.
