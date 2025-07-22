# MOIDVK Tool Reference

Complete reference for all 37+ tools available in MOIDVK. Each tool is designed for specific
development tasks and can be used via MCP clients or CLI.

## 📋 Tool Categories

- [Code Quality & Analysis](#code-quality--analysis)
- [Code Formatting](#code-formatting)
- [Security & Safety](#security--safety)
- [Performance & Optimization](#performance--optimization)
- [Production Readiness](#production-readiness)
- [Accessibility & Standards](#accessibility--standards)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Infrastructure & DevOps](#infrastructure--devops)
- [Intelligent Development](#intelligent-development)
- [Specialized Tools](#specialized-tools)

---

## Code Quality & Analysis

### `check_code_practices`

**Language**: JavaScript/TypeScript  
**Purpose**: ESLint-powered code analysis with comprehensive rule sets

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "production": "boolean (default: false)",
  "ruleCategory": "enum: possible-errors|best-practices|stylistic-issues|es6|all",
  "severity": "enum: error|warning|all",
  "limit": "number (default: 50, max: 500)",
  "offset": "number (default: 0)",
  "sortBy": "enum: line|severity|ruleId|message",
  "sortOrder": "enum: asc|desc"
}
```

#### Example Usage

```javascript
// MCP Client
await client.callTool('check_code_practices', {
  code: 'const x = 1; console.log(x);',
  production: true,
  severity: 'warning'
});

// CLI
moidvk check-code -f src/app.js --production --severity warning
```

#### Response Format

```json
{
  "issues": [
    {
      "line": 1,
      "column": 7,
      "severity": "warning",
      "ruleId": "no-console",
      "message": "Unexpected console statement",
      "category": "best-practices"
    }
  ],
  "summary": {
    "total": 1,
    "errors": 0,
    "warnings": 1
  }
}
```

### `rust_code_practices`

**Language**: Rust  
**Purpose**: Clippy-powered Rust code analysis

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "edition": "enum: 2015|2018|2021|2024 (default: 2021)",
  "level": "enum: allow|warn|deny|forbid (default: warn)",
  "category": "enum: correctness|suspicious|style|complexity|perf|pedantic|restriction|all",
  "pedantic": "boolean (default: false)",
  "severity": "enum: error|warning|all",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

#### Example Usage

```rust
// Example Rust code analysis
await client.callTool('rust_code_practices', {
  code: 'fn main() { let x = 1; println!("{}", x); }',
  edition: '2021',
  pedantic: true
});
```

### `python_code_analyzer`

**Language**: Python  
**Purpose**: Ruff-powered Python code analysis

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "pythonVersion": "enum: 2|3 (default: 3)",
  "category": "enum: style|error|bug|security|performance|all",
  "select": "array of strings (rule codes)",
  "ignore": "array of strings (rule codes to ignore)",
  "severity": "enum: error|warning|all",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Code Formatting

### `format_code`

**Languages**: JavaScript, TypeScript, CSS, HTML, Markdown, YAML  
**Purpose**: Prettier-powered code formatting

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "check": "boolean (default: false)"
}
```

#### Example Usage

```javascript
await client.callTool('format_code', {
  code: 'const x=1;console.log(x);',
  filename: 'app.js',
});
```

#### Response Format

```json
{
  "formatted": "const x = 1;\nconsole.log(x);\n",
  "changed": true,
  "error": null
}
```

### `rust_formatter`

**Language**: Rust  
**Purpose**: rustfmt-powered Rust code formatting

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "edition": "enum: 2015|2018|2021|2024",
  "max_width": "number (default: 100, min: 50, max: 200)",
  "tab_spaces": "number (default: 4, min: 2, max: 8)",
  "newline_style": "enum: Auto|Unix|Windows",
  "indent_style": "enum: Visual|Block",
  "use_small_heuristics": "enum: Default|Off|Max",
  "check": "boolean (default: false)"
}
```

### `python_formatter`

**Language**: Python  
**Purpose**: Black-powered Python code formatting

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "lineLength": "number (default: 88, min: 50, max: 200)",
  "pythonVersion": "enum: 2|3",
  "skipStringNormalization": "boolean (default: false)",
  "skipMagicTrailingComma": "boolean (default: false)",
  "previewMode": "boolean (default: false)",
  "check": "boolean (default: false)"
}
```

---

## Security & Safety

### `scan_security_vulnerabilities`

**Purpose**: Project dependency vulnerability scanning using npm/bun audit

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "production": "boolean (default: false)",
  "severity": "enum: low|moderate|high|critical",
  "format": "enum: summary|detailed",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)",
  "sortBy": "enum: severity|package|title",
  "sortOrder": "enum: asc|desc"
}
```

#### Example Usage

```javascript
await client.callTool('scan_security_vulnerabilities', {
  projectPath: '/path/to/project',
  severity: 'high',
  production: true,
});
```

#### Response Format

```json
{
  "vulnerabilities": [
    {
      "package": "lodash",
      "version": "4.17.15",
      "severity": "high",
      "title": "Prototype Pollution",
      "description": "...",
      "recommendation": "Upgrade to 4.17.21"
    }
  ],
  "summary": {
    "total": 1,
    "high": 1,
    "moderate": 0,
    "low": 0
  }
}
```

### `check_safety_rules`

**Language**: JavaScript/TypeScript  
**Purpose**: NASA JPL Power of 10 safety-critical programming rules

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)"
}
```

#### Response Format

```json
{
  "violations": [
    {
      "rule": "No dynamic memory allocation",
      "line": 5,
      "severity": "critical",
      "description": "Avoid malloc/new in safety-critical code"
    }
  ],
  "safetyScore": 85,
  "compliance": "partial"
}
```

### `rust_safety_checker`

**Language**: Rust  
**Purpose**: Memory safety and ownership validation

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "strict": "boolean (default: false)"
}
```

### `python_security_scanner`

**Language**: Python  
**Purpose**: Bandit-powered security analysis

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "severity": "enum: low|medium|high|all",
  "confidence": "enum: low|medium|high|all",
  "category": "enum: crypto|injection|misc|all",
  "tests": "array of strings (specific test IDs)",
  "skips": "array of strings (test IDs to skip)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Performance & Optimization

### `js_performance_analyzer`

**Language**: JavaScript/TypeScript  
**Purpose**: Performance analysis and optimization recommendations

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "category": "enum: memory|cpu|io|async|dom|all",
  "focus": "enum: general|react|node|browser",
  "includeMetrics": "boolean (default: true)",
  "strictness": "enum: lenient|standard|strict",
  "projectPath": "string (optional)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

#### Example Usage

```javascript
await client.callTool('js_performance_analyzer', {
  code: 'for(let i=0; i<1000000; i++) { document.getElementById("test"); }',
  category: 'dom',
  focus: 'browser',
});
```

#### Response Format

```json
{
  "issues": [
    {
      "type": "dom_query_in_loop",
      "line": 1,
      "severity": "high",
      "impact": "performance",
      "description": "DOM query inside loop causes repeated reflow",
      "suggestion": "Cache DOM reference outside loop"
    }
  ],
  "metrics": {
    "complexity": "O(n)",
    "memoryUsage": "high",
    "optimizationPotential": 85
  }
}
```

### `rust_performance_analyzer`

**Language**: Rust  
**Purpose**: Rust performance analysis and optimization

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "category": "enum: allocation|cloning|loops|collections|io|async|all",
  "focus": "enum: memory|cpu|io|general",
  "severity": "enum: high|medium|low|all",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `python_performance_analyzer`

**Language**: Python  
**Purpose**: Python performance analysis and optimization

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "category": "enum: memory|cpu|io|async|algorithms|all",
  "focus": "enum: general|data_science|web|cli",
  "includeComplexity": "boolean (default: true)",
  "includeProfileSuggestions": "boolean (default: true)",
  "severity": "enum: high|medium|low|all",
  "projectPath": "string (optional)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `bundle_size_analyzer`

**Purpose**: JavaScript/TypeScript bundle size analysis and optimization

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "entryPoint": "string (e.g., 'src/index.js')",
  "bundler": "enum: auto|bun|webpack|esbuild|rollup|vite",
  "target": "enum: web|node|browser",
  "sizeBudget": "number (default: 250KB)",
  "analyzeTreeShaking": "boolean (default: true)",
  "includeSourceMap": "boolean (default: false)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Production Readiness

### `check_production_readiness`

**Language**: JavaScript/TypeScript  
**Purpose**: Production deployment validation

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "category": "enum: console-logs|todos|debugging|documentation|error-handling|all",
  "severity": "enum: critical|high|medium|low|all",
  "strict": "boolean (default: false)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)",
  "sortBy": "enum: line|severity|category|message",
  "sortOrder": "enum: asc|desc"
}
```

#### Example Usage

```javascript
await client.callTool('check_production_readiness', {
  code: 'console.log("Debug info"); // TODO: remove this',
  strict: true,
});
```

#### Response Format

```json
{
  "issues": [
    {
      "line": 1,
      "category": "console-logs",
      "severity": "medium",
      "message": "Console statement found in production code",
      "suggestion": "Remove or replace with proper logging"
    },
    {
      "line": 1,
      "category": "todos",
      "severity": "low",
      "message": "TODO comment found",
      "suggestion": "Complete or remove TODO items before production"
    }
  ],
  "readinessScore": 75,
  "recommendation": "Address medium and high severity issues"
}
```

### `rust_production_readiness`

**Language**: Rust  
**Purpose**: Rust production deployment validation

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "category": "enum: debugging|todos|error-handling|documentation|logging|testing|all",
  "severity": "enum: critical|high|medium|low|all",
  "strict": "boolean (default: false)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Accessibility & Standards

### `check_accessibility`

**Languages**: HTML, JSX/TSX, CSS  
**Purpose**: WCAG 2.2 accessibility compliance validation using axe-core

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "standard": "enum: A|AA|AAA (default: AA)",
  "environment": "enum: development|production",
  "rule_set": "enum: minimal|forms|content|navigation|full",
  "include_contrast": "boolean (default: true)",
  "rules": "array of strings (specific axe rule IDs)"
}
```

#### Example Usage

```javascript
await client.callTool('check_accessibility', {
  code: '<button>Click me</button>',
  standard: 'AA',
  rule_set: 'full',
});
```

#### Response Format

```json
{
  "violations": [
    {
      "id": "button-name",
      "impact": "serious",
      "description": "Buttons must have discernible text",
      "help": "Ensure buttons have accessible names",
      "nodes": [
        {
          "target": ["button"],
          "html": "<button>Click me</button>"
        }
      ]
    }
  ],
  "passes": [],
  "incomplete": [],
  "summary": {
    "violations": 1,
    "passes": 0,
    "incomplete": 0
  }
}
```

### `check_graphql_schema`

**Technology**: GraphQL  
**Purpose**: GraphQL schema validation and best practices

#### Parameters

```json
{
  "schema": "string (required)",
  "filename": "string (optional)",
  "category": "enum: syntax|design|security|performance|naming|all",
  "severity": "enum: critical|high|medium|low|all",
  "strict": "boolean (default: false)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)",
  "sortBy": "enum: line|severity|category|type",
  "sortOrder": "enum: asc|desc"
}
```

### `check_graphql_query`

**Technology**: GraphQL  
**Purpose**: GraphQL query analysis for complexity and security

#### Parameters

```json
{
  "query": "string (required)",
  "schema": "string (optional)",
  "filename": "string (optional)",
  "maxDepth": "number (default: 7, max: 20)",
  "maxComplexity": "number (default: 100, max: 1000)",
  "category": "enum: complexity|performance|security|syntax|best-practices|all",
  "severity": "enum: critical|high|medium|low|all",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `check_redux_patterns`

**Technology**: Redux  
**Purpose**: Redux state management pattern validation

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "codeType": "enum: reducer|action|store|selector|middleware|component|auto",
  "category": "enum: mutation|performance|best-practices|anti-patterns|structure|all",
  "severity": "enum: critical|high|medium|low|all",
  "strict": "boolean (default: false)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Testing & Quality Assurance

### `js_test_analyzer`

**Language**: JavaScript/TypeScript  
**Purpose**: Test analysis and quality metrics

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "framework": "enum: auto|jest|vitest|mocha|jasmine",
  "category": "enum: structure|coverage|quality|performance|all",
  "includeMetrics": "boolean (default: true)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

#### Response Format

```json
{
  "issues": [
    {
      "type": "missing_assertion",
      "line": 5,
      "severity": "medium",
      "message": "Test case without assertions",
      "suggestion": "Add expect() assertions to verify behavior"
    }
  ],
  "metrics": {
    "testCount": 10,
    "assertionCount": 25,
    "coverage": {
      "estimated": 85,
      "missingAreas": ["error handling", "edge cases"]
    }
  }
}
```

### `python_test_analyzer`

**Language**: Python  
**Purpose**: Python test analysis and quality metrics

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "framework": "enum: pytest|unittest|auto",
  "category": "enum: structure|coverage|quality|performance|all",
  "includeMetrics": "boolean (default: true)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `python_type_checker`

**Language**: Python  
**Purpose**: mypy-powered type checking

#### Parameters

```json
{
  "code": "string (required)",
  "filename": "string (optional)",
  "pythonVersion": "enum: 3.7|3.8|3.9|3.10|3.11|3.12",
  "strict": "boolean (default: false)",
  "checkUntyped": "boolean (default: true)",
  "disallowUntyped": "boolean (default: false)",
  "followImports": "enum: normal|silent|skip|error",
  "ignoreErrors": "array of strings",
  "severity": "enum: error|warning|note|all",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Infrastructure & DevOps

### `container_security_scanner`

**Purpose**: Docker/container security analysis

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "scanType": "enum: dockerfile|compose|image|all",
  "dockerfilePath": "string (optional)",
  "dockerComposePath": "string (optional)",
  "imageName": "string (optional)",
  "checkBaseImages": "boolean (default: true)",
  "includeCompliance": "boolean (default: true)",
  "severity": "enum: low|medium|high|critical|all",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `cicd_configuration_analyzer`

**Purpose**: CI/CD pipeline analysis

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "platform": "enum: auto|github-actions|gitlab-ci|jenkins|azure-devops|circleci|travis-ci",
  "configPath": "string (optional)",
  "checkSecurity": "boolean (default: true)",
  "checkPerformance": "boolean (default: true)",
  "checkCompliance": "boolean (default: true)",
  "includeSecrets": "boolean (default: true)",
  "strictness": "enum: lenient|standard|strict",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `license_compliance_scanner`

**Purpose**: License compatibility and compliance scanning

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "packageManager": "enum: auto|npm|yarn|pnpm|bun|pip|pipenv|poetry|cargo",
  "projectLicense": "string (e.g., 'MIT', 'Apache-2.0')",
  "checkCompatibility": "boolean (default: true)",
  "flagRiskyLicenses": "boolean (default: true)",
  "includeDev": "boolean (default: false)",
  "generateReport": "boolean (default: true)",
  "strictness": "enum: lenient|standard|strict|enterprise",
  "format": "enum: detailed|summary|csv|json",
  "limit": "number (default: 100)",
  "offset": "number (default: 0)"
}
```

### `environment_config_validator`

**Purpose**: Environment configuration validation

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "configType": "enum: auto|dotenv|docker|kubernetes|docker-compose|terraform|cloudformation|helm",
  "configPath": "string (optional)",
  "environment": "enum: development|staging|production|test",
  "checkSecurity": "boolean (default: true)",
  "checkCompleteness": "boolean (default: true)",
  "checkBestPractices": "boolean (default: true)",
  "validateSecrets": "boolean (default: true)",
  "category": "enum: security|completeness|performance|compliance|all",
  "strictness": "enum: lenient|standard|strict|enterprise",
  "format": "enum: detailed|summary|checklist",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

---

## Intelligent Development

### `intelligent_development_analysis`

**Purpose**: Optimal tool sequence orchestration

#### Parameters

```json
{
  "files": "array of strings (required)",
  "development_goals": "array of strings (optional)",
  "context": {
    "session_type": "enum: bug_fix|feature_development|refactoring|optimization|review",
    "scope": "enum: single_file|module|component|system",
    "urgency": "enum: low|medium|high|critical"
  },
  "client_type": "enum: claude_desktop|claude_code|other_mcp"
}
```

#### Example Usage

```javascript
await client.callTool('intelligent_development_analysis', {
  files: ['src/app.js', 'src/utils.js'],
  development_goals: ['improve_performance', 'enhance_security'],
  context: {
    session_type: 'optimization',
    scope: 'module',
    urgency: 'medium',
  },
});
```

#### Response Format

```json
{
  "recommended_sequence": [
    {
      "tool": "check_code_practices",
      "priority": "high",
      "reason": "Identify code quality issues first"
    },
    {
      "tool": "scan_security_vulnerabilities",
      "priority": "high",
      "reason": "Security analysis for optimization context"
    },
    {
      "tool": "js_performance_analyzer",
      "priority": "medium",
      "reason": "Performance optimization goal"
    }
  ],
  "estimated_time": "2-3 minutes",
  "parallel_execution": true
}
```

### `semantic_development_search`

**Purpose**: Context-aware code search with embeddings

#### Parameters

```json
{
  "query": "string (required)",
  "search_type": "enum: similar_code|related_patterns|bug_hunt|optimization_targets|refactor_candidates",
  "max_results": "number (default: 10)",
  "context_aware": "boolean (default: true)",
  "include_analysis": "boolean (default: true)"
}
```

### `development_session_manager`

**Purpose**: Cross-client development session management

#### Parameters

```json
{
  "action": "enum: start|resume|checkpoint|analyze|export|import",
  "session_data": {
    "id": "string",
    "client_type": "string",
    "context": "object",
    "goals": "array of strings"
  },
  "import_data": "string (for import action)"
}
```

---

## Specialized Tools

### `documentation_quality_checker`

**Purpose**: Documentation analysis and completeness

#### Parameters

```json
{
  "code": "string (optional)",
  "projectPath": "string (optional)",
  "filename": "string (optional)",
  "docType": "enum: code|readme|api|all",
  "standard": "enum: jsdoc|typedoc|tsdoc|auto",
  "strictness": "enum: minimal|standard|strict",
  "includePrivate": "boolean (default: false)",
  "checkSpelling": "boolean (default: false)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `openapi_rest_validator`

**Purpose**: OpenAPI/REST API validation

#### Parameters

```json
{
  "spec": "string (optional)",
  "specPath": "string (optional)",
  "version": "enum: 2.0|3.0|3.1|auto",
  "validationType": "enum: syntax|semantic|security|best-practices|all",
  "strictness": "enum: minimal|standard|strict",
  "checkSecurity": "boolean (default: true)",
  "restCompliance": "boolean (default: true)",
  "includeExamples": "boolean (default: true)",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `python_dependency_scanner`

**Purpose**: Python dependency analysis

#### Parameters

```json
{
  "projectPath": "string (default: current directory)",
  "checkSecurity": "boolean (default: true)",
  "checkOutdated": "boolean (default: true)",
  "checkLicenses": "boolean (default: true)",
  "severity": "enum: low|moderate|high|critical",
  "format": "enum: summary|detailed",
  "limit": "number (default: 50)",
  "offset": "number (default: 0)"
}
```

### `git_blame_analyzer`

**Purpose**: Code authorship and contribution analysis

#### Parameters

```json
{
  "filePath": "string (required)",
  "startLine": "number (optional)",
  "endLine": "number (optional)",
  "ignoreWhitespace": "boolean (default: true)",
  "showEmail": "boolean (default: false)"
}
```

#### Response Format

```json
{
  "blame_info": [
    {
      "line": 1,
      "author": "John Doe",
      "email": "john@example.com",
      "commit": "abc123",
      "date": "2024-01-15",
      "content": "const x = 1;"
    }
  ],
  "summary": {
    "total_lines": 100,
    "authors": 3,
    "most_active_author": "John Doe",
    "last_modified": "2024-01-15"
  }
}
```

---

## 🔧 Common Parameters

### Pagination

Most tools support pagination for large result sets:

```json
{
  "limit": "number (default: 50, max: 500)",
  "offset": "number (default: 0)"
}
```

### Sorting

Many tools support result sorting:

```json
{
  "sortBy": "enum (varies by tool)",
  "sortOrder": "enum: asc|desc (default: asc)"
}
```

### Filtering

Tools often support filtering by severity or category:

```json
{
  "severity": "enum (varies by tool)",
  "category": "enum (varies by tool)"
}
```

## 🚀 Performance Notes

- **Rust Tools**: Native Rust implementations provide 5-10x performance improvement
- **Caching**: Results are cached for 1 hour by default
- **Parallel Execution**: Up to 5 tools can run concurrently
- **Memory Usage**: Optimized for large codebases with streaming processing

## 🔍 Error Handling

All tools return consistent error formats:

```json
{
  "error": {
    "code": "TOOL_ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error context",
    "suggestions": ["Possible solutions"]
  }
}
```

## 📚 Additional Resources

- **[CLI Usage Guide](../user-guide/cli-usage.md)** - Command-line interface
- **[Configuration Guide](configuration.md)** - Advanced configuration
- **[Integration Examples](../user-guide/workflow-examples.md)** - Real-world usage
- **[Performance Optimization](performance.md)** - Optimization tips

---

**Need help with a specific tool?** Use `moidvk <tool-name> --help` for detailed CLI help or check
our [troubleshooting guide](../user-guide/troubleshooting.md).
