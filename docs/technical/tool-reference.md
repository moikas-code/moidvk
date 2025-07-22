# Tool Reference

This comprehensive reference covers all available tools in MOIDVK, including parameters, examples, and expected outputs.

## 🎯 Overview

MOIDVK provides a comprehensive suite of development tools organized into categories:

- **Code Quality Tools** - Best practices, formatting, safety analysis
- **Security Tools** - Vulnerability scanning, production readiness
- **Accessibility Tools** - WCAG compliance, ADA testing
- **API Tools** - GraphQL schema and query analysis
- **State Management Tools** - Redux pattern analysis
- **Filesystem Tools** - Privacy-first file operations

## 🔍 Code Quality Tools

### check_code_practices

Analyzes JavaScript code snippets for best practices using ESLint.

**Purpose**: Detect common errors, enforce code style, and provide actionable feedback.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | ✅ | - | JavaScript code to analyze |
| `filename` | string | ❌ | - | Optional filename for context |
| `production` | boolean | ❌ | false | Enable stricter production rules |
| `limit` | number | ❌ | 50 | Maximum issues to return (1-500) |
| `offset` | number | ❌ | 0 | Starting index for pagination |
| `severity` | string | ❌ | "all" | Filter by severity (error, warning, all) |
| `ruleCategory` | string | ❌ | "all" | Filter by rule category |
| `sortBy` | string | ❌ | "line" | Sort field (line, severity, ruleId, message) |
| `sortOrder` | string | ❌ | "asc" | Sort order (asc, desc) |

#### Examples

**Basic Code Check**
```
"Check this code for best practices:
const x = 1
if (x == '1') console.log('match')"
```

**Production Mode Check**
```
"Check this code with production rules:
function processPayment(amount) {
  var total = amount * 1.1;
  return total;
}"
```

**Filtered Results**
```
"Check this code and show only errors:
const x = 1
if (x == '1') console.log('match')"
```

#### Expected Output

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

### format_code

Formats code using Prettier with consistent style.

**Purpose**: Automatically format code to maintain consistent style across projects.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | ✅ | - | Code to format |
| `filename` | string | ❌ | - | Filename to determine parser |
| `check` | boolean | ❌ | false | Check if formatting is needed |

#### Examples

**Basic Formatting**
```
"Format this code:
const x=1;const y=2;function add(a,b){return a+b;}"
```

**Check Formatting**
```
"Check if this code needs formatting:
const x=1;const y=2;"
```

**TypeScript Formatting**
```
"Format this TypeScript code:
interface User{name:string;age:number;}"
```

#### Expected Output

```
🎨 Code Formatting Results:

✅ Code formatted successfully

Formatted Code:
const x = 1;
const y = 2;

function add(a, b) {
  return a + b;
}
```

### check_safety_rules

Analyzes code against NASA JPL's Power of 10 safety-critical programming rules.

**Purpose**: Ensure code meets safety standards for critical systems.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | ✅ | - | Code to analyze |
| `filename` | string | ❌ | - | Optional filename for context |

#### Examples

**Safety Analysis**
```
"Check this code for safety violations:
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}"
```

**Critical System Check**
```
"Check this mission-critical code for NASA JPL standards:
function calculateTrajectory(velocity, angle) {
  var result = velocity * Math.sin(angle);
  return result;
}"
```

#### Expected Output

```
🛡️ Safety Analysis Results:

Safety Score: 75/100

❌ Critical Violations (1):
- Line 1: Recursion detected (Rule 1: Avoid recursion)

⚠️ Warnings (2):
- Line 1: Missing assertions (Rule 2: Use assertions)
- Line 2: Global variable usage (Rule 3: Avoid global variables)

✅ Passed Rules (7):
- No infinite loops detected
- No goto-like patterns
- Proper variable scope
- Loop bounds defined
- Function length acceptable
```

## 🛡️ Security Tools

### scan_security_vulnerabilities

Scans project dependencies for known security vulnerabilities.

