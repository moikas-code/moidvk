# MCP Integration Guide

This guide covers how to integrate MOIDVK with Model Context Protocol (MCP) clients and build custom
integrations.

## 📋 Table of Contents

- [MCP Overview](#mcp-overview)
- [Client Configuration](#client-configuration)
- [Tool Integration](#tool-integration)
- [Custom Clients](#custom-clients)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)

## 🔍 MCP Overview

### What is MCP?

Model Context Protocol (MCP) is a standardized protocol for connecting AI assistants with external
tools and data sources. MOIDVK implements MCP to provide seamless integration with various AI
clients.

### MOIDVK MCP Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │    │   MOIDVK Server  │    │   Tool Engine   │
│  (Claude, etc.) │◄──►│   (MCP Bridge)   │◄──►│   (37+ Tools)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │    │   Protocol       │    │   Results &     │
│   & Commands    │    │   Translation    │    │   Responses     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Features

- **37+ Tools**: Complete development toolkit via MCP
- **Streaming Support**: Real-time results for large operations
- **Error Handling**: Robust error reporting and recovery
- **Authentication**: Secure tool access and validation
- **Caching**: Intelligent result caching for performance

## ⚙️ Client Configuration

### Claude Desktop

The most common MCP client integration.

#### Basic Configuration

Add to `~/.config/claude-desktop/config.json`:

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

#### Advanced Configuration

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve", "--port", "3001", "--verbose"],
      "env": {
        "MOIDVK_LOG_LEVEL": "info",
        "MOIDVK_CACHE_ENABLED": "true",
        "MOIDVK_MAX_CONCURRENT": "5"
      },
      "timeout": 30000,
      "retries": 3
    }
  }
}
```

#### Multiple Instances

```json
{
  "mcpServers": {
    "moidvk-dev": {
      "command": "moidvk",
      "args": ["serve", "--port", "3001"],
      "env": {
        "MOIDVK_ENV": "development"
      }
    },
    "moidvk-prod": {
      "command": "moidvk",
      "args": ["serve", "--port", "3002"],
      "env": {
        "MOIDVK_ENV": "production",
        "MOIDVK_STRICT_MODE": "true"
      }
    }
  }
}
```

### VS Code MCP Extension

Configuration for VS Code with MCP support.

#### Extension Settings

```json
{
  "mcp.servers": [
    {
      "name": "moidvk",
      "command": "moidvk serve",
      "description": "MOIDVK - The Ultimate DevKit",
      "enabled": true,
      "autoStart": true
    }
  ],
  "mcp.defaultTimeout": 30000,
  "mcp.enableLogging": true
}
```

#### Workspace Configuration

```json
{
  "mcp.workspaceServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve", "--cwd", "${workspaceFolder}"],
      "env": {
        "MOIDVK_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Other MCP Clients

#### Generic MCP Client

```json
{
  "servers": {
    "moidvk": {
      "command": "moidvk serve",
      "transport": "stdio",
      "capabilities": {
        "tools": true,
        "resources": true,
        "prompts": false
      }
    }
  }
}
```

#### Custom Client Configuration

```javascript
import { createMCPClient } from '@modelcontextprotocol/client';

const client = createMCPClient({
  command: 'moidvk',
  args: ['serve'],
  transport: 'stdio',
  timeout: 30000,
  retries: 3,
  env: {
    MOIDVK_LOG_LEVEL: 'info',
  },
});
```

## 🛠️ Tool Integration

### Available Tools

MOIDVK exposes 37+ tools via MCP. Each tool follows the MCP tool specification.

#### Tool Discovery

```javascript
// List all available tools
const tools = await client.callTool('tools/list');
console.log(tools);

// Get tool schema
const schema = await client.callTool('tools/get', {
  name: 'check_code_practices',
});
```

#### Tool Categories

```javascript
// Code quality tools
const codeTools = ['check_code_practices', 'rust_code_practices', 'python_code_analyzer'];

// Security tools
const securityTools = [
  'scan_security_vulnerabilities',
  'check_safety_rules',
  'python_security_scanner',
];

// Performance tools
const performanceTools = [
  'js_performance_analyzer',
  'rust_performance_analyzer',
  'bundle_size_analyzer',
];
```

### Tool Usage Patterns

#### Basic Tool Call

```javascript
const result = await client.callTool('check_code_practices', {
  code: 'const x = 1; console.log(x);',
  production: true,
  severity: 'warning',
});

console.log(result.issues);
```

#### Batch Processing

```javascript
const files = ['app.js', 'utils.js', 'config.js'];
const results = await Promise.all(
  files.map((file) =>
    client.callTool('check_code_practices', {
      code: fs.readFileSync(file, 'utf8'),
      filename: file,
      production: true,
    }),
  ),
);
```

#### Error Handling

```javascript
try {
  const result = await client.callTool('check_code_practices', {
    code: invalidCode,
    production: true,
  });
} catch (error) {
  if (error.code === 'TOOL_ERROR') {
    console.error('Tool execution failed:', error.message);
    console.log('Suggestions:', error.suggestions);
  } else if (error.code === 'TIMEOUT') {
    console.error('Tool execution timed out');
  }
}
```

#### Streaming Results

```javascript
const stream = client.streamTool('check_code_practices', {
  code: largeCodebase,
  production: true,
});

for await (const chunk of stream) {
  console.log('Progress:', chunk.progress);
  console.log('Partial results:', chunk.data);
}
```

### Tool Chaining

```javascript
// Sequential tool execution
async function analyzeCode(code, filename) {
  // 1. Check code quality
  const quality = await client.callTool('check_code_practices', {
    code,
    filename,
    production: true,
  });

  // 2. Security scan if quality is good
  if (quality.summary.errors === 0) {
    const security = await client.callTool('python_security_scanner', {
      code,
      filename,
    });

    // 3. Performance analysis if secure
    if (security.summary.high === 0) {
      const performance = await client.callTool('js_performance_analyzer', {
        code,
        filename,
        category: 'all',
      });

      return { quality, security, performance };
    }
  }

  return { quality };
}
```

## 🔧 Custom Clients

### Building a Custom MCP Client

#### Basic Client Implementation

```javascript
import { MCPClient } from '@modelcontextprotocol/client';
import { spawn } from 'child_process';

class MoidvkClient {
  constructor(options = {}) {
    this.options = {
      command: 'moidvk',
      args: ['serve'],
      timeout: 30000,
      ...options,
    };
    this.client = null;
  }

  async connect() {
    const process = spawn(this.options.command, this.options.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.client = new MCPClient({
      transport: {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      },
      timeout: this.options.timeout,
    });

    await this.client.connect();
    return this;
  }

  async analyzeCode(code, options = {}) {
    return await this.client.callTool('check_code_practices', {
      code,
      production: options.production || false,
      severity: options.severity || 'warning',
      ...options,
    });
  }

  async formatCode(code, options = {}) {
    return await this.client.callTool('format_code', {
      code,
      filename: options.filename,
      ...options,
    });
  }

  async scanSecurity(projectPath = '.') {
    return await this.client.callTool('scan_security_vulnerabilities', {
      projectPath,
      severity: 'medium',
    });
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}

// Usage
const moidvk = new MoidvkClient();
await moidvk.connect();

const result = await moidvk.analyzeCode('const x = 1;', {
  production: true,
});

await moidvk.disconnect();
```

#### Advanced Client with Caching

```javascript
class CachedMoidvkClient extends MoidvkClient {
  constructor(options = {}) {
    super(options);
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 3600000; // 1 hour
  }

  _getCacheKey(tool, params) {
    return `${tool}:${JSON.stringify(params)}`;
  }

  _isExpired(timestamp) {
    return Date.now() - timestamp > this.cacheTTL;
  }

  async callTool(tool, params) {
    const cacheKey = this._getCacheKey(tool, params);
    const cached = this.cache.get(cacheKey);

    if (cached && !this._isExpired(cached.timestamp)) {
      return cached.result;
    }

    const result = await this.client.callTool(tool, params);

    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

#### Web-Based Client

```javascript
class WebMoidvkClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  async callTool(tool, params) {
    const response = await fetch(`${this.serverUrl}/mcp/tools/${tool}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async analyzeCode(code, options = {}) {
    return await this.callTool('check_code_practices', {
      code,
      ...options,
    });
  }
}

// Usage in browser
const client = new WebMoidvkClient();
const result = await client.analyzeCode(editorContent);
```

### Integration Patterns

#### React Hook

```javascript
import { useState, useEffect, useCallback } from 'react';

function useMoidvk() {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initClient = async () => {
      try {
        const moidvk = new MoidvkClient();
        await moidvk.connect();
        setClient(moidvk);
      } catch (err) {
        setError(err);
      }
    };

    initClient();

    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, []);

  const analyzeCode = useCallback(
    async (code, options) => {
      if (!client) return null;

      setLoading(true);
      setError(null);

      try {
        const result = await client.analyzeCode(code, options);
        return result;
      } catch (err) {
        setError(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  return { analyzeCode, loading, error };
}

// Usage in component
function CodeEditor() {
  const { analyzeCode, loading, error } = useMoidvk();
  const [code, setCode] = useState('');
  const [analysis, setAnalysis] = useState(null);

  const handleAnalyze = async () => {
    const result = await analyzeCode(code, { production: true });
    setAnalysis(result);
  };

  return (
    <div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} />
      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? 'Analyzing...' : 'Analyze Code'}
      </button>
      {error && <div>Error: {error.message}</div>}
      {analysis && <pre>{JSON.stringify(analysis, null, 2)}</pre>}
    </div>
  );
}
```

#### CLI Wrapper

```javascript
#!/usr/bin/env node

import { Command } from 'commander';
import { MoidvkClient } from './moidvk-client.js';

const program = new Command();

program.name('moidvk-wrapper').description('Custom MOIDVK CLI wrapper').version('1.0.0');

program
  .command('analyze <file>')
  .description('Analyze code file')
  .option('-p, --production', 'Use production rules')
  .option('-s, --severity <level>', 'Severity level', 'warning')
  .action(async (file, options) => {
    const client = new MoidvkClient();
    await client.connect();

    try {
      const code = fs.readFileSync(file, 'utf8');
      const result = await client.analyzeCode(code, {
        filename: file,
        production: options.production,
        severity: options.severity,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      await client.disconnect();
    }
  });

program.parse();
```

## 🚀 Advanced Features

### Intelligent Tool Routing

```javascript
class IntelligentMoidvkClient extends MoidvkClient {
  async analyzeProject(projectPath, goals = []) {
    // Use intelligent development analysis
    const analysis = await this.client.callTool('intelligent_development_analysis', {
      files: await this.getProjectFiles(projectPath),
      development_goals: goals,
      context: {
        session_type: 'review',
        scope: 'system',
        urgency: 'medium',
      },
    });

    // Execute recommended tool sequence
    const results = {};
    for (const step of analysis.recommended_sequence) {
      results[step.tool] = await this.client.callTool(step.tool, {
        projectPath,
        ...step.params,
      });
    }

    return results;
  }
}
```

### Session Management

```javascript
class SessionManagedClient extends MoidvkClient {
  constructor(options = {}) {
    super(options);
    this.sessionId = null;
  }

  async startSession(projectContext) {
    const session = await this.client.callTool('development_session_manager', {
      action: 'start',
      session_data: {
        client_type: 'custom',
        context: projectContext,
        goals: [],
      },
    });

    this.sessionId = session.id;
    return session;
  }

  async checkpoint() {
    if (!this.sessionId) return null;

    return await this.client.callTool('development_session_manager', {
      action: 'checkpoint',
      session_data: { id: this.sessionId },
    });
  }

  async resumeSession(sessionId) {
    const session = await this.client.callTool('development_session_manager', {
      action: 'resume',
      session_data: { id: sessionId },
    });

    this.sessionId = sessionId;
    return session;
  }
}
```

### Semantic Search Integration

```javascript
class SemanticMoidvkClient extends MoidvkClient {
  async searchCode(query, options = {}) {
    return await this.client.callTool('semantic_development_search', {
      query,
      search_type: options.type || 'similar_code',
      max_results: options.maxResults || 10,
      context_aware: options.contextAware !== false,
      include_analysis: options.includeAnalysis !== false,
    });
  }

  async findSimilarCode(codeSnippet) {
    return await this.searchCode(codeSnippet, {
      type: 'similar_code',
      maxResults: 5,
    });
  }

  async findBugs(description) {
    return await this.searchCode(description, {
      type: 'bug_hunt',
      maxResults: 10,
    });
  }

  async findOptimizationTargets(performanceGoal) {
    return await this.searchCode(performanceGoal, {
      type: 'optimization_targets',
      maxResults: 8,
    });
  }
}
```

## 🔧 Configuration & Customization

### Server Configuration

```javascript
// Custom server configuration
const serverConfig = {
  port: 3001,
  host: 'localhost',
  timeout: 60000,
  maxConcurrent: 5,
  caching: {
    enabled: true,
    ttl: 3600,
    maxSize: 1000,
  },
  security: {
    enableAuth: false,
    allowedOrigins: ['*'],
    rateLimit: {
      windowMs: 60000,
      max: 100,
    },
  },
  logging: {
    level: 'info',
    format: 'json',
    file: '/var/log/moidvk.log',
  },
};

// Start server with custom config
const server = new MoidvkServer(serverConfig);
await server.start();
```

### Tool Configuration

```javascript
// Configure specific tools
const toolConfig = {
  check_code_practices: {
    defaultProduction: true,
    defaultSeverity: 'warning',
    ruleOverrides: {
      'no-console': 'off',
      'prefer-const': 'error',
    },
  },
  scan_security_vulnerabilities: {
    defaultSeverity: 'medium',
    excludeDevDependencies: true,
    customAuditCommand: 'bun audit',
  },
  format_code: {
    defaultConfig: {
      semi: true,
      singleQuote: true,
      tabWidth: 2,
    },
  },
};

const client = new MoidvkClient({ toolConfig });
```

## 🐛 Troubleshooting

### Common Integration Issues

#### Connection Failures

```javascript
// Add connection retry logic
class RobustMoidvkClient extends MoidvkClient {
  async connect(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await super.connect();
        return this;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}
```

#### Timeout Handling

```javascript
// Implement timeout handling
async function callToolWithTimeout(client, tool, params, timeout = 30000) {
  return Promise.race([
    client.callTool(tool, params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tool execution timeout')), timeout),
    ),
  ]);
}
```

#### Error Recovery

```javascript
// Implement error recovery
class RecoveringMoidvkClient extends MoidvkClient {
  async callTool(tool, params, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await super.callTool(tool, params);
      } catch (error) {
        if (i === retries) throw error;

        // Attempt recovery based on error type
        if (error.code === 'CONNECTION_LOST') {
          await this.reconnect();
        } else if (error.code === 'TOOL_UNAVAILABLE') {
          await this.waitForTool(tool);
        }
      }
    }
  }

  async reconnect() {
    await this.disconnect();
    await this.connect();
  }

  async waitForTool(tool, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await this.client.callTool('tools/get', { name: tool });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw new Error(`Tool ${tool} not available after ${timeout}ms`);
  }
}
```

### Debugging MCP Communication

```javascript
// Enable MCP protocol debugging
class DebuggingMoidvkClient extends MoidvkClient {
  constructor(options = {}) {
    super(options);
    this.debug = options.debug || false;
  }

  async callTool(tool, params) {
    if (this.debug) {
      console.log(`[MCP] Calling tool: ${tool}`);
      console.log(`[MCP] Parameters:`, JSON.stringify(params, null, 2));
    }

    const start = Date.now();
    try {
      const result = await super.callTool(tool, params);

      if (this.debug) {
        console.log(`[MCP] Tool completed in ${Date.now() - start}ms`);
        console.log(`[MCP] Result:`, JSON.stringify(result, null, 2));
      }

      return result;
    } catch (error) {
      if (this.debug) {
        console.error(`[MCP] Tool failed after ${Date.now() - start}ms`);
        console.error(`[MCP] Error:`, error);
      }
      throw error;
    }
  }
}
```

## 📚 Additional Resources

- **[Tool Reference](tool-reference.md)** - Complete tool documentation
- **[Configuration Guide](configuration.md)** - Advanced configuration options
- **[CLI Usage](../user-guide/cli-usage.md)** - Command-line interface
- **[MCP Specification](https://modelcontextprotocol.io/)** - Official MCP documentation

---

**Need help with MCP integration?** Check our
[troubleshooting guide](../user-guide/troubleshooting.md) or
[open an issue](https://github.com/moikas-code/moidvk/issues).
