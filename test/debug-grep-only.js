import { spawn } from 'child_process';

async function debugGrepOnly() {
  console.log('🚀 Starting MCP server for debugging grep only...');
  
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
  
  // Test simple grep with smaller scope
  console.log('\n🧪 Testing simple grep command...');
  
  try {
    const grepRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'secure_grep',
        arguments: {
          pattern: 'version',
          paths: ['package.json'],
          recursive: false,
          securityLevel: 'BALANCED'
        }
      }
    };

    const grepResponse = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 15000);

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
      server.stdin.write(JSON.stringify(grepRequest) + '\n');
    });

    console.log('\nGrep response details:');
    if (grepResponse.result) {
      console.log('✅ SUCCESS');
      console.log('Full response:', grepResponse.result.content[0].text);
    } else if (grepResponse.error) {
      console.log('❌ ERROR:', grepResponse.error);
    } else {
      console.log('❓ UNKNOWN response:', grepResponse);
    }
  } catch (error) {
    console.log('❌ Grep command failed:', error.message);
  }
  
  server.kill();
  console.log('\n🛑 Debug server stopped');
}

debugGrepOnly().catch(console.error);