**Purpose**: Identify and remediate security vulnerabilities in dependencies.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `projectPath` | string | ❌ | "." | Project path to scan |
| `severity` | string | ❌ | "all" | Minimum severity (low, moderate, high, critical) |
| `production` | boolean | ❌ | false | Scan only production dependencies |
| `format` | string | ❌ | "detailed" | Output format (summary, detailed) |
| `limit` | number | ❌ | 50 | Maximum vulnerabilities to return |
| `offset` | number | ❌ | 0 | Starting index for pagination |
| `sortBy` | string | ❌ | "severity" | Sort field (severity, package, title) |
| `sortOrder` | string | ❌ | "desc" | Sort order (asc, desc) |

#### Examples

**Full Security Scan**
```
"Scan my project for security vulnerabilities"
```

**High Severity Only**
```
"Check for high-severity security vulnerabilities only"
```

**Production Dependencies**
```
"Scan production dependencies for security issues"
```

#### Expected Output

```
🔒 Security Vulnerability Scan Results:

📊 Summary:
- Total vulnerabilities: 5
- Critical: 1
- High: 2
- Moderate: 1
- Low: 1

🚨 Critical Vulnerabilities (1):
- Package: lodash
- Version: 4.17.15
- Title: Prototype Pollution
- Description: Vulnerable to prototype pollution attacks
- Fix: Update to 4.17.21 or later

💡 Remediation:
Run: npm audit fix
Or: bun audit fix
```

### check_production_readiness

Analyzes code for production deployment readiness.

**Purpose**: Ensure code is ready for production deployment by checking for common issues.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | ✅ | - | Code to analyze |
| `filename` | string | ❌ | - | Optional filename for context |
| `strict` | boolean | ❌ | false | Enable extra strict mode |
| `limit` | number | ❌ | 50 | Maximum issues to return |
| `offset` | number | ❌ | 0 | Starting index for pagination |
| `category` | string | ❌ | "all" | Filter by category |
| `severity` | string | ❌ | "all" | Filter by severity |
| `sortBy` | string | ❌ | "line" | Sort field |
| `sortOrder` | string | ❌ | "asc" | Sort order |

#### Examples

**Production Readiness Check**
```
"Check if this code is production ready:
const API_KEY = 'sk-1234'; // TODO: move to env
console.log('Starting server...');
function processPayment() { /* TODO: implement */ }"
```

**Strict Mode Check**
```
"Check production readiness with strict mode:
function getUser(id) {
  console.log('Fetching user:', id);
  return users.find(u => u.id == id);
}"
```

#### Expected Output

```
📊 Production Readiness Analysis:

Readiness Score: 65/100

❌ Critical Issues (2):
- Line 1: Hardcoded API key detected
- Line 3: Incomplete implementation (TODO comment)

⚠️ Warnings (1):
- Line 2: Console.log statement found

✅ Passed Checks (7):
- No debugger statements
- No FIXME comments
- No XXX comments
- Proper error handling
- Function implementations complete
- No placeholder code
- No development artifacts

📋 Deployment Checklist:
- [ ] Remove hardcoded secrets
- [ ] Remove console.log statements
- [ ] Complete TODO implementations
```

## ♿ Accessibility Tools

### check_accessibility

Comprehensive accessibility testing using axe-core for WCAG compliance.

**Purpose**: Ensure web content meets accessibility standards (WCAG 2.2 Level AA).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | ✅ | - | HTML, JSX, TSX, or CSS code |
| `filename` | string | ❌ | - | Optional filename for context |
| `standard` | string | ❌ | "AA" | WCAG compliance level (A, AA, AAA) |
| `environment` | string | ❌ | "production" | Environment (development, production) |
| `include_contrast` | boolean | ❌ | true | Include color contrast checking |
| `rule_set` | string | ❌ | "full" | Rule set (minimal, forms, content, navigation, full) |
| `rules` | array | ❌ | [] | Specific axe rules to run |

#### Examples

**Basic Accessibility Check**
```
"Check this HTML for accessibility:
<html><head><title>Test</title></head><body>
<img src='logo.jpg'>
<button>Click me</button>
</body></html>"
```

