# Rust Tools for MOIDVK

This directory contains Rust language support tools for the MOIDVK server.

## Tools Overview

### 1. rust-code-practices.js
- **Purpose**: Integrates with Rust's clippy linter
- **Features**: 
  - Comprehensive linting with 450+ rules
  - Configurable severity levels
  - Edition-specific analysis
  - Pedantic mode for strict checking
  - Full pagination and filtering support

### 2. rust-formatter.js
- **Purpose**: Code formatting using rustfmt
- **Features**:
  - Automatic code formatting
  - Configurable style options
  - Check-only mode
  - Edition awareness
  - Multiple formatting styles

### 3. rust-safety-checker.js
- **Purpose**: Memory safety and ownership analysis
- **Features**:
  - Unsafe code detection
  - Panic point identification
  - Memory safety scoring
  - Ownership validation
  - Production readiness checks

## Implementation Details

### Architecture
All Rust tools follow the same pattern as JavaScript tools:
1. Input validation using `rust-validation.js`
2. Secure subprocess execution for Rust toolchain
3. JSON output parsing and transformation
4. MCP-compliant response formatting

### Security
- All subprocess calls are sandboxed
- Input code is validated for size limits
- Temporary files are cleaned up automatically
- Error messages are sanitized

### Performance
- Subprocess calls have configurable timeouts
- Results support pagination for large outputs
- Filtering reduces data transfer
- Caching can be implemented at the client level

## Adding New Rust Tools

To add a new Rust tool:

1. Create a new file in `lib/rust/` following the naming pattern
2. Import validation utilities from `../utils/rust-validation.js`
3. Define the tool schema with MCP inputSchema
4. Implement the handler function
5. Export both the tool definition and handler
6. Register in `server.js`

### Template Structure
```javascript
import { validateRustCode, sanitizeRustFilename } from '../utils/rust-validation.js';
import { withTimeout, TIMEOUT_MS } from '../utils/timeout.js';

export const rustToolNameTool = {
  name: 'rust_tool_name',
  description: 'Tool description',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Rust code to analyze' },
      // ... other properties
    },
    required: ['code'],
  },
};

export async function handleRustToolName(args) {
  const { code } = args;
  
  // Validate input
  const validation = validateRustCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  // Tool implementation
  // ...
}
```

## Testing

Run the test script to verify tool functionality:
```bash
bun run test/test-rust-tools.js
```

## Dependencies

### Required Rust Components
- Rust toolchain (via rustup)
- Clippy: `rustup component add clippy`
- Rustfmt: `rustup component add rustfmt`
- Cargo-audit (optional): `cargo install cargo-audit`

### Node Dependencies
- tree-sitter: For AST parsing
- tree-sitter-rust: Rust grammar for tree-sitter

## Future Enhancements

1. **Cargo Integration**
   - Analyze Cargo.toml files
   - Dependency vulnerability scanning
   - Build configuration validation

2. **Advanced Analysis**
   - Macro expansion analysis
   - Trait implementation verification
   - Lifetime visualization
   - Async/await pattern checking

3. **Performance Tools**
   - Benchmark analysis
   - Optimization suggestions
   - SIMD usage detection

4. **Cross-Language Support**
   - FFI safety checking
   - Mixed JS/Rust project analysis
   - WASM compatibility checks