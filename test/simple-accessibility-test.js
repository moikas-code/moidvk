import { spawn } from 'child_process';

/**
 * Simple accessibility test to verify basic functionality
 */
class SimpleAccessibilityTest {
  constructor() {
    this.server = null;
  }

  async start_server() {
    console.log('🚀 Starting MCP server...');
    
    this.server = spawn('bun', ['server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 15000);

      this.server.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('Server output:', output);
        if (output.includes('server started successfully')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.server.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('✅ Server started successfully');
  }

  async test_simple_html() {
    console.log('\\n🧪 Testing: Simple HTML Accessibility');
    
    const simple_html = `
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <img src="test.jpg">
  <button>Click me</button>
</body>
</html>`;

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'check_accessibility',
        arguments: {
          code: simple_html,
          filename: 'test.html',
          standard: 'AA',
          environment: 'production',
        },
      },
    };

    try {
      const response = await this.send_request(request);
      console.log('✅ Accessibility check response received');
      console.log('Response:', response.result.content[0].text.substring(0, 1000));
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  async test_simple_jsx() {
    console.log('\\n🧪 Testing: Simple JSX Accessibility');
    
    const simple_jsx = `
import React from 'react';

function TestComponent() {
  return (
    <div>
      <img src="test.jpg" />
      <button>Click me</button>
    </div>
  );
}

export default TestComponent;`;

    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'check_accessibility',
        arguments: {
          code: simple_jsx,
          filename: 'test.jsx',
          standard: 'AA',
          environment: 'production',
        },
      },
    };

    try {
      const response = await this.send_request(request);
      console.log('✅ JSX accessibility check response received');
      console.log('Response:', response.result.content[0].text.substring(0, 1000));
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  async send_request(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const response_handler = (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          console.log('Raw response:', data.toString());
          reject(new Error('Invalid JSON response: ' + error.message));
        }
      };

      this.server.stdout.once('data', response_handler);
      this.server.stdin.write(JSON.stringify(request) + '\\n');
    });
  }

  async stop_server() {
    if (this.server) {
      this.server.kill();
      console.log('🛑 Server stopped');
    }
  }

  async run() {
    try {
      await this.start_server();
      
      await this.test_simple_html();
      await this.test_simple_jsx();
      
      console.log('\\n🎉 Simple accessibility tests completed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Stack trace:', error.stack);
    } finally {
      await this.stop_server();
    }
  }
}

// Run the test
async function main() {
  console.log('🧪 Starting Simple Accessibility Test');
  console.log('=' .repeat(50));
  
  const test = new SimpleAccessibilityTest();
  await test.run();
}

main().catch(console.error);