**React Component Check**
```
"Check this React component for accessibility:
function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}"
```

**WCAG AAA Compliance**
```
"Check this HTML for WCAG AAA compliance:
<div>
  <h1>Welcome</h1>
  <p>This is a test page.</p>
</div>"
```

#### Expected Output

```
♿ Accessibility Analysis Results:

Accessibility Score: 85%

❌ Violations (2):
- Images must have alt text (critical)
  - Element: <img src="logo.jpg">
  - Fix: Add alt="Logo description"
- Color contrast insufficient (serious)
  - Element: <button>Click me</button>
  - Fix: Increase contrast ratio to 4.5:1

⚠️ Incomplete (1):
- Form labels need manual review
  - Element: <input type="text">
  - Action: Verify label association

✅ Passed Tests (15):
- Document has valid title
- Headings are properly structured
- Links have discernible text
- Buttons have accessible names
- No keyboard traps detected
```

## 🚀 GraphQL Tools

### check_graphql_schema

Comprehensive GraphQL schema validation and best practices analysis.

**Purpose**: Validate GraphQL schemas for syntax, security, and best practices.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `schema` | string | ✅ | - | GraphQL schema definition |
| `filename` | string | ❌ | - | Optional filename for context |
| `strict` | boolean | ❌ | false | Enable strict mode |
| `limit` | number | ❌ | 50 | Maximum issues to return |
| `offset` | number | ❌ | 0 | Starting index for pagination |
| `severity` | string | ❌ | "all" | Filter by severity |
| `category` | string | ❌ | "all" | Filter by category |
| `sortBy` | string | ❌ | "severity" | Sort field |
| `sortOrder` | string | ❌ | "desc" | Sort order |

#### Examples

**Basic Schema Validation**
```
"Check this GraphQL schema for best practices:
type User {
  id: ID!
  name: String!
  posts: [Post!]!
}

type Query {
  users: [User!]!
}"
```

**Strict Mode Validation**
```
"Check this GraphQL schema with strict mode:
type Product {
  id: ID!
  name: String!
  price: Float!
}

type Query {
  products: [Product!]!
}"
```

#### Expected Output

```
🔍 GraphQL Schema Analysis:

✅ Schema Validation: Passed
⚠️ Security Issues: 1
❌ Design Issues: 2

🚨 Security Concerns:
- Missing pagination on users field (Query.users)
  - Risk: Potential DoS attacks
  - Fix: Add pagination arguments

⚠️ Design Issues:
- Missing descriptions on types
  - Fix: Add descriptions for better documentation
- Inconsistent naming conventions
  - Fix: Use PascalCase for types

💡 Best Practices:
- Use input types for mutations
- Implement proper error handling
- Add field-level deprecation
```

### check_graphql_query

GraphQL query analysis and optimization.

**Purpose**: Analyze GraphQL queries for complexity, performance, and security.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ | - | GraphQL query to analyze |
| `schema` | string | ❌ | - | Optional schema for validation |
| `filename` | string | ❌ | - | Optional filename for context |
| `maxDepth` | number | ❌ | 7 | Maximum allowed query depth |
| `maxComplexity` | number | ❌ | 100 | Maximum allowed complexity |
| `limit` | number | ❌ | 50 | Maximum issues to return |
| `offset` | number | ❌ | 0 | Starting index for pagination |
| `severity` | string | ❌ | "all" | Filter by severity |
| `category` | string | ❌ | "all" | Filter by category |
| `sortBy` | string | ❌ | "severity" | Sort field |
| `sortOrder` | string | ❌ | "desc" | Sort order |

#### Examples

**Query Complexity Analysis**
```
"Check this GraphQL query for performance issues:
query GetUserData($userId: ID!) {
  user(id: $userId) {
    posts {
      comments {
        author {
          posts {
            comments {
              text
            }
          }
        }
      }
    }
  }
}"
```

**Query with Schema Validation**
```
"Analyze this GraphQL query with schema validation:
query GetProducts {
  products {
    id
    name
    price
    category {
      name
    }
  }
}"
```

