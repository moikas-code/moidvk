import { spawn } from 'child_process';

async function debugFindGrep() {
  console.log('🚀 Starting MCP server for debugging find/grep...');
  
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
  
  // Test 1: find command
  console.log('\n🧪 Testing find command...');
  
  try {
    const findRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'secure_bash',
        arguments: {
          command: 'find',
          args: ['.', '-name', '*.js', '-maxdepth', '2'],
          securityLevel: 'BALANCED'
        }
      }
    };

    const findResponse = await new Promise((resolve, reject) => {
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
      server.stdin.write(JSON.stringify(findRequest) + '\n');
    });

    console.log('Find command response:');
    if (findResponse.result) {
      console.log('SUCCESS - First 300 chars:', findResponse.result.content[0].text.substring(0, 300));
    } else if (findResponse.error) {
      console.log('ERROR:', findResponse.error);
    }
  } catch (error) {
    console.log('Find command failed:', error.message);
  }
  
  // Test 2: grep command
  console.log('\n🧪 Testing grep command...');
  
  try {
    const grepRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'secure_grep',
        arguments: {
          pattern: 'import',
          paths: ['.'],
          recursive: true,
          includePatterns: ['*.js'],
          securityLevel: 'BALANCED'
        }
      }
    };

    const grepResponse = await new Promise((resolve, reject) => {
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
      server.stdin.write(JSON.stringify(grepRequest) + '\n');
    });

    console.log('Grep command response:');
    if (grepResponse.result) {
      console.log('SUCCESS - First 300 chars:', grepResponse.result.content[0].text.substring(0, 300));
    } else if (grepResponse.error) {
      console.log('ERROR:', grepResponse.error);
    }
  } catch (error) {
    console.log('Grep command failed:', error.message);
  }
  
  server.kill();
  console.log('\n🛑 Debug server stopped');
}

debugFindGrep().catch(console.error);