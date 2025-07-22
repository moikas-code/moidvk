# MOIDVK

## The Ultimate DevKit

[![Version](https://img.shields.io/badge/version-2.1.4-blue.svg)](https://github.com/moidvk/moidvk)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP Server](https://img.shields.io/badge/MCP-Server-orange.svg)](https://modelcontextprotocol.io/)
[![Built with Rust](https://img.shields.io/badge/built%20with-Rust-red.svg)](https://www.rust-lang.org/)
[![Powered by Bun](https://img.shields.io/badge/powered%20by-Bun-yellow.svg)](https://bun.sh/)

> **The Ultimate DevKit** - A comprehensive Model Context Protocol (MCP) server that unifies
> development best practices across JavaScript/TypeScript, Rust, Python, and Go into a single,
> powerful toolkit.

MOIDVK provides **43+ intelligent development tools** with security-first design, high-performance
Rust core, and seamless integration with your favorite AI assistants and development environments.

## ✨ Key Features

🚀 **Multi-Language Mastery**

- **JavaScript/TypeScript**: ESLint analysis, Prettier formatting, accessibility checks
- **Rust**: Clippy analysis, rustfmt formatting, performance optimization, safety checks
- **Python**: Ruff analysis, Black formatting, type checking, dependency scanning
- **Go**: go vet analysis, gofmt/goimports formatting, security scanning, performance analysis

🔒 **Security-First Architecture**

- Comprehensive vulnerability scanning across all languages
- Production readiness validation
- NASA JPL safety rule compliance checking
- Secure command execution with sandbox isolation

⚡ **High-Performance Core**

- Rust-powered vector operations and file search
- NAPI bindings for seamless JavaScript integration
- Local semantic embeddings for intelligent code search
- Optimized algorithms for large codebases

🧠 **Intelligent Development**

- KB-MCP bidirectional integration for enhanced workflows
- Semantic code search with contextual understanding
- Development session management across tools
- Intelligent tool routing and optimization

🛠️ **Developer Experience**

- 43+ tools in one unified MCP server
- CLI interface for standalone usage
- Comprehensive error handling and fallbacks
- Extensive documentation and examples

## 🚀 Quick Start

### Installation

```bash
# Using Bun (recommended)
bun install -g moidvk

# Using npm
npm install -g moidvk
```

### MCP Server Setup

Add MOIDVK to your MCP client configuration:

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

### CLI Usage

```bash
# Start the MCP server
moidvk serve

# Analyze JavaScript code
echo "const x = 1;" | moidvk check-code

# Format Rust code
moidvk rust-format -f src/lib.rs

# Check production readiness
moidvk check-production -f server.js --strict

# Semantic code search
moidvk search-semantic -p /path/to/project --query "authentication logic"
```

## 🛠️ Tool Categories

### 🔍 Code Quality & Analysis

| Tool                   | Language | Description                                    |
| ---------------------- | -------- | ---------------------------------------------- |
| `check_code_practices` | JS/TS    | ESLint analysis with pagination and filtering  |
| `rust_code_practices`  | Rust     | Clippy analysis with configurable lint levels  |
| `python_code_analyzer` | Python   | Ruff-powered analysis with comprehensive rules |

### 🎨 Code Formatting

| Tool                        | Language          | Description                                      |
| --------------------------- | ----------------- | ------------------------------------------------ |
| `format_code`               | JS/TS/CSS/HTML/MD | Prettier formatting with project config          |
| `eslint_auto_fixer`         | JS/TS             | ESLint auto-fix with comprehensive linting       |
| `multi_language_auto_fixer` | **All Languages** | **Universal auto-fixer with language detection** |
| `rust_formatter`            | Rust              | rustfmt with configurable style options          |
| `python_formatter`          | Python            | Black formatting with line length control        |

### 🔒 Security & Safety

| Tool                            | Language | Description                                |
| ------------------------------- | -------- | ------------------------------------------ |
| `scan_security_vulnerabilities` | All      | Project dependency vulnerability scanning  |
| `check_safety_rules`            | JS/TS    | NASA JPL safety-critical programming rules |
| `rust_safety_checker`           | Rust     | Memory safety and ownership validation     |
| `python_security_scanner`       | Python   | Bandit-powered security analysis           |

### 🚀 Production & Performance

| Tool                         | Language | Description                          |
| ---------------------------- | -------- | ------------------------------------ |
| `check_production_readiness` | JS/TS    | Production deployment validation     |
| `rust_production_readiness`  | Rust     | Production deployment best practices |
| `rust_performance_analyzer`  | Rust     | Performance hotspot identification   |
| `python_test_analyzer`       | Python   | Test coverage and quality metrics    |

### ♿ Accessibility & Standards

| Tool                   | Technology   | Description                            |
| ---------------------- | ------------ | -------------------------------------- |
| `check_accessibility`  | HTML/JSX/CSS | WCAG 2.2 compliance validation         |
| `check_graphql_schema` | GraphQL      | Schema validation and best practices   |
| `check_graphql_query`  | GraphQL      | Query complexity and security analysis |
| `check_redux_patterns` | Redux        | State management pattern validation    |

### 🧠 Intelligent Development

| Tool                               | Purpose  | Description                                 |
| ---------------------------------- | -------- | ------------------------------------------- |
| `intelligent_development_analysis` | Workflow | Optimal tool sequence orchestration         |
| `semantic_development_search`      | Search   | Context-aware code search with embeddings   |
| `development_session_manager`      | Sessions | Cross-client development session management |

### 🔧 New Critical Tools

| Tool                            | Purpose     | Description                                     |
| ------------------------------- | ----------- | ----------------------------------------------- |
| `js_test_analyzer`              | Testing     | JavaScript/TypeScript test analysis and quality |
| `bundle_size_analyzer`          | Performance | Bundle size analysis and optimization           |
| `container_security_scanner`    | Security    | Docker/container security analysis              |
| `documentation_quality_checker` | Quality     | Documentation analysis and completeness         |
| `openapi_rest_validator`        | API         | OpenAPI/REST API validation and compliance      |

### 🚀 New Performance & Infrastructure Tools

| Tool                           | Purpose     | Description                                                    |
| ------------------------------ | ----------- | -------------------------------------------------------------- |
| `js_performance_analyzer`      | Performance | JavaScript/TypeScript performance analysis and optimization    |
| `python_performance_analyzer`  | Performance | Python performance hotspot detection and optimization          |
| `cicd_configuration_analyzer`  | DevOps      | CI/CD pipeline analysis for GitHub Actions, GitLab CI, Jenkins |
| `license_compliance_scanner`   | Compliance  | License compatibility and compliance scanning                  |
| `environment_config_validator` | Config      | Environment configuration validation and security              |

## 🏗️ Architecture

### High-Performance Core

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   JavaScript    │    │    Rust Core     │    │   Python Tools  │
│   Tools & MCP   │◄──►│   (NAPI Bridge)  │◄──►│   Integration   │
│     Server      │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Development   │    │   Vector Ops &   │    │   Security &    │
│   Intelligence  │    │   Embeddings     │    │   Validation    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Integration Layer

- **KB-MCP Bidirectional Integration**: Intelligent routing between MOIDVK and KB-MCP
- **Semantic Search**: Local embeddings with cross-project intelligence
- **Session Management**: Persistent development context across tools
- **Security Sandbox**: Isolated command execution with comprehensive validation

## 📊 Performance Metrics

- **Vector Operations**: 10x faster than pure JavaScript implementations
- **File Search**: Rust-powered search across large codebases
- **Memory Usage**: Optimized with intelligent caching and cleanup
- **Tool Execution**: Sub-second response times for most operations
- **Concurrent Processing**: Up to 5 parallel tool executions

## 🔧 Configuration

### Basic Configuration (`.mcp.json`)

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {},
      "integration": {
        "kbMcp": {
          "enabled": true,
          "intelligentRouting": true,
          "preferredTools": {
            "semanticSearch": "hybrid",
            "codeAnalysis": "moidvk",
            "securityScanning": "moidvk"
          }
        }
      }
    }
  }
}
```

### Advanced Features

- **Intelligent Routing**: Automatic tool selection based on context
- **Caching**: Result caching with configurable TTL
- **Error Handling**: Comprehensive fallback mechanisms
- **Performance Monitoring**: Built-in metrics and optimization

## 🤝 Integration Examples

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

### VS Code with MCP Extension

```json
{
  "mcp.servers": [
    {
      "name": "moidvk",
      "command": "moidvk serve"
    }
  ]
}
```

### Programmatic Usage

```javascript
import { createMCPClient } from '@modelcontextprotocol/client';

const client = createMCPClient({
  command: 'moidvk',
  args: ['serve'],
});

const result = await client.callTool('check_code_practices', {
  code: 'const x = 1;',
  production: true,
});
```

## 🚀 Development

### Prerequisites

- **Bun** v1.0+ (recommended) or **Node.js** v18+
- **Rust** v1.70+ (for building native components)
- **Python** v3.8+ (for Python tool integration)

### Building from Source

```bash
# Clone the repository
git clone https://github.com/moidvk/moidvk
cd moidvk

# Install dependencies
bun install

# Build Rust core
bun run build:rust

# Start development server
bun run dev
```

### Running Tests

```bash
# Run comprehensive test suite
bun test

# Test specific language tools
bun test:rust
bun test:python
bun test:javascript
```

### Project Structure

```
moidvk/
├── lib/
│   ├── tools/           # Language-specific analysis tools
│   ├── rust-core/       # High-performance Rust implementations
│   ├── security/        # Security and safety validation
│   ├── integration/     # KB-MCP and external integrations
│   └── local-ai/        # Semantic search and embeddings
├── docs/                # Comprehensive documentation
├── test/                # Test suites and examples
└── scripts/             # Build and deployment scripts
```

## 📚 Documentation

- **[Getting Started Guide](docs/user-guide/getting-started.md)** - Setup and first steps
- **[Tool Reference](docs/technical/tool-reference.md)** - Complete tool documentation
- **[Integration Guide](docs/technical/mcp-integration.md)** - MCP client integration
- **[Development Guide](docs/development/)** - Contributing and development
- **[API Documentation](docs/technical/)** - Technical specifications

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the full test suite
5. Submit a pull request

### Code Standards

- All code must pass security scans
- Maintain test coverage above 80%
- Follow language-specific style guides
- Document new features and APIs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Model Context Protocol](https://modelcontextprotocol.io/)** - Foundation for tool integration
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime and toolkit
- **[Rust](https://www.rust-lang.org/)** - Systems programming language for performance-critical
  components
- **Community Contributors** - Thanks to all who make MOIDVK better

---

<div align="center">

**Built with ❤️ by the MOIDVK team**

[Website](https://moidvk.dev) • [Documentation](docs/) •
[Issues](https://github.com/moidvk/moidvk/issues) •
[Discussions](https://github.com/moidvk/moidvk/discussions)

</div>