#### Expected Output

```
📊 GraphQL Query Analysis:

Query Metrics:
- Depth: 6 levels
- Complexity: 85
- Field Count: 12
- Duplicate Fields: 0

🚨 Performance Issues:
- Query depth exceeds limit (6 > 5)
  - Risk: Potential DoS attacks
  - Fix: Reduce query depth

⚠️ Security Concerns:
- Missing pagination on posts field
  - Risk: Large result sets
  - Fix: Add first/after arguments

💡 Optimization Tips:
- Use fragments for repeated fields
- Implement field-level pagination
- Consider query complexity limits
```

## 🔄 Redux Tools

### check_redux_patterns

Redux/Redux Toolkit patterns and anti-patterns analysis.

**Purpose**: Analyze Redux code for best practices and modern patterns.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | ✅ | - | Redux code to analyze |
| `filename` | string | ❌ | - | Optional filename for context |
| `codeType` | string | ❌ | "auto" | Code type (reducer, action, store, selector, middleware, component, auto) |
| `strict` | boolean | ❌ | false | Enable strict mode |
| `limit` | number | ❌ | 50 | Maximum issues to return |
| `offset` | number | ❌ | 0 | Starting index for pagination |
| `severity` | string | ❌ | "all" | Filter by severity |
| `category` | string | ❌ | "all" | Filter by category |
| `sortBy` | string | ❌ | "severity" | Sort field |
| `sortOrder` | string | ❌ | "desc" | Sort order |

#### Examples

**Redux Reducer Analysis**
```
"Check this Redux reducer for best practices:
const initialState = { users: [], loading: false };

function userReducer(state = initialState, action) {
  switch (action.type) {
    case 'FETCH_USERS':
      state.loading = true;
      return state;
    default:
      return state;
  }
}"
```

**Redux Toolkit Analysis**
```
"Check this Redux Toolkit slice for patterns:
import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'users',
  initialState: { list: [], loading: false },
  reducers: {
    setUsers: (state, action) => {
      state.list = action.payload;
    }
  }
});"
```

#### Expected Output

```
🔍 Redux Pattern Analysis:

Code Type: Redux Toolkit Slice
✅ Modern Patterns: 3
❌ Anti-patterns: 1

🚨 Critical Issues:
- Direct state mutation detected
  - Line 3: state.loading = true
  - Fix: Use immutable updates

✅ Best Practices:
- Using Redux Toolkit createSlice
- Proper action creator patterns
- Immutable state updates (in reducers)
- Proper initial state structure

💡 Modern Redux Tips:
- Use createAsyncThunk for async operations
- Implement proper error handling
- Use TypeScript for type safety
- Consider RTK Query for API calls
```

## 📁 Filesystem Tools

### File Operations

#### create_file

Create a new file with content.

**Parameters**:
- `filePath` (string, required): Path to the file to create
- `content` (string, required): Content to write to the file
- `encoding` (string, optional): File encoding (default: utf8)

#### read_file

Read a file with optional embedding generation.

**Parameters**:
- `filePath` (string, required): Path to the file to read
- `forAI` (boolean, optional): Return embeddings for AI analysis
- `encoding` (string, optional): File encoding (default: utf8)

#### update_file

Update an existing file with automatic backup.

**Parameters**:
- `filePath` (string, required): Path to the file to update
- `content` (string, required): New content for the file
- `createBackup` (boolean, optional): Create backup before updating
- `encoding` (string, optional): File encoding (default: utf8)

#### delete_file

Delete a file with confirmation requirement.

**Parameters**:
- `filePath` (string, required): Path to the file to delete
- `confirmed` (boolean, optional): Explicit confirmation required

#### move_file

Move or rename a file.

**Parameters**:
- `sourcePath` (string, required): Current path of the file
- `destinationPath` (string, required): New path for the file
- `overwrite` (boolean, optional): Overwrite destination if exists

#### copy_file

Copy a file to a new location.

