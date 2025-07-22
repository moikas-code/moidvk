# Go Language Tools Reference

This document provides comprehensive reference for all Go language analysis and formatting tools
available in moidvk.

## Overview

moidvk provides 6 comprehensive Go language tools that cover code analysis, formatting, security
scanning, performance analysis, test analysis, and dependency scanning. These tools follow the same
patterns and quality standards as the existing Rust, Python, and JavaScript/TypeScript tools.

## Available Tools

### 1. 🔍 go_code_analyzer

Analyzes Go code for best practices, style issues, potential bugs, and security vulnerabilities
using multiple Go analysis tools.

**Supported Tools:**

- `go vet` - Built-in Go static analyzer
- `staticcheck` - Advanced static analysis
- `ineffassign` - Detects inefficient assignments
- `misspell` - Finds spelling errors

**Key Features:**

- Multi-tool analysis with configurable tool selection
- Pagination and filtering support
- Severity-based categorization (error, warning, info)
- Category filtering (correctness, style, performance, security, complexity)
- Build tag support
- Go version targeting (1.19-1.23)

**Example Usage:**

```json
{
  "name": "go_code_analyzer",
  "arguments": {
    "code": "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}",
    "filename": "main.go",
    "tools": ["vet", "staticcheck"],
    "goVersion": "1.21",
    "severity": "all",
    "limit": 50
  }
}
```

### 2. 🎨 go_formatter

Formats Go code using gofmt, goimports, and gofumpt with comprehensive formatting options.

**Supported Formatters:**

- `gofmt` - Standard Go formatter
- `goimports` - Import organization and formatting
- `gofumpt` - Stricter formatting rules

**Key Features:**

- Multiple formatter support
- Check mode for validation without modification
- Import organization and cleanup
- Module-aware formatting
- Simplification rules (gofmt -s)
- Custom tab width and local import prefixes

**Example Usage:**

```json
{
  "name": "go_formatter",
  "arguments": {
    "code": "package main\nimport\"fmt\"\nfunc main(){fmt.Println(\"test\")}",
    "filename": "main.go",
    "tool": "goimports",
    "check": false,
    "simplify": true
  }
}
```

### 3. 🔒 go_security_scanner

Scans Go code for security vulnerabilities using govulncheck and security-focused static analysis.

**Security Analysis Types:**

- Vulnerability scanning with `govulncheck`
- Unsafe code pattern detection
- Security-focused static analysis
- Dependency security checking
- Cryptographic weakness detection

**Key Features:**

- Multiple security analysis tools
- Dependency vulnerability scanning (go.mod/go.sum support)
- Confidence and severity filtering
- Category-based filtering (crypto, injection, memory, network, filesystem)
- Comprehensive security recommendations

**Example Usage:**

```json
{
  "name": "go_security_scanner",
  "arguments": {
    "code": "package main\n\nimport (\n    \"crypto/md5\"\n    \"unsafe\"\n)\n\nfunc main() {\n    h := md5.New()\n    var x int\n    ptr := unsafe.Pointer(&x)\n}",
    "filename": "main.go",
    "tools": ["unsafe-analysis", "staticcheck-security"],
    "severity": "medium",
    "category": "all"
  }
}
```

### 4. ⚡ go_performance_analyzer

Analyzes Go code for performance issues, inefficient patterns, and optimization opportunities.

**Performance Analysis Areas:**

- Memory allocation patterns
- Loop optimizations
- String operations
- Collection usage
- Goroutine patterns
- I/O operations
- Complexity analysis

**Key Features:**

- Pattern-based performance analysis
- Memory allocation detection
- Complexity analysis (cyclomatic complexity)
- Focus areas (memory, cpu, io, concurrency)
- Impact-based severity levels
- Optimization suggestions

**Example Usage:**

```json
{
  "name": "go_performance_analyzer",
  "arguments": {
    "code": "package main\n\nfunc main() {\n    var result string\n    for i := 0; i < 1000; i++ {\n        result = result + fmt.Sprintf(\"%d\", i)\n    }\n}",
    "filename": "main.go",
    "focus": "memory",
    "category": "allocation",
    "severity": "all"
  }
}
```

### 5. 🧪 go_test_analyzer

Analyzes Go test code for quality, coverage, best practices, and identifies missing tests.

**Test Analysis Features:**

- Test structure validation
- Naming convention checking
- Coverage analysis (with source code)
- Benchmark test identification
- Table-driven test pattern detection
- Test metrics calculation

**Key Features:**

- Test quality analysis
- Coverage checking against source code
- Test type detection (unit, integration, benchmark, example)
- Focus areas (coverage, structure, performance, naming)
- Comprehensive test metrics
- Best practice recommendations

**Example Usage:**

```json
{
  "name": "go_test_analyzer",
  "arguments": {
    "code": "package main\n\nimport \"testing\"\n\nfunc TestAdd(t *testing.T) {\n    result := add(2, 3)\n    if result != 5 {\n        t.Errorf(\"Expected 5, got %d\", result)\n    }\n}",
    "filename": "main_test.go",
    "sourceCode": "package main\n\nfunc add(a, b int) int {\n    return a + b\n}",
    "focus": "coverage"
  }
}
```

