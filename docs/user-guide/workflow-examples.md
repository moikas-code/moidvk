# Workflow Examples

This guide provides real-world examples and workflows for using MOIDVK in various development scenarios.

## 🎯 Overview

MOIDVK workflows are designed to integrate seamlessly into your development process, from initial coding to production deployment. Each workflow follows the **Golden Rule**: Always use MOIDVK tools before manual analysis.

## 🚀 Development Workflows

### New Feature Development

**Scenario**: You're developing a new feature and want to ensure code quality throughout the process.

#### Step 1: Initial Code Quality Check

```javascript
// Your new feature code
function processUserData(user) {
  var data = user.data;
  if (data == null) return null;
  
  var result = {};
  for (var key in data) {
    result[key] = data[key];
  }
  
  console.log('Processed user data:', result);
  return result;
}
```

**MOIDVK Check**:
```
"Check this code for best practices:
function processUserData(user) {
  var data = user.data;
  if (data == null) return null;
  
  var result = {};
  for (var key in data) {
    result[key] = data[key];
  }
  
  console.log('Processed user data:', result);
  return result;
}"
```

**Expected Feedback**:
- Use `const`/`let` instead of `var`
- Use strict equality (`===`)
- Remove `console.log` for production
- Consider using `Object.assign()` or spread operator

#### Step 2: Code Formatting

```
"Format this code:
function processUserData(user) {
  var data = user.data;
  if (data == null) return null;
  
  var result = {};
  for (var key in data) {
    result[key] = data[key];
  }
  
  console.log('Processed user data:', result);
  return result;
}"
```

#### Step 3: Production Readiness Check

```
"Check if this code is production ready:
function processUserData(user) {
  const data = user.data;
  if (data === null) return null;
  
  const result = {};
  for (const key in data) {
    result[key] = data[key];
  }
  
  console.log('Processed user data:', result);
  return result;
}"
```

### API Development Workflow

**Scenario**: You're building a REST API and want to ensure security and best practices.

#### Step 1: GraphQL Schema Validation

```graphql
# Your GraphQL schema
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
}

type Query {
  users: [User!]!
  posts: [Post!]!
}
```

**MOIDVK Check**:
```
"Check this GraphQL schema for best practices and security:
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
}

type Query {
  users: [User!]!
  posts: [Post!]!
}"
```

**Expected Feedback**:
- Missing pagination on list fields
- Missing descriptions for documentation
- Consider input types for mutations
- Add proper error handling

#### Step 2: GraphQL Query Optimization

```graphql
# Your GraphQL query
query GetUserWithPosts($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    posts {
      id
      title
      content
      author {
        id
        name
        posts {
          id
          title
        }
      }
    }
  }
}
```

**MOIDVK Check**:
```
"Analyze this GraphQL query for performance and security:
query GetUserWithPosts($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    posts {
      id
      title
      content
      author {
        id
        name
        posts {
          id
          title
        }
      }
    }
  }
}"
```

**Expected Feedback**:
- Query depth exceeds recommended limit
- Missing pagination on posts field
- Consider using fragments for repeated fields
- High complexity score

### State Management Workflow

**Scenario**: You're implementing Redux state management and want to follow modern patterns.

#### Step 1: Redux Pattern Analysis

```javascript
// Your Redux code
const initialState = {
  users: [],
  loading: false,
  error: null
};

function userReducer(state = initialState, action) {
  switch (action.type) {
    case 'FETCH_USERS_START':
      state.loading = true;
      return state;
    case 'FETCH_USERS_SUCCESS':
      state.users = action.payload;
      state.loading = false;
      return state;
    case 'FETCH_USERS_ERROR':
      state.error = action.payload;
      state.loading = false;
      return state;
    default:
      return state;
  }
}
```

**MOIDVK Check**:
```
"Check this Redux code for patterns and anti-patterns:
const initialState = {
  users: [],
  loading: false,
  error: null
};

function userReducer(state = initialState, action) {
  switch (action.type) {
    case 'FETCH_USERS_START':
      state.loading = true;
      return state;
    case 'FETCH_USERS_SUCCESS':
      state.users = action.payload;
      state.loading = false;
      return state;
    case 'FETCH_USERS_ERROR':
      state.error = action.payload;
      state.loading = false;
      return state;
    default:
      return state;
  }
}"
```

