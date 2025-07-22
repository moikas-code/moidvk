#!/usr/bin/env bun

/**
 * CLI interface for moidvk tools
 * Allows direct command-line access to all analysis tools
 */

import { promises as fs } from 'node:fs';
import { stdin as input, stdout as _output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import path from 'path';
import { spawn } from 'child_process';

// Import tool handlers
import { handleCodePractices } from './lib/tools/code-practices.js';
import { handleCodeFormatter } from './lib/tools/code-formatter.js';
import { handleSafetyChecker } from './lib/tools/safety-checker.js';
import { handleSecurityScanner } from './lib/tools/security-scanner.js';
import { handleProductionReadiness } from './lib/tools/production-readiness.js';
import { handleAccessibilityChecker } from './lib/tools/accessibility-checker.js';
import { handleGraphqlSchemaCheck } from './lib/tools/graphql-schema-checker.js';
import { handleGraphqlQueryCheck } from './lib/tools/graphql-query-checker.js';
import { handleReduxPatternsCheck } from './lib/tools/redux-patterns-checker.js';
import {
  handleIntelligentDevelopmentAnalysis,
  handleDevelopmentSessionManager,
  handleSemanticDevelopmentSearch,
} from './lib/tools/intelligent-tools.js';

// Tool mapping
const TOOLS = {
  serve: {
    handler: null, // Special handler for serve command
    name: 'serve',
    description: 'Start the MCP server',
    requiresCode: false,
    requiresFile: false,
    isServerCommand: true,
  },
  'check-code': {
    handler: handleCodePractices,
    name: 'check_code_practices',
    description: 'Check code for best practices and common issues',
    requiresCode: true,
    requiresFile: false,
  },
  format: {
    handler: handleCodeFormatter,
    name: 'format_code',
    description: 'Format code with consistent style',
    requiresCode: true,
    requiresFile: false,
  },
  'check-safety': {
    handler: handleSafetyChecker,
    name: 'check_safety_rules',
    description: 'Check code against NASA JPL safety rules',
    requiresCode: true,
    requiresFile: false,
  },
  'scan-security': {
    handler: handleSecurityScanner,
    name: 'scan_security_vulnerabilities',
    description: 'Scan project for security vulnerabilities',
    requiresCode: false,
    requiresFile: false,
    requiresPath: true,
  },
  'check-production': {
    handler: handleProductionReadiness,
    name: 'check_production_readiness',
    description: 'Check if code is ready for production deployment',
    requiresCode: true,
    requiresFile: false,
  },
  'check-accessibility': {
    handler: handleAccessibilityChecker,
    name: 'check_accessibility',
    description: 'Check web content for accessibility issues',
    requiresCode: true,
    requiresFile: false,
  },
  'check-graphql-schema': {
    handler: handleGraphqlSchemaCheck,
    name: 'check_graphql_schema',
    description: 'Validate GraphQL schema definitions',
    requiresCode: true,
    requiresFile: false,
  },
  'check-graphql-query': {
    handler: handleGraphqlQueryCheck,
    name: 'check_graphql_query',
    description: 'Validate GraphQL queries and mutations',
    requiresCode: true,
    requiresFile: false,
  },
  'check-redux': {
    handler: handleReduxPatternsCheck,
    name: 'check_redux_patterns',
    description: 'Check Redux patterns and best practices',
    requiresCode: true,
    requiresFile: false,
  },
  'analyze-dev': {
    handler: handleIntelligentDevelopmentAnalysis,
    name: 'intelligent_development_analysis',
    description: 'Analyze development workflow and suggest optimal tool sequences',
    requiresCode: false,
    requiresFile: false,
    requiresPath: true,
  },
  session: {
    handler: handleDevelopmentSessionManager,
    name: 'development_session_manager',
    description: 'Manage development sessions across MCP clients',
    requiresCode: false,
    requiresFile: false,
  },
  'search-semantic': {
    handler: handleSemanticDevelopmentSearch,
    name: 'semantic_development_search',
    description: 'Context-aware semantic search for development',
    requiresCode: false,
    requiresFile: false,
    requiresPath: true,
  },
};

/**
 * Start the MCP server
 */
async function startServer(_options) {
  // Check if we're in MCP mode (no TTY means we're being called by an MCP client)
  const isMCPMode = !process.stdin.isTTY;

  if (isMCPMode) {
    // In MCP mode, directly run the server without spawning
    // This maintains stdio communication with the MCP client
    try {
      await import('./server.js');
    } catch (error) {
      // Log to stderr so it doesn't interfere with stdio protocol
      console.error('Failed to start MCP server:', error.message); // eslint-disable-line no-console
      process.exit(1);
    }
  } else {
    // In interactive mode, show helpful information
    /* eslint-disable no-console */
    console.log('🚀 Starting moidvk MCP server...');
    console.log('📡 Server will be available via MCP protocol');
    console.log('🔧 Available tools:');

    // List available tools
    Object.entries(TOOLS).forEach(([, tool]) => {
      if (!tool.isServerCommand) {
        console.log(`   • ${tool.name}: ${tool.description}`);
      }
    });

    console.log('\n⏹️  Press Ctrl+C to stop the server\n');
    /* eslint-enable no-console */

    // Start the server process
    const serverProcess = spawn('bun', ['server.js'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    // Handle process events
    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error.message); // eslint-disable-line no-console
      process.exit(1);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Server exited with code ${code}`); // eslint-disable-line no-console
        process.exit(code);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...'); // eslint-disable-line no-console
      serverProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down server...'); // eslint-disable-line no-console
      serverProcess.kill('SIGTERM');
    });
  }
}

/**
 * Start the test MCP server
 */
async function _startTestServer(_options) {
  /* eslint-disable no-console */
  console.log('🧪 Starting moidvk test server...');
  console.log('📡 Test server will be available via MCP protocol');
  console.log('🔧 Available tools:');
  console.log('   • test_tool: A simple test tool');

  console.log('\n⏹️  Press Ctrl+C to stop the server\n');
  /* eslint-enable no-console */

  // Start the test server process
  const serverProcess = spawn('bun', ['test-server.js'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // Handle process events
  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start test server:', error.message); // eslint-disable-line no-console
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Test server exited with code ${code}`); // eslint-disable-line no-console
      process.exit(code);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down test server...'); // eslint-disable-line no-console
    serverProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down server...'); // eslint-disable-line no-console
    serverProcess.kill('SIGTERM');
  });
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
moidvk CLI - Code analysis and quality tools

Usage:
  moidvk <command> [options]

Commands:
${Object.entries(TOOLS)
    .map(([cmd, tool]) => `  ${cmd.padEnd(20)} ${tool.description}`)
    .join('\n')}

Options:
  -f, --file <path>     Read code from file instead of stdin
  -o, --output <path>   Write output to file instead of stdout
  -p, --path <path>     Project path (for scan-security, analyze-dev, search-semantic)
  --production          Enable production mode (stricter checks)
  --strict              Enable strict mode
  --format <format>     Output format (text, json, detailed)
  --goals <goals>       Comma-separated list of development goals
  --client <type>       Client type (cli, vscode, cursor, etc.)
  --action <action>     Session action (create, list, get, update, complete)
  --session-id <id>     Session ID for session operations
  --query <text>        Search query for semantic search
  --search-type <type>  Search type (similar_code, related_patterns, etc.)
  --max-results <n>     Maximum number of search results
  -h, --help           Show this help message

Examples:
  # Start the MCP server
  moidvk serve

  # Check code from stdin
  echo "const x = 1" | moidvk check-code

  # Check file directly
  moidvk check-code -f src/index.js

  # Format code and save to file
  moidvk format -f src/messy.js -o src/clean.js

  # Scan project for vulnerabilities
  moidvk scan-security -p /path/to/project

  # Check production readiness with strict mode
  moidvk check-production -f server.js --strict --production

  # Check accessibility of HTML file
  moidvk check-accessibility -f index.html

  # Analyze development workflow
  moidvk analyze-dev -p /path/to/project

  # Manage development sessions
  moidvk session --action create --goals "Fix authentication bug"

  # Semantic search in codebase
  moidvk search-semantic -p /path/to/project --query "authentication logic"
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    command: null,
    file: null,
    output: null,
    path: null,
    production: false,
    strict: false,
    format: 'text',
    help: false,
    // Intelligent tool options
    goals: null,
    client: null,
    action: null,
    sessionId: null,
    query: null,
    searchType: null,
    maxResults: null,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      break;
    } else if (arg === '-f' || arg === '--file') {
      options.file = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
    } else if (arg === '-p' || arg === '--path') {
      options.path = args[++i];
    } else if (arg === '--production') {
      options.production = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--format') {
      options.format = args[++i];
    } else if (arg === '--goals') {
      options.goals = args[++i];
    } else if (arg === '--client') {
      options.client = args[++i];
    } else if (arg === '--action') {
      options.action = args[++i];
    } else if (arg === '--session-id') {
      options.sessionId = args[++i];
    } else if (arg === '--query') {
      options.query = args[++i];
    } else if (arg === '--search-type') {
      options.searchType = args[++i];
    } else if (arg === '--max-results') {
      options.maxResults = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-') && !options.command) {
      options.command = arg;
    }
    i++;
  }

  return options;
}

