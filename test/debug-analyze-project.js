import { spawn } from 'child_process';

/**
 * Debug script to check analyze_project response format
 */
async function debugAnalyzeProject() {
  console.log('🚀 Starting MCP server...');
  
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

  console.log('✅ Server started successfully');
  
  // Test analyze_project
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'analyze_project',
      arguments: {
        rootPath: 'lib',
        maxDepth: 1,
        limit: 3,
        offset: 0,
        includeEmbeddings: false
      },
    },
  };

  const response = await new Promise((resolve, reject) => {
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
    server.stdin.write(JSON.stringify(request) + '\n');
  });

  console.log('📊 Response structure:');
  console.log(JSON.stringify(response, null, 2));
  
  if (response.result && response.result.content) {
    const result = JSON.parse(response.result.content[0].text);
    console.log('\n🔍 Parsed result structure:');
    console.log('- rootPath:', result.rootPath);
    console.log('- timestamp:', result.timestamp);
    console.log('- structure.name:', result.structure?.name);
    console.log('- structure.type:', result.structure?.type);
    console.log('- structure.children:', result.structure?.children?.length);
    console.log('- structure.stats:', result.structure?.stats);
  }
  
  server.kill();
  console.log('\n🛑 Server stopped');
}

debugAnalyzeProject().catch(console.error);