**Expected Feedback**:
- Direct state mutations detected
- Consider using Redux Toolkit
- Use immutable updates
- Implement proper error handling

#### Step 2: Redux Toolkit Migration

```javascript
// Modern Redux Toolkit approach
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async () => {
    const response = await fetch('/api/users');
    return response.json();
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState: {
    list: [],
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});
```

**MOIDVK Check**:
```
"Check this Redux Toolkit code for modern patterns:
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async () => {
    const response = await fetch('/api/users');
    return response.json();
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState: {
    list: [],
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});"
```

**Expected Feedback**:
- ✅ Using modern Redux Toolkit patterns
- ✅ Proper async thunk implementation
- ✅ Immutable state updates
- ✅ Proper error handling

## 🛡️ Security Workflows

### Dependency Security Audit

**Scenario**: You want to ensure your project dependencies are secure.

#### Step 1: Full Security Scan

```
"Scan my project for security vulnerabilities"
```

**Expected Output**:
- List of vulnerabilities by severity
- Affected packages and versions
- Remediation commands
- Security score

#### Step 2: Production Dependencies Only

```
"Scan production dependencies for security vulnerabilities"
```

#### Step 3: High Severity Focus

```
"Check for high and critical security vulnerabilities only"
```

### Code Security Review

**Scenario**: You're reviewing code for security issues before deployment.

#### Step 1: Production Readiness Check

```javascript
// Code to review
const API_KEY = process.env.API_KEY || 'default-key';
const userInput = req.body.data;

function processData(input) {
  // TODO: Add input validation
  return eval(input); // DANGEROUS!
}

console.log('Processing:', userInput);
```

**MOIDVK Check**:
```
"Check if this code is production ready:
const API_KEY = process.env.API_KEY || 'default-key';
const userInput = req.body.data;

function processData(input) {
  // TODO: Add input validation
  return eval(input); // DANGEROUS!
}

console.log('Processing:', userInput);"
```

**Expected Feedback**:
- ❌ Hardcoded fallback API key
- ❌ Dangerous `eval()` usage
- ❌ Missing input validation
- ❌ Console.log in production code
- ❌ TODO comment indicates incomplete implementation

#### Step 2: Safety Analysis

```
"Check this code for safety violations:
const API_KEY = process.env.API_KEY || 'default-key';
const userInput = req.body.data;

function processData(input) {
  // TODO: Add input validation
  return eval(input); // DANGEROUS!
}

console.log('Processing:', userInput);"
```

**Expected Feedback**:
- ❌ Critical: Dangerous eval() usage
- ❌ Critical: No input validation
- ⚠️ Warning: Hardcoded secrets
- ⚠️ Warning: Missing assertions

## ♿ Accessibility Workflows

### Web Application Accessibility

**Scenario**: You're building a web application and need to ensure ADA compliance.

#### Step 1: HTML Accessibility Check

```html
<!-- Your HTML code -->
<html>
<head>
  <title>User Dashboard</title>
</head>
<body>
  <div class="header">
    <img src="logo.png">
    <button onclick="toggleMenu()">Menu</button>
  </div>
  
  <div class="content">
    <h2>Welcome</h2>
    <p>This is your dashboard.</p>
    <form>
      <input type="text" placeholder="Enter name">
      <button type="submit">Save</button>
    </form>
  </div>
</body>
</html>
```

**MOIDVK Check**:
```
"Check this HTML for accessibility issues:
<html>
<head>
  <title>User Dashboard</title>
</head>
<body>
  <div class="header">
    <img src="logo.png">
    <button onclick="toggleMenu()">Menu</button>
  </div>
  
  <div class="content">
    <h2>Welcome</h2>
    <p>This is your dashboard.</p>
    <form>
      <input type="text" placeholder="Enter name">
      <button type="submit">Save</button>
    </form>
  </div>
</body>
</html>"
```

**Expected Feedback**:
- ❌ Images missing alt text
- ❌ Form inputs missing labels
- ❌ Missing semantic HTML elements
- ⚠️ Color contrast may be insufficient

