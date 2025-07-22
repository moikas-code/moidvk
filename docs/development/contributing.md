# Contributing to MOIDVK

Thank you for your interest in contributing to MOIDVK! This guide will help you get started with
contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Documentation](#documentation)
- [Testing](#testing)
- [Release Process](#release-process)

## 🤝 Code of Conduct

### Our Pledge

We are committed to making participation in our project a harassment-free experience for everyone,
regardless of age, body size, disability, ethnicity, gender identity and expression, level of
experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting
the project team at conduct@moidvk.dev.

## 🚀 Getting Started

### Prerequisites

- **Bun** v1.0+ or **Node.js** v18+
- **Rust** v1.70+ (for native components)
- **Git** for version control
- **GitHub account** for contributions

### Quick Start

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/moidvk.git
cd moidvk

# Add upstream remote
git remote add upstream https://github.com/moikas-code/moidvk.git

# Install dependencies
bun install

# Build native components
bun run build:rust

# Run tests
bun test

# Start development server
bun run dev
```

## 🛠️ Development Setup

### Environment Setup

```bash
# Install development dependencies
bun install

# Set up pre-commit hooks
bun run setup:hooks

# Configure environment
cp .env.example .env.local
```

### Required Tools

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install additional Rust components
rustup component add clippy rustfmt

# Install Python tools (optional)
pip install ruff black mypy bandit
```

### IDE Configuration

#### VS Code

Install recommended extensions:

```json
{
  "recommendations": [
    "rust-lang.rust-analyzer",
    "esbenp.prettier-vscode",
    "ms-python.python",
    "bradlc.vscode-tailwindcss"
  ]
}
```

#### Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "rust-analyzer.checkOnSave.command": "clippy"
}
```

### Project Structure

```
moidvk/
├── lib/                    # Core library code
│   ├── tools/             # Language-specific tools
│   ├── rust-core/         # Rust native implementations
│   ├── security/          # Security and safety tools
│   ├── integration/       # External integrations
│   └── local-ai/          # AI and semantic features
├── test/                  # Test suites
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
├── .github/               # GitHub workflows and templates
└── examples/              # Usage examples
```

## 📝 Contributing Guidelines

### Types of Contributions

#### 🐛 Bug Reports

- Use the bug report template
- Include reproduction steps
- Provide system information
- Include error logs and stack traces

#### ✨ Feature Requests

- Use the feature request template
- Explain the use case and motivation
- Provide examples of expected behavior
- Consider implementation complexity

#### 🔧 Code Contributions

- Follow coding standards
- Include tests for new features
- Update documentation
- Ensure CI passes

#### 📚 Documentation

- Fix typos and improve clarity
- Add examples and use cases
- Update API documentation
- Translate to other languages

### Coding Standards

#### JavaScript/TypeScript

```javascript
// Use ESLint configuration
// Prefer const over let
const config = {
  production: true,
  timeout: 30000,
};

// Use descriptive names
function analyzeCodeQuality(sourceCode, options = {}) {
  // Implementation
}

// Add JSDoc comments for public APIs
/**
 * Analyzes code for quality issues
 * @param {string} sourceCode - The source code to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<AnalysisResult>} Analysis results
 */
async function analyzeCode(sourceCode, options) {
  // Implementation
}
```

#### Rust

```rust
// Follow rustfmt formatting
// Use descriptive names
pub fn analyze_code_performance(
    source_code: &str,
    options: &AnalysisOptions,
) -> Result<PerformanceReport, AnalysisError> {
    // Implementation
}

// Add documentation comments
/// Analyzes code for performance issues
///
/// # Arguments
/// * `source_code` - The source code to analyze
/// * `options` - Analysis configuration options
///
/// # Returns
/// A `Result` containing the performance report or an error
pub fn analyze_performance(
    source_code: &str,
    options: &AnalysisOptions,
) -> Result<PerformanceReport, AnalysisError> {
    // Implementation
}
```

#### Python

```python
# Follow PEP 8 and use Black formatting
def analyze_code_security(
    source_code: str,
    options: Optional[Dict[str, Any]] = None
) -> SecurityReport:
    """Analyze code for security vulnerabilities.

    Args:
        source_code: The source code to analyze
        options: Optional analysis configuration

    Returns:
        SecurityReport containing found vulnerabilities

    Raises:
        AnalysisError: If analysis fails
    """
    # Implementation
```

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

#### Examples

```
feat(tools): add Python type checking tool

Add mypy integration for Python type checking with configurable
strictness levels and error filtering.

Closes #123
```

```
fix(security): resolve vulnerability in dependency scanner

Fix path traversal vulnerability in dependency scanning that could
allow access to files outside project directory.

BREAKING CHANGE: Scanner now validates all file paths
```

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test improvements

## 🔄 Pull Request Process

### Before Submitting

1. **Fork and clone** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** following coding standards
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Run the test suite** and ensure all tests pass
7. **Run linting** and fix any issues
8. **Commit your changes** with descriptive messages

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Documentation updated
- [ ] No merge conflicts with main branch
- [ ] PR description clearly explains changes

### PR Template

```markdown
## Description

Brief description of changes and motivation.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as
      expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
```

### Review Process

1. **Automated checks** must pass (CI, linting, tests)
2. **Code review** by at least one maintainer
3. **Manual testing** for significant changes
4. **Documentation review** for user-facing changes
5. **Final approval** and merge by maintainer

## 🐛 Issue Guidelines

### Bug Reports

Use the bug report template and include:

```markdown
## Bug Description

Clear description of the bug.

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen.

## Actual Behavior

What actually happens.

## Environment

- OS: [e.g., Ubuntu 22.04]
- Node.js/Bun version: [e.g., v18.17.0]
- MOIDVK version: [e.g., v1.0.0]
- Rust version: [e.g., 1.70.0]

## Additional Context

Any other relevant information.
```

### Feature Requests

Use the feature request template:

```markdown
## Feature Description

Clear description of the proposed feature.

## Use Case

Why is this feature needed? What problem does it solve?

## Proposed Solution

How should this feature work?

## Alternatives Considered

Other approaches you've considered.

## Additional Context

Any other relevant information.
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `priority: high` - High priority issue
- `status: in progress` - Currently being worked on

## 📚 Documentation

### Documentation Standards

- **Clear and concise** writing
- **Code examples** for all features
- **Step-by-step instructions** for complex procedures
- **Screenshots** where helpful
- **Version information** for compatibility

### Documentation Types

#### API Documentation

```javascript
/**
 * Analyzes code for quality issues using ESLint
 *
 * @param {string} code - Source code to analyze
 * @param {Object} options - Analysis options
 * @param {boolean} options.production - Use production rules
 * @param {string} options.severity - Minimum severity level
 * @returns {Promise<AnalysisResult>} Analysis results
 *
 * @example
 * const result = await analyzeCode('const x = 1;', {
 *   production: true,
 *   severity: 'warning'
 * });
 */
```

#### User Guides

- **Getting Started** - Basic setup and usage
- **Tutorials** - Step-by-step walkthroughs
- **How-to Guides** - Specific task instructions
- **Reference** - Complete API documentation

#### Contributing to Documentation

```bash
# Install documentation dependencies
bun install

# Start documentation server
bun run docs:dev

# Build documentation
bun run docs:build

# Check for broken links
bun run docs:check
```

## 🧪 Testing

### Test Structure

```
test/
├── unit/                  # Unit tests
├── integration/           # Integration tests
├── e2e/                   # End-to-end tests
├── fixtures/              # Test data and fixtures
└── helpers/               # Test utilities
```

### Writing Tests

#### Unit Tests

```javascript
import { describe, it, expect } from 'bun:test';
import { analyzeCode } from '../lib/tools/code-analyzer.js';

describe('Code Analyzer', () => {
  it('should detect console statements', async () => {
    const code = 'console.log("test");';
    const result = await analyzeCode(code, { production: true });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].ruleId).toBe('no-console');
  });

  it('should handle invalid code gracefully', async () => {
    const code = 'invalid syntax {';
    const result = await analyzeCode(code);

    expect(result.error).toBeDefined();
    expect(result.error.type).toBe('syntax-error');
  });
});
```

#### Integration Tests

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { MoidvkServer } from '../lib/server.js';

describe('MCP Integration', () => {
  let server;

  beforeAll(async () => {
    server = new MoidvkServer({ port: 0 });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should handle tool calls via MCP', async () => {
    const client = createMCPClient({
      command: 'moidvk',
      args: ['serve', '--port', server.port],
    });

    const result = await client.callTool('check_code_practices', {
      code: 'const x = 1;',
    });

    expect(result).toBeDefined();
    expect(result.issues).toBeArray();
  });
});
```

#### Rust Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_analysis() {
        let code = "fn main() { println!(\"test\"); }";
        let result = analyze_rust_code(code, &AnalysisOptions::default());

        assert!(result.is_ok());
        let analysis = result.unwrap();
        assert_eq!(analysis.issues.len(), 0);
    }

    #[test]
    fn test_invalid_syntax() {
        let code = "invalid rust syntax {";
        let result = analyze_rust_code(code, &AnalysisOptions::default());

        assert!(result.is_err());
    }
}
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test test/unit/code-analyzer.test.js

# Run tests with coverage
bun test --coverage

# Run Rust tests
cd lib/rust-core && cargo test

# Run integration tests
bun test:integration

# Run end-to-end tests
bun test:e2e
```

### Test Guidelines

- **Write tests first** (TDD approach preferred)
- **Test edge cases** and error conditions
- **Use descriptive test names** that explain what is being tested
- **Keep tests isolated** and independent
- **Mock external dependencies** in unit tests
- **Maintain high test coverage** (aim for >80%)

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

### Release Workflow

1. **Create release branch** from `main`
2. **Update version numbers** in relevant files
3. **Update CHANGELOG.md** with release notes
4. **Run full test suite** and ensure all tests pass
5. **Create pull request** for release branch
6. **Review and merge** release PR
7. **Tag release** on main branch
8. **Publish to npm** via GitHub Actions
9. **Create GitHub release** with release notes

### Release Checklist

- [ ] Version bumped in `package.json`
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks run
- [ ] Release notes prepared

### Hotfix Process

For critical bug fixes:

1. **Create hotfix branch** from latest release tag
2. **Apply minimal fix** for the critical issue
3. **Test thoroughly** to ensure fix works
4. **Create emergency release** following abbreviated process
5. **Backport fix** to main branch if needed

## 🏆 Recognition

### Contributors

We recognize contributors in several ways:

- **Contributors list** in README.md
- **Release notes** mention significant contributions
- **GitHub achievements** and badges
- **Special recognition** for major contributions

### Becoming a Maintainer

Regular contributors may be invited to become maintainers based on:

- **Consistent quality contributions**
- **Understanding of project goals**
- **Positive community interaction**
- **Technical expertise** in relevant areas

## 📞 Getting Help

### Community Support

- **[GitHub Discussions](https://github.com/moikas-code/moidvk/discussions)** - General questions
  and ideas
- **[Discord](https://discord.gg/moidvk)** - Real-time chat with community
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/moidvk)** - Technical questions

### Maintainer Contact

- **Email**: maintainers@moidvk.dev
- **GitHub**: @moidvk-team
- **Discord**: #maintainers channel

## 📄 License

By contributing to MOIDVK, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to MOIDVK!** Your contributions help make development better for
everyone. 🚀
