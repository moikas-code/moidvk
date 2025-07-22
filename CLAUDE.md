  # Development Standards & MCP Integration

  ## Required Development Tools
  **ALWAYS use the moidvk MCP server located at `/home/moika/Documents/code/moidvk` for ALL
   code implementation, analysis, and auditing tasks.**

  ### Code Quality & Security
  - Use `mcp__moidvk__check_code_practices` for JavaScript/TypeScript code analysis
  - Use `mcp__moidvk__rust_code_practices` for Rust code analysis
  - Use `mcp__moidvk__python_code_analyzer` for Python code analysis
  - Run `mcp__moidvk__scan_security_vulnerabilities` on all projects
  - Use `mcp__moidvk__check_production_readiness` before deployment
  - Use `mcp__moidvk__rust_security_scanner` for Rust dependency security
  - Use `mcp__moidvk__python_security_scanner` for Python security analysis

  ### Code Formatting & Safety
  - Format code with `mcp__moidvk__format_code` (supports JS/TS/CSS/HTML/MD/YAML)
  - Format Rust with `mcp__moidvk__rust_formatter`
  - Format Python with `mcp__moidvk__python_formatter`
  - Check safety rules with `mcp__moidvk__check_safety_rules`
  - Use `mcp__moidvk__rust_safety_checker` for Rust memory safety
  - Use `mcp__moidvk__python_type_checker` for Python type validation

  ### Performance & Production Readiness
  - Use `mcp__moidvk__rust_performance_analyzer` for Rust optimization
  - Use `mcp__moidvk__rust_production_readiness` for Rust deployment checks
  - Use `mcp__moidvk__python_test_analyzer` for test quality assessment
  - Use `mcp__moidvk__python_dependency_scanner` for Python dependencies

  ### Development Workflow & Collaboration
  - Use `mcp__moidvk__intelligent_development_analysis` for optimal tool sequencing
  - Manage sessions with `mcp__moidvk__development_session_manager`
  - Use `mcp__moidvk__secure_bash` for safe command execution with learning
  - Use `mcp__moidvk__git_blame_analyzer` for code ownership analysis
  
  **Note**: File operations and search functionality are handled by KB-MCP integration
  for enhanced semantic understanding and cross-project intelligence.

  ### Web & API Standards
  - Check accessibility with `mcp__moidvk__check_accessibility` for HTML/JSX/CSS
  - Validate GraphQL with `mcp__moidvk__check_graphql_schema` and
  `mcp__moidvk__check_graphql_query`
  - Check Redux patterns with `mcp__moidvk__check_redux_patterns`

  ### Knowledge Management
  - Use the kb-mcp server for documentation and knowledge management
  - Use sequential-thinking MCP for complex problem solving
  - Use memory MCP for context preservation across sessions

  ## Mandatory Workflow
  1. **ALWAYS** start with moidvk file analysis tools
  2. **ALWAYS** run appropriate language-specific code quality checks
  3. **ALWAYS** check for security vulnerabilities in dependencies
  4. **ALWAYS** format code using moidvk formatters before completion
  5. **ALWAYS** run production readiness checks before deployment
  6. **ALWAYS** use moidvk secure tools for bash and grep operations
  7. **ALWAYS** leverage intelligent development analysis for complex tasks
  8. **ALWAYS** maintain session continuity with development session manager

  ## Language-Specific Requirements

  ### Rust Projects
  - Run clippy analysis with `mcp__moidvk__rust_code_practices`
  - Check memory safety with `mcp__moidvk__rust_safety_checker`
  - Analyze performance with `mcp__moidvk__rust_performance_analyzer`
  - Scan dependencies with `mcp__moidvk__rust_security_scanner`
  - Format with `mcp__moidvk__rust_formatter`

  ### Python Projects
  - Analyze with `mcp__moidvk__python_code_analyzer`
  - Type check with `mcp__moidvk__python_type_checker`
  - Security scan with `mcp__moidvk__python_security_scanner`
  - Test analysis with `mcp__moidvk__python_test_analyzer`
  - Dependency scan with `mcp__moidvk__python_dependency_scanner`

  ### JavaScript/TypeScript Projects
  - Check practices with `mcp__moidvk__check_code_practices`
  - Validate accessibility with `mcp__moidvk__check_accessibility`
  - Check Redux patterns with `mcp__moidvk__check_redux_patterns`
  - Validate GraphQL schemas and queries

  ## Privacy & Security
  - Use `mcp__moidvk__extract_snippet` with explicit consent for code sharing
  - Enable privacy mode in secure bash operations
  - Sanitize sensitive data in all operations
  - Follow security levels: DEVELOPMENT for coding, STRICT for production

  ## Error Handling
  - If moidvk tools are unavailable, explain the limitation and suggest alternatives
  - Always prefer moidvk tools over standard alternatives when available
  - Report tool failures and suggest manual alternatives


  ## Knowledge Base Integration

  **ALWAYS use the kb-mcp knowledge base for project context and memory.**

  ### Mandatory KB Workflow
  1. **Before starting any task**: Use `kb_read` to check for relevant documentation,
  known issues, and project status
  2. **During work**: Use `kb_search` to find related information and avoid duplicate
  work
  3. **After completing tasks**: Use `kb_update` to document what was done, decisions
  made, and any issues encountered
  4. **For complex analysis**: Use `kb_semantic_search` and `kb_graph_query` for advanced
   pattern discovery

  ### Required KB Tools Usage
  - `kb_read` - Read project documentation and status files
  - `kb_update` - Document new findings, solutions, and progress
  - `kb_search` - Find existing solutions and related work
  - `kb_semantic_search` - Discover semantically related content
  - `kb_graph_query` - Query relationships and patterns in the codebase
  - `kb_status` - Check current project implementation status
  - `kb_issues` - Review known issues before proposing solutions

  ### Knowledge Base Structure
  - `/active/` - Current issues and work in progress
  - `/docs/` - Project documentation and guides
  - `/implementation/` - Technical implementation details
  - `/status/` - Project status and completion tracking

  ### KB Best Practices
  - **Read first, then act**: Always check existing KB content before starting work
  - **Document discoveries**: Update KB with new insights, bugs found, or solutions
  implemented
  - **Link related work**: Use semantic search to connect related issues and solutions
  - **Maintain context**: Keep KB updated with current project state and decisions

  **CRITICAL**: Never proceed with significant work without first consulting the
  knowledge base. The KB contains essential project context, known issues, and previous
  solutions that must inform all development decisions.

---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