#### Step 2: React Component Accessibility

```jsx
// Your React component
function UserProfile({ user }) {
  return (
    <div>
      <img src={user.avatar} />
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <button onClick={() => editProfile()}>
        Edit Profile
      </button>
    </div>
  );
}
```

**MOIDVK Check**:
```
"Check this React component for accessibility:
function UserProfile({ user }) {
  return (
    <div>
      <img src={user.avatar} />
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <button onClick={() => editProfile()}>
        Edit Profile
      </button>
    </div>
  );
}"
```

**Expected Feedback**:
- ❌ Image missing alt text
- ⚠️ Button missing accessible name
- ✅ Proper heading structure
- ✅ Semantic HTML usage

## 📊 Performance Workflows

### GraphQL Query Optimization

**Scenario**: You need to optimize GraphQL queries for better performance.

#### Step 1: Query Complexity Analysis

```graphql
# Complex query to analyze
query GetUserDashboard($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    profile {
      bio
      avatar
    }
    posts {
      id
      title
      content
      comments {
        id
        text
        author {
          id
          name
          profile {
            avatar
          }
        }
      }
      tags {
        id
        name
        posts {
          id
          title
        }
      }
    }
    followers {
      id
      name
      posts {
        id
        title
      }
    }
  }
}
```

**MOIDVK Check**:
```
"Analyze this GraphQL query for performance issues:
query GetUserDashboard($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    profile {
      bio
      avatar
    }
    posts {
      id
      title
      content
      comments {
        id
        text
        author {
          id
          name
          profile {
            avatar
          }
        }
      }
      tags {
        id
        name
        posts {
          id
          title
        }
      }
    }
    followers {
      id
      name
      posts {
        id
        title
      }
    }
  }
}"
```

**Expected Feedback**:
- ❌ Query depth exceeds limit (8 levels)
- ❌ High complexity score (150+)
- ❌ Missing pagination on list fields
- ⚠️ Potential N+1 query issues
- 💡 Suggestions for optimization

#### Step 2: Optimized Query

