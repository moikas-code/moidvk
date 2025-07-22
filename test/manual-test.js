#!/usr/bin/env bun

// Manual test script to verify the MCP server is working
// Run this after starting the server to test the check_code_practices tool

import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function testServer() {
  console.log('Starting MCP server test...\n');
  
  // Start the server
  const server = spawn('bun', ['run', 'server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Wait for server to start
  await sleep(1000);
  
  // Send initialization request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-10-07',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // Listen for responses
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        // Ignore non-JSON output
      }
    });
  });
  
  // Wait for initialization
  await sleep(500);
  
  // Test the check_code_practices tool
  const toolCallRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'check_code_practices',
      arguments: {
        code: `var x = 1;
if (x == "1") {
  console.log("This has issues");
}`
      }
    }
  };
  
  console.log('\nTesting check_code_practices tool with problematic code...');
  server.stdin.write(JSON.stringify(toolCallRequest) + '\n');
  
  // Wait for response
  await sleep(1000);
  
  // Test with good code
  const goodCodeRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'check_code_practices',
      arguments: {
        code: `const greeting = 'Hello, World!';
const name = 'User';
console.log(\`\${greeting} \${name}\`);`
      }
    }
  };
  
  console.log('\nTesting check_code_practices tool with good code...');
  server.stdin.write(JSON.stringify(goodCodeRequest) + '\n');
  
  // Wait for response
  await sleep(1000);
  
  // Test with production parameter
  const productionCodeRequest = {
    jsonrpc: '2.0',
    id: 3.5,
    method: 'tools/call',
    params: {
      name: 'check_code_practices',
      arguments: {
        code: `const data = 'test';
console.log(data); // TODO: remove this
debugger;
alert('test');`,
        production: true
      }
    }
  };
  
  console.log('\nTesting check_code_practices tool with production=true...');
  server.stdin.write(JSON.stringify(productionCodeRequest) + '\n');
  
  // Wait for response
  await sleep(1000);
  
  // Test security scanner
  const securityScanRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'scan_security_vulnerabilities',
      arguments: {
        format: 'summary'
      }
    }
  };
  
  console.log('\nTesting scan_security_vulnerabilities tool...');
  server.stdin.write(JSON.stringify(securityScanRequest) + '\n');
  
  // Wait for response
  await sleep(2000);
  
  // Test production readiness
  const productionReadinessRequest = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'check_production_readiness',
      arguments: {
        code: 'const data = \'test\'; console.log(data); // TODO: remove this',
        filename: 'test.js'
      }
    }
  };
  
  console.log('\nTesting check_production_readiness tool...');
  server.stdin.write(JSON.stringify(productionReadinessRequest) + '\n');
  
  // Wait for response
  await sleep(2000);
  
  // Clean up
  console.log('\nStopping server...');
  server.kill();
  
  console.log('\nTest complete!');
}

// Run the test
testServer().catch(console.error);