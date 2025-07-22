import { spawn } from 'child_process';

async function debugGraphQLSchema() {
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
  
  // Test GraphQL schema checker
  const problematicSchema = `
    type User {
      id: ID!
      name: String!
      email: String!
    }
    
    type Query {
      users: [User!]!
    }
  `;

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'check_graphql_schema',
      arguments: {
        schema: problematicSchema,
        filename: 'test.graphql',
        strict: true,
        limit: 10
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

  console.log('📊 Full Response:');
  console.log(JSON.stringify(response, null, 2));
  
  if (response.result && response.result.content) {
    console.log('\n🔍 Content Analysis:');
    response.result.content.forEach((item, index) => {
      console.log(`Content ${index}:`, item.text.substring(0, 200) + '...');
    });
  }
  
  server.kill();
  console.log('\n🛑 Server stopped');
}

debugGraphQLSchema().catch(console.error);