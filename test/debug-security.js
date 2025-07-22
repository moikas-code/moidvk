import { spawn } from 'child_process';

async function debugSecurityTools() {
  console.log('🚀 Starting MCP server for debugging...');
  
  const server = spawn('bun', ['server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 10000);

    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('server started successfully')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  console.log('✅ Debug server started successfully');
  
  // Test secure_bash tool
  console.log('\n🧪 Testing secure_bash...');
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'secure_bash',
      arguments: {
        command: 'ls',
        args: ['-la'],
        securityLevel: 'BALANCED'
      }
    }
  };

  const response = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);

    const responseHandler = (data) => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(data.toString());
        resolve(response);
      } catch (error) {
        console.log('Raw response:', data.toString());
        reject(new Error('Invalid JSON response: ' + error.message));
      }
    };

    server.stdout.once('data', responseHandler);
    server.stdin.write(JSON.stringify(request) + '\n');
  });

  console.log('\n📊 Response:');
  if (response.result) {
    console.log('Success! First 500 chars of response:');
    console.log(response.result.content[0].text.substring(0, 500));
  } else if (response.error) {
    console.log('Error:', response.error);
  } else {
    console.log('Unknown response format:', response);
  }
  
  server.kill();
  console.log('\n🛑 Debug server stopped');
}

debugSecurityTools().catch(console.error);