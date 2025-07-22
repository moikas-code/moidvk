import { spawn } from 'child_process';
import { writeFile, mkdir, rmdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Simple filesystem test to verify basic functionality
 */
class SimpleFilesystemTest {
  constructor() {
    this.server = null;
    this.testDir = join(process.cwd(), 'simple-test-workspace');
  }

  async setupTestEnvironment() {
    console.log('🛠️  Setting up test environment...');
    
    if (!existsSync(this.testDir)) {
      await mkdir(this.testDir, { recursive: true });
    }

    // Create a simple test file
    await writeFile(join(this.testDir, 'test.js'), `
function hello(name) {
  return "Hello, " + name + "!";
}

console.log(hello("World"));
`);
    
    console.log('✅ Test environment ready');
  }

  async startServer() {
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

  async stopServer() {
    if (this.server) {
      this.server.kill();
      console.log('🛑 Server stopped');
    }
  }

  async testListTools() {
    console.log('\n🧪 Testing: List available tools');
    
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    };

    const response = await this.sendRequest(request);
    console.log('Available tools:', response.result.tools.map(t => t.name));
    
    // Check if filesystem tools are available
    const toolNames = response.result.tools.map(t => t.name);
    const expectedTools = [
      'create_file',
      'read_file',
      'update_file',
      'delete_file',
      'list_directory',
      'search_files',
      'search_in_files',
      'analyze_project',
      'find_similar_files',
      'extract_snippet',
      'request_editing_help',
    ];
    
    const missingTools = expectedTools.filter(tool => !toolNames.includes(tool));
    if (missingTools.length > 0) {
      console.log('❌ Missing tools:', missingTools);
    } else {
      console.log('✅ All filesystem tools are available');
    }
  }

  async testBasicFileOperations() {
    console.log('\n🧪 Testing: Basic file operations');
    
    // Change to test directory
    process.chdir(this.testDir);
    
    // Test create_file
    console.log('📝 Testing create_file...');
    const createResponse = await this.sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'create_file',
        arguments: {
          filePath: 'new-file.txt',
          content: 'Hello, World!\nThis is a test file.',
        },
      },
    });
    
    console.log('Create file response:', createResponse.result.content[0].text);
    
    // Test read_file
    console.log('📖 Testing read_file...');
    const readResponse = await this.sendRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: {
          filePath: 'new-file.txt',
        },
      },
    });
    
    console.log('Read file response:', readResponse.result.content[0].text);
    
    // Test list_directory
    console.log('📁 Testing list_directory...');
    const listResponse = await this.sendRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'list_directory',
        arguments: {
          directoryPath: '.',
        },
      },
    });
    
    console.log('List directory response:', listResponse.result.content[0].text);
    
    // Test search_files
    console.log('🔍 Testing search_files...');
    const searchResponse = await this.sendRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          pattern: '*.js',
          directoryPath: '.',
        },
      },
    });
    
    console.log('Search files response:', searchResponse.result.content[0].text);
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
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

      this.server.stdout.once('data', responseHandler);
      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async cleanupTestEnvironment() {
    console.log('🧹 Cleaning up test environment...');
    
    // Return to original directory
    process.chdir(join(this.testDir, '..'));
    
    try {
      if (existsSync(this.testDir)) {
        await rmdir(this.testDir, { recursive: true });
      }
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.warn('Warning: Failed to cleanup test environment:', error.message);
    }
  }

  async run() {
    try {
      await this.setupTestEnvironment();
      await this.startServer();
      
      await this.testListTools();
      await this.testBasicFileOperations();
      
      console.log('\n🎉 All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Stack trace:', error.stack);
    } finally {
      await this.stopServer();
      await this.cleanupTestEnvironment();
    }
  }
}

// Run the test
async function main() {
  console.log('🧪 Starting Simple Filesystem Tools Test');
  console.log('=' .repeat(50));
  
  const test = new SimpleFilesystemTest();
  await test.run();
}

main().catch(console.error);