# Rust Language Support for MOIDVK

## Overview

MOIDVK now supports Rust language analysis alongside JavaScript/TypeScript. This integration provides comprehensive code quality, safety, and formatting tools specifically designed for Rust development.

## Available Rust Tools

### 1. `rust_code_practices`
Analyzes Rust code for best practices using clippy.

**Features:**
- Integration with clippy for 450+ lints
- Configurable lint levels (allow, warn, deny, forbid)
- Support for different Rust editions (2015, 2018, 2021, 2024)
- Pedantic mode for stricter analysis
- Pagination and filtering for large codebases
- Category-based filtering (correctness, suspicious, style, complexity, perf)

**Example usage:**
```json
{
  "tool": "rust_code_practices",
  "code": "fn main() { let x = 1; }",
  "edition": "2021",
  "pedantic": true,
  "limit": 50
}
```

### 2. `rust_formatter`
Formats Rust code using rustfmt.

**Features:**
- Integration with rustfmt
- Configurable formatting options
- Support for different editions
- Check mode to verify formatting without changes
- Style options: indent style, line width, tab spaces

**Example usage:**
```json
{
  "tool": "rust_formatter",
  "code": "fn main(){let x=1;}",
  "edition": "2021",
  "max_width": 100,
  "tab_spaces": 4
}
```

### 3. `rust_safety_checker`
Analyzes Rust code for memory safety issues and unsafe usage.

**Features:**
- Detects unsafe blocks and raw pointers
- Identifies potential panic points (unwrap, expect, panic!)
- Checks for proper error handling patterns
- Memory safety score (0-100)
- Validates ownership and borrowing patterns
- Strict mode for zero-tolerance unsafe code

**Example usage:**
```json
{
  "tool": "rust_safety_checker",
  "code": "fn main() { unsafe { /* code */ } }",
  "strict": true
}
```

## Installation Requirements

### 1. Rust Toolchain
The Rust tools require a working Rust installation:

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add clippy and rustfmt components
rustup component add clippy
rustup component add rustfmt
```

### 2. Node Dependencies
The following dependencies are added to support Rust parsing:

```json
{
  "tree-sitter": "^0.21.0",
  "tree-sitter-rust": "^0.21.0"
}
```

Install with:
```bash
bun install
```

## Architecture

### File Structure
```
lib/
├── rust/
│   ├── rust-code-practices.js      # Clippy integration
│   ├── rust-formatter.js           # Rustfmt integration
│   └── rust-safety-checker.js      # Safety analysis
└── utils/
    └── rust-validation.js          # Rust-specific validation utilities
```

### Key Components

1. **Validation Layer**: Ensures code safety and sanitizes inputs
2. **Tool Integration**: Spawns Rust toolchain processes securely
3. **Result Parsing**: Converts Rust tool output to MCP format
4. **Error Handling**: Graceful degradation when tools aren't available

## Integration with Existing Tools

The Rust tools integrate seamlessly with existing MOIDVK features:

- **Pagination**: All tools support limit/offset for large results
- **Filtering**: Filter by severity, category, or custom criteria
- **Sorting**: Sort results by various fields
- **Security**: Uses the same security sandbox as other tools
- **Intelligent Analysis**: Works with `intelligent_development_analysis`

## Usage Examples

### Basic Code Check
```javascript
// Check Rust code for issues
const result = await mcp.call('rust_code_practices', {
  code: `
    fn divide(a: i32, b: i32) -> i32 {
      a / b  // Missing error handling
    }
  `,
  pedantic: true
});
```

### Format Code
```javascript
// Format Rust code
const result = await mcp.call('rust_formatter', {
  code: 'fn main(){println!("Hello");}',
  indent_style: 'Block',
  max_width: 80
});
```

### Safety Analysis
```javascript
// Check for safety issues
const result = await mcp.call('rust_safety_checker', {
  code: `
    fn risky() {
      let data = vec![1, 2, 3];
      let ptr = data.as_ptr();
      unsafe {
        *ptr.offset(10)  // Out of bounds!
      }
    }
  `,
  strict: true
});
```

## Future Enhancements

### Planned Tools
1. **rust_security_scanner**: Integration with cargo-audit for dependency scanning
2. **rust_production_readiness**: Production deployment checks
3. **rust_performance_analyzer**: Performance lint integration
4. **rust_test_analyzer**: Test coverage and quality analysis

### Features in Development
- Cross-language project analysis (mixed JS/Rust)
- Cargo.toml analysis and validation
- Macro expansion analysis
- Lifetime visualization
- Trait implementation verification

## Troubleshooting

### Common Issues

1. **"Cargo not found" error**
   - Ensure Rust is installed: `rustup --version`
   - Add cargo to PATH: `source $HOME/.cargo/env`

2. **"rustfmt not installed" error**
   - Install rustfmt: `rustup component add rustfmt`

3. **Timeout errors**
   - Large files may exceed timeout limits
   - Consider breaking code into smaller chunks

### Performance Tips

- Use pagination for large codebases
- Enable caching for repeated analysis
- Filter results to relevant categories
- Use check mode for quick validation

## Contributing

To add new Rust tools:

1. Create tool file in `lib/rust/`
2. Follow existing patterns for consistency
3. Add comprehensive error handling
4. Include pagination and filtering
5. Register in server.js
6. Add tests and documentation

## License

Same as MOIDVK project (MIT)