```graphql
# Optimized query
query GetUserDashboard($userId: ID!, $first: Int = 10) {
  user(id: $userId) {
    id
    name
    email
    profile {
      bio
      avatar
    }
    posts(first: $first) {
      edges {
        node {
          id
          title
          content
          comments(first: 5) {
            edges {
              node {
                id
                text
                author {
                  id
                  name
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

**MOIDVK Check**:
```
"Check this optimized GraphQL query:
query GetUserDashboard($userId: ID!, $first: Int = 10) {
  user(id: $userId) {
    id
    name
    email
    profile {
      bio
      avatar
    }
    posts(first: $first) {
      edges {
        node {
          id
          title
          content
          comments(first: 5) {
            edges {
              node {
                id
                text
                author {
                  id
                  name
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}"
```

**Expected Feedback**:
- ✅ Query depth within limits
- ✅ Pagination implemented
- ✅ Reasonable complexity score
- ✅ Proper cursor-based pagination

## 🔄 Integration Workflows

### CI/CD Pipeline Integration

**Scenario**: You want to integrate MOIDVK into your continuous integration pipeline.

#### GitHub Actions Workflow

```yaml
name: Code Quality Check
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Install MOIDVK
        run: bun install -g moidvk
      
      - name: Check Code Quality
        run: |
          find . -name "*.js" -not -path "./node_modules/*" | while read file; do
            moidvk check-code -f "$file" --production || exit 1
          done
      
      - name: Check Production Readiness
        run: |
          find . -name "*.js" -not -path "./node_modules/*" | while read file; do
            moidvk check-production -f "$file" --strict || exit 1
          done
      
      - name: Scan Security Vulnerabilities
        run: moidvk scan-security --severity high || exit 1
      
      - name: Format Check
        run: |
          find . -name "*.js" -not -path "./node_modules/*" | while read file; do
            moidvk format -f "$file" --check || exit 1
          done
```

#### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "🔍 Running MOIDVK checks..."

# Get staged JavaScript files
files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js$')

if [ -n "$files" ]; then
  echo "Checking staged JavaScript files..."
  
  for file in $files; do
    echo "Checking $file..."
    
    # Check code quality
    moidvk check-code -f "$file" --production || exit 1
    
    # Check production readiness
    moidvk check-production -f "$file" --strict || exit 1
    
    # Format check
    moidvk format -f "$file" --check || exit 1
  done
  
  echo "✅ All checks passed!"
else
  echo "No JavaScript files to check."
fi
```

### IDE Integration

#### VS Code Tasks

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
      },
      "problemMatcher": []
    },
    {
      "label": "Format Code",
      "type": "shell",
      "command": "moidvk",
      "args": ["format", "-f", "${file}"],
      "group": "build"
    },
    {
      "label": "Check Production Readiness",
      "type": "shell",
      "command": "moidvk",
      "args": ["check-production", "-f", "${file}", "--strict"],
      "group": "build"
    }
  ]
}
```

#### VS Code Keybindings

```json
{
  "key": "ctrl+shift+q",
  "command": "workbench.action.tasks.runTask",
  "args": "Check Code Quality"
},
{
  "key": "ctrl+shift+f",
  "command": "workbench.action.tasks.runTask",
  "args": "Format Code"
},
{
  "key": "ctrl+shift+p",
  "command": "workbench.action.tasks.runTask",
  "args": "Check Production Readiness"
}
```

## 📁 Filesystem Workflows

### Project Analysis Workflow

**Scenario**: You want to analyze your project structure and find similar files.

#### Step 1: Project Structure Analysis

```
"Analyze the project structure with embeddings"
```

**Expected Output**:
- Project overview with file counts
- Directory structure
- File type distribution
- Embeddings for AI analysis

#### Step 2: Find Similar Files

```
"Find files similar to src/auth.js"
```

**Expected Output**:
- List of semantically similar files
- Similarity scores
- File paths and descriptions

#### Step 3: Search for Patterns

```
"Search for all files containing 'TODO' comments"
```

**Expected Output**:
- Files with TODO comments
- Line numbers and context
- Categorized by priority

### Code Review Workflow

**Scenario**: You're reviewing code and need to extract safe snippets for sharing.

#### Step 1: Extract Safe Snippets

```
"Extract safe snippets from src/payment.js for code review"
```

**Expected Output**:
- Sanitized code snippets
- Sensitive data removed
- Safe for sharing

#### Step 2: Batch Analysis

```
"Check all JavaScript files in src/ for best practices"
```

**Expected Output**:
- Summary of all files
- Issues by file
- Overall project score

## 🎯 Best Practices

### Workflow Optimization

1. **Start Early**: Use MOIDVK tools from the beginning of development
2. **Automate**: Integrate tools into your CI/CD pipeline
3. **Regular Scans**: Schedule security vulnerability scans weekly
4. **Document**: Keep track of issues and resolutions

### Tool Selection

- **Code Quality**: Use `check_code_practices` for all JavaScript code
- **Security**: Use `scan_security_vulnerabilities` regularly
- **Production**: Use `check_production_readiness` before deployment
- **Accessibility**: Use `check_accessibility` for UI components
- **Performance**: Use GraphQL tools for API optimization

### Error Handling

- **Graceful Degradation**: Handle tool failures gracefully
- **Fallback Options**: Provide alternative analysis methods
- **User Feedback**: Give clear feedback on tool usage
- **Logging**: Log tool usage and results for analysis

## 📚 Next Steps

After mastering these workflows:

1. **Customize**: Adapt workflows to your specific needs
2. **Automate**: Set up automated checks in your pipeline
3. **Monitor**: Track improvements over time
4. **Share**: Share successful workflows with your team

## 🆘 Getting Help

For workflow-specific issues:

1. **Check tool documentation** in [Tool Reference](tool-reference.md)
2. **Review CLI options** in [CLI Usage](cli-usage.md)
3. **Explore troubleshooting** in [Troubleshooting Guide](troubleshooting.md)
4. **Create an issue** in the GitHub repository

---

**Workflow Mastery Complete!** 🎉 You now have comprehensive examples for using MOIDVK in real-world scenarios. Customize these workflows to fit your development process and team needs.