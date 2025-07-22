#!/usr/bin/env bun

// Comprehensive audit test script for moidvk server
// Tests all requested functionality including accessibility checker fixes

import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function runComprehensiveAudit() {
  console.log('Starting comprehensive moidvk server audit...\n');
  
  // Start the server
  const server = spawn('bun', ['run', 'server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responses = [];
  
  // Listen for responses
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        if (response.result && response.result.content) {
          console.log('\n' + '='.repeat(80));
          console.log(`Response for request ${response.id}:`);
          console.log('='.repeat(80));
          response.result.content.forEach(content => {
            if (content.type === 'text') {
              console.log(content.text);
            }
          });
        }
      } catch (e) {
        // Ignore non-JSON output
      }
    });
  });
  
  // Wait for server to start
  await sleep(1500);
  
  // Send initialization request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-10-07',
      capabilities: {},
      clientInfo: {
        name: 'audit-client',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await sleep(500);
  
  // Test 1: check_code_practices on server.js
  console.log('\n1. Running check_code_practices on server.js...');
  const codePracticesRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'check_code_practices',
      arguments: {
        code: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Sample of server.js code
const server = new Server({
  name: 'moidvk',
  version: '1.0.0'
});

// Error handling with console.error
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
    case 'check_code_practices':
      return await handleCodePractices(args);
    default:
      throw new Error(\`Unknown tool: \${name}\`);
    }
  } catch (error) {
    console.error(\`Error in tool \${name}:\`, error);
    return {
      content: [{
        type: 'text',
        text: \`❌ Error: Failed to execute tool "\${name}". Please check your input and try again.\`,
      }],
    };
  }
});`,
        filename: 'server.js'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(codePracticesRequest) + '\n');
  await sleep(2000);
  
  // Test 2: check_production_readiness with strict=true
  console.log('\n2. Running check_production_readiness on server.js with strict=true...');
  const productionReadinessRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'check_production_readiness',
      arguments: {
        code: `// Sample production code
const server = new Server({ name: 'moidvk' });

// Has console.error statements
process.on('SIGINT', async () => {
  console.error('Shutting down moidvk server...');
  await server.close();
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});`,
        filename: 'server.js',
        strict: true
      }
    }
  };
  
  server.stdin.write(JSON.stringify(productionReadinessRequest) + '\n');
  await sleep(2000);
  
  // Test 3: check_safety_rules on RateLimiter class
  console.log('\n3. Running check_safety_rules on RateLimiter class...');
  
  // First read the RateLimiter class
  const rateLimiterCode = `// RateLimiter class for safety analysis
export class RateLimiter {
  constructor(config = {}) {
    this.maxRequests = config.maxRequests || 100;
    this.windowMs = config.windowMs || 60000;
    this.requests = new Map();
  }
  
  checkLimit(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Clean old requests
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }
  
  reset(identifier) {
    this.requests.delete(identifier);
  }
}`;
  
  const safetyRulesRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'check_safety_rules',
      arguments: {
        code: rateLimiterCode,
        filename: 'RateLimiter.js'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(safetyRulesRequest) + '\n');
  await sleep(2000);
  
  // Test 4: check_accessibility on HTML content
  console.log('\n4. Running check_accessibility on HTML content to verify fixes...');
  const accessibilityRequest = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'check_accessibility',
      arguments: {
        code: `<div class="container">
  <h1>Security Audit Report</h1>
  <p>This is a sample HTML page for accessibility testing.</p>
  <button onclick="alert('test')">Click me</button>
  <img src="test.jpg" alt="Test image">
</div>`,
        filename: 'test.html'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(accessibilityRequest) + '\n');
  await sleep(2000);
  
  // Test 5: scan_security_vulnerabilities on the project
  console.log('\n5. Running scan_security_vulnerabilities on the project...');
  const securityScanRequest = {
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'scan_security_vulnerabilities',
      arguments: {
        format: 'detailed',
        includeTests: false
      }
    }
  };
  
  server.stdin.write(JSON.stringify(securityScanRequest) + '\n');
  await sleep(3000);
  
  // Clean up
  console.log('\n\nAudit complete! Stopping server...');
  server.kill();
  
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log('Total responses received:', responses.length);
  console.log('\nThe audit tested:');
  console.log('1. Code practices checking');
  console.log('2. Production readiness with strict mode');
  console.log('3. Safety rules for RateLimiter class');
  console.log('4. Accessibility checking on HTML (verifying filename fix)');
  console.log('5. Security vulnerability scanning');
}

// Run the audit
runComprehensiveAudit().catch(console.error);