/**
 * Read code from stdin or file
 */
async function readCode(options) {
  if (options.file) {
    return await fs.readFile(options.file, 'utf-8');
  }

  // Read from stdin
  if (process.stdin.isTTY) {
    console.error('Error: No input provided. Use -f to specify a file or pipe input via stdin.'); // eslint-disable-line no-console
    process.exit(1);
  }

  const rl = createInterface({ input, output: null });
  const lines = [];

  for await (const line of rl) {
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Format output based on response
 */
function formatOutput(response, format) {
  if (format === 'json') {
    // Extract JSON data if available
    const content = response.content?.[0]?.text || '';
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }
    // Try to find JSON object in the content
    const jsonStart = content.indexOf('{');
    if (jsonStart !== -1) {
      try {
        const jsonStr = content.substring(jsonStart);
        JSON.parse(jsonStr); // Validate it's JSON
        return jsonStr;
      } catch {
        // Fall through to text output
      }
    }
  }

  // Default text output
  return response.content?.[0]?.text || 'No output';
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || !options.command) {
    showHelp();
    process.exit(0);
  }

  const tool = TOOLS[options.command];
  if (!tool) {
    console.error(`Error: Unknown command '${options.command}'`); // eslint-disable-line no-console
    showHelp();
    process.exit(1);
  }

  try {
    // Handle serve command specially
    if (tool.isServerCommand) {
      await startServer(options);
      return; // Don't exit, let the server run
    }

    let toolArgs = {};

    // Get code input if required
    if (tool.requiresCode) {
      const code = await readCode(options);
      toolArgs.code = code;

      // Set filename if provided or infer from file path
      if (options.file) {
        toolArgs.filename = path.basename(options.file);
      }
    }

    // Add project path for security scanner
    if (tool.requiresPath) {
      toolArgs.projectPath = options.path || process.cwd();
    }

    // Add additional options
    if (options.production) {
      toolArgs.production = true;
    }
    if (options.strict) {
      toolArgs.strict = true;
    }
    if (options.format && tool.name === 'scan_security_vulnerabilities') {
      toolArgs.format = options.format;
    }

    // Handle intelligent tool arguments
    if (tool.name === 'intelligent_development_analysis') {
      toolArgs.goals = options.goals?.split(',') || [];
      toolArgs.client_type = options.client || 'cli';
    }

    if (tool.name === 'development_session_manager') {
      toolArgs.action = options.action || 'list';
      if (options.goals) {
        toolArgs.goals = options.goals.split(',');
      }
      if (options.sessionId) {
        toolArgs.session_id = options.sessionId;
      }
    }

    if (tool.name === 'semantic_development_search') {
      toolArgs.query = options.query || '';
      toolArgs.type = options.searchType || 'similar_code';
      toolArgs.max_results = options.maxResults || 10;
    }

    // Call the tool handler
    const response = await tool.handler(toolArgs);

    // Format and output results
    const output = formatOutput(response, options.format);

    if (options.output) {
      await fs.writeFile(options.output, output);
      console.log(`Output written to ${options.output}`); // eslint-disable-line no-console
    } else {
      console.log(output); // eslint-disable-line no-console
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message); // eslint-disable-line no-console
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Fatal error:', error); // eslint-disable-line no-console
  process.exit(1);
});