**Parameters**:
- `sourcePath` (string, required): Path of the file to copy
- `destinationPath` (string, required): Destination path for the copy
- `overwrite` (boolean, optional): Overwrite destination if exists

### Directory Operations

#### list_directory

List directory contents with metadata.

**Parameters**:
- `path` (string, optional): Directory path (default: ".")
- `includeHidden` (boolean, optional): Include hidden files
- `recursive` (boolean, optional): List recursively
- `limit` (number, optional): Maximum entries to return
- `offset` (number, optional): Starting index for pagination
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order

#### create_directory

Create a new directory.

**Parameters**:
- `directoryPath` (string, required): Path to the directory to create
- `recursive` (boolean, optional): Create parent directories

#### delete_directory

Delete a directory with confirmation.

**Parameters**:
- `directoryPath` (string, required): Path to the directory to delete
- `recursive` (boolean, optional): Delete recursively
- `confirmed` (boolean, optional): Explicit confirmation required

#### move_directory

Move an entire directory.

**Parameters**:
- `sourcePath` (string, required): Current path of the directory
- `destinationPath` (string, required): New path for the directory
- `overwrite` (boolean, optional): Overwrite destination if exists

### Search and Analysis Tools

#### search_files

Search for files by name pattern.

**Parameters**:
- `pattern` (string, required): Search pattern (supports wildcards)
- `directoryPath` (string, optional): Directory to search in
- `recursive` (boolean, optional): Search recursively
- `caseSensitive` (boolean, optional): Case sensitive search
- `limit` (number, optional): Maximum results to return
- `offset` (number, optional): Starting index for pagination

#### search_in_files

Search for text content within files.

**Parameters**:
- `searchText` (string, required): Text to search for
- `directoryPath` (string, optional): Directory to search in
- `filePattern` (string, optional): File pattern to search in
- `caseSensitive` (boolean, optional): Case sensitive search
- `limit` (number, optional): Maximum results to return
- `offset` (number, optional): Starting index for pagination

#### analyze_project

Generate project structure overview.

**Parameters**:
- `rootPath` (string, optional): Root directory to analyze
- `includeEmbeddings` (boolean, optional): Generate embeddings
- `maxDepth` (number, optional): Maximum directory depth
- `filePattern` (string, optional): File pattern to include
- `limit` (number, optional): Maximum entries to return
- `offset` (number, optional): Starting index for pagination

#### find_similar_files

Find semantically similar files using embeddings.

**Parameters**:
- `referencePath` (string, required): Reference file to find similar files for
- `searchPath` (string, optional): Directory to search in
- `topK` (number, optional): Number of similar files to return
- `threshold` (number, optional): Similarity threshold (0-1)

## 🔧 Tool Combinations

### Development Workflow

```
1. Check code quality
2. Format code
3. Check production readiness
4. Scan for security vulnerabilities
```

### Code Review Workflow

```
1. Analyze code patterns
2. Check accessibility (for UI code)
3. Validate GraphQL schemas/queries
4. Review Redux patterns
```

### Production Deployment Workflow

```
1. Production readiness check
2. Security vulnerability scan
3. Safety analysis (for critical code)
4. Final code quality verification
```

## 📊 Output Formats

All tools support multiple output formats:

- **Text**: Human-readable with emojis and formatting
- **JSON**: Machine-readable for automation
- **Detailed**: Comprehensive output with additional context

## 🚨 Error Handling

Tools provide detailed error information:

- **Validation Errors**: Invalid parameters or input
- **Processing Errors**: Issues during analysis
- **External Errors**: Network or service issues
- **Security Errors**: Permission or access issues

## 📚 Next Steps

After understanding the tools:

1. **Explore [Workflow Examples](workflow-examples.md)** - See real-world usage
2. **Check [CLI Usage](cli-usage.md)** - Learn command-line options
3. **Review [Production Deployment](production-deployment.md)** - Prepare for production
4. **Set up automation** - Integrate tools into your workflow

---

**Tool Reference Complete!** 🎉 You now have comprehensive knowledge of all MOIDVK tools. Explore the [Workflow Examples](workflow-examples.md) to see these tools in action.