### 6. 📦 go_dependency_scanner

Scans Go module dependencies for vulnerabilities, license issues, and outdated packages.

**Dependency Analysis Types:**

- Security vulnerability scanning
- License compatibility checking
- Outdated package detection
- Dependency conflict analysis
- Module integrity verification

**Key Features:**

- go.mod and go.sum analysis
- Multiple scan types (vulnerabilities, licenses, outdated, all)
- Indirect dependency support
- Severity-based filtering
- License compatibility analysis
- Update recommendations

**Example Usage:**

```json
{
  "name": "go_dependency_scanner",
  "arguments": {
    "goMod": "module example.com/test\n\ngo 1.21\n\nrequire (\n    github.com/gorilla/mux v1.8.0\n    github.com/lib/pq v1.10.7\n)",
    "goSum": "github.com/gorilla/mux v1.8.0 h1:...\n",
    "scanType": "all",
    "severity": "medium",
    "includeIndirect": true
  }
}
```

## Common Parameters

All Go tools support these common parameters:

### Pagination

- `limit` (number): Maximum number of issues to return (default: 50, max: 500)
- `offset` (number): Starting index for pagination (default: 0)

### Filtering

- `severity` (string): Filter by severity level (varies by tool)
- `category` (string): Filter by issue category (varies by tool)

### Sorting

- `sortBy` (string): Field to sort by (varies by tool)
- `sortOrder` (string): Sort order - "asc" or "desc" (default: varies by tool)

## Installation Requirements

The Go tools require the following to be installed:

### Essential (Required)

- `go` - Go compiler and toolchain ✅
- `go vet` - Built-in static analyzer ✅
- `gofmt` - Code formatter ✅

### Recommended (Auto-installed)

- `staticcheck` - Advanced static analyzer ✅
- `goimports` - Import organizer ✅
- `ineffassign` - Inefficient assignment detector ✅
- `misspell` - Spelling checker ✅

### Optional (For Enhanced Features)

- `govulncheck` - Vulnerability scanner
- `gofumpt` - Stricter formatter
- `golangci-lint` - Meta-linter

## Error Handling

All Go tools provide comprehensive error handling:

- **Validation Errors**: Input validation with clear error messages
- **Tool Availability**: Graceful degradation when optional tools are missing
- **Timeout Protection**: All operations have configurable timeouts
- **Resource Cleanup**: Automatic cleanup of temporary files and directories

## Performance Characteristics

- **Fast Analysis**: Most tools complete analysis in under 1 second for typical code
- **Memory Efficient**: Temporary file cleanup and memory management
- **Concurrent Safe**: Tools can be run concurrently without conflicts
- **Scalable**: Pagination support for large codebases

## Integration Examples

### Claude Desktop

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

### Programmatic Usage

```javascript
import { analyzeGoCode } from './lib/go/go-code-analyzer.js';

const result = await analyzeGoCode({
  code: goCodeString,
  filename: 'main.go',
  tools: ['vet', 'staticcheck'],
  severity: 'all',
});
```

## Best Practices

### For Code Analysis

1. Start with `go vet` for basic issues
2. Add `staticcheck` for comprehensive analysis
3. Use `ineffassign` for performance-related issues
4. Apply `misspell` for documentation quality

### For Security Scanning

1. Always scan dependencies with `govulncheck`
2. Check for unsafe code patterns
3. Review cryptographic usage
4. Validate input handling

### For Performance Analysis

1. Focus on high-impact issues first
2. Address memory allocation patterns
3. Optimize loops and string operations
4. Profile with Go tools for verification

### For Test Analysis

1. Ensure proper test naming conventions
2. Use table-driven tests for multiple cases
3. Check coverage against source code
4. Include benchmarks for performance-critical code

## Troubleshooting

### Common Issues

**Tool Not Found Errors:**

```bash
# Install missing tools
go install honnef.co/go/tools/cmd/staticcheck@latest
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/gordonklaus/ineffassign@latest
go install github.com/client9/misspell/cmd/misspell@latest
```

**Path Issues:**

```bash
# Ensure Go bin is in PATH
export PATH=$PATH:$(go env GOPATH)/bin
```

**Module Issues:**

- Ensure valid go.mod file for dependency scanning
- Use proper module paths for import resolution

## Version Compatibility

- **Go Versions**: 1.19, 1.20, 1.21, 1.22, 1.23
- **Tool Versions**: Latest stable versions recommended
- **Platform Support**: Linux, macOS, Windows

## Contributing

To contribute to the Go tools:

1. Follow the established patterns in `/lib/go/`
2. Add comprehensive tests in `/test/`
3. Update documentation
4. Ensure MCP integration compatibility

## Support

For issues or questions:

- Check the troubleshooting section above
- Review test files for usage examples
- Consult the main moidvk documentation
