import { spawn } from 'child_process';
import { writeFile, readFile, mkdir, rmdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = join(process.cwd(), 'test-workspace');

/**
 * Comprehensive test suite for filesystem tools
 */
class FilesystemTestSuite {
  constructor() {
    this.server = null;
    this.testResults = [];
  }

  async startServer() {
    console.log('🚀 Starting MCP server...');
    this.server = spawn('bun', ['server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    // Wait for server to be ready
    await new Promise((resolve) => {
      this.server.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('server started successfully')) {
          resolve();
        }
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

  async setupTestEnvironment() {
    console.log('🛠️  Setting up test environment...');
    
    // Create test workspace
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }

    // Create test files
    await writeFile(join(TEST_DIR, 'sample.js'), `
// Sample JavaScript file for testing
function greet(name) {
  return \`Hello, \${name}!\`;
}

const users = ['Alice', 'Bob', 'Charlie'];
users.forEach(user => {
  console.log(greet(user));
});

module.exports = { greet };
`);

    await writeFile(join(TEST_DIR, 'config.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      settings: {
        debug: false,
        timeout: 5000,
      },
    }, null, 2));

    await writeFile(join(TEST_DIR, 'README.md'), `# Test Project

This is a test project for filesystem tools.

## Features
- File operations
- Directory management
- Search capabilities
`);

    // Create subdirectory
    const subDir = join(TEST_DIR, 'src');
    await mkdir(subDir, { recursive: true });
    
    await writeFile(join(subDir, 'utils.js'), `
export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function isValidEmail(email) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}
`);

    console.log('✅ Test environment ready');
  }

  async cleanupTestEnvironment() {
    console.log('🧹 Cleaning up test environment...');
    try {
      if (existsSync(TEST_DIR)) {
        await rmdir(TEST_DIR, { recursive: true });
      }
    } catch (error) {
      console.warn('Warning: Failed to cleanup test environment:', error.message);
    }
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      this.server.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });

      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async runTest(testName, testFn) {
    console.log(`\n🧪 Running test: ${testName}`);
    try {
      const result = await testFn();
      this.testResults.push({ name: testName, status: 'PASS', result });
      console.log(`✅ ${testName} - PASSED`);
      return result;
    } catch (error) {
      this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
      throw error;
    }
  }

  // Test basic file operations
  async testFileOperations() {
    const testFile = 'test-file.txt';
    const testContent = 'Hello, World!\nThis is a test file.';

    // Test create_file
    await this.runTest('Create File', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'create_file',
        arguments: {
          filePath: testFile,
          content: testContent,
        },
      });
      
      if (!response.result.content[0].text.includes('created successfully')) {
        throw new Error('File creation failed');
      }
      return response;
    });

    // Test read_file
    await this.runTest('Read File', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'read_file',
        arguments: {
          filePath: testFile,
        },
      });
      
      if (!response.result.content[0].text.includes(testContent)) {
        throw new Error('File content mismatch');
      }
      return response;
    });

    // Test read_file with AI mode
    await this.runTest('Read File (AI Mode)', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'read_file',
        arguments: {
          filePath: 'sample.js',
          forAI: true,
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.embedding || !result.metadata) {
        throw new Error('AI mode should return embeddings and metadata');
      }
      return response;
    });

    // Test update_file
    const updatedContent = testContent + '\nUpdated content!';
    await this.runTest('Update File', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'update_file',
        arguments: {
          filePath: testFile,
          content: updatedContent,
        },
      });
      
      if (!response.result.content[0].text.includes('updated successfully')) {
        throw new Error('File update failed');
      }
      return response;
    });

    // Test delete_file (should require confirmation)
    await this.runTest('Delete File (Confirmation Required)', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'delete_file',
        arguments: {
          filePath: testFile,
        },
      });
      
      if (!response.result.content[0].text.includes('Confirmation required')) {
        throw new Error('Should require confirmation');
      }
      return response;
    });

    // Test delete_file (with confirmation)
    await this.runTest('Delete File (Confirmed)', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'delete_file',
        arguments: {
          filePath: testFile,
          confirmed: true,
        },
      });
      
      if (!response.result.content[0].text.includes('deleted successfully')) {
        throw new Error('File deletion failed');
      }
      return response;
    });
  }

  // Test directory operations
  async testDirectoryOperations() {
    const testDir = 'test-directory';

    // Test create_directory
    await this.runTest('Create Directory', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'create_directory',
        arguments: {
          directoryPath: testDir,
        },
      });
      
      if (!response.result.content[0].text.includes('created successfully')) {
        throw new Error('Directory creation failed');
      }
      return response;
    });

    // Test list_directory
    await this.runTest('List Directory', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'list_directory',
        arguments: {
          directoryPath: '.',
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('Directory listing failed');
      }
      return response;
    });

    // Test list_directory (recursive)
    await this.runTest('List Directory (Recursive)', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'list_directory',
        arguments: {
          directoryPath: '.',
          recursive: true,
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!Array.isArray(result)) {
        throw new Error('Recursive directory listing failed');
      }
      return response;
    });

    // Test delete_directory (with confirmation)
    await this.runTest('Delete Directory', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'delete_directory',
        arguments: {
          directoryPath: testDir,
          confirmed: true,
        },
      });
      
      if (!response.result.content[0].text.includes('deleted successfully')) {
        throw new Error('Directory deletion failed');
      }
      return response;
    });
  }

  // Test search functionality
  async testSearchOperations() {
    // Test search_files
    await this.runTest('Search Files by Pattern', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'search_files',
        arguments: {
          pattern: '*.js',
          directoryPath: '.',
          recursive: true,
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.matches || !Array.isArray(result.matches)) {
        throw new Error('File search failed');
      }
      return response;
    });

    // Test search_in_files
    await this.runTest('Search Content in Files', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'search_in_files',
        arguments: {
          searchText: 'function',
          directoryPath: '.',
          filePattern: '*.js',
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.results || !Array.isArray(result.results)) {
        throw new Error('Content search failed');
      }
      return response;
    });
  }

  // Test analysis features
  async testAnalysisFeatures() {
    // Test analyze_project
    await this.runTest('Analyze Project Structure', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'analyze_project',
        arguments: {
          rootPath: '.',
          maxDepth: 2,
          filePattern: '*.js',
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.structure) {
        throw new Error('Project analysis failed');
      }
      return response;
    });

    // Test find_similar_files
    await this.runTest('Find Similar Files', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'find_similar_files',
        arguments: {
          referencePath: 'sample.js',
          searchPath: '.',
          topK: 5,
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.similarFiles) {
        throw new Error('Similar files search failed');
      }
      return response;
    });
  }

  // Test snippet extraction
  async testSnippetExtraction() {
    // Test extract_snippet (should require confirmation)
    await this.runTest('Extract Snippet (Confirmation Required)', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'extract_snippet',
        arguments: {
          filePath: 'sample.js',
          startLine: 2,
          endLine: 5,
          purpose: 'Testing snippet extraction',
          sharingLevel: 'micro',
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.requiresConfirmation) {
        throw new Error('Should require confirmation');
      }
      return response;
    });

    // Test extract_snippet (with confirmation)
    await this.runTest('Extract Snippet (Confirmed)', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'extract_snippet',
        arguments: {
          filePath: 'sample.js',
          startLine: 2,
          endLine: 5,
          purpose: 'Testing snippet extraction',
          sharingLevel: 'micro',
          confirmed: true,
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.snippet) {
        throw new Error('Snippet extraction failed');
      }
      return response;
    });
  }

  // Test editing help
  async testEditingHelp() {
    await this.runTest('Request Editing Help', async () => {
      const response = await this.sendRequest('tools/call', {
        name: 'request_editing_help',
        arguments: {
          task: 'Help me understand this function',
          filePath: 'sample.js',
          preferEmbeddings: true,
        },
      });
      
      const result = JSON.parse(response.result.content[0].text);
      if (!result.message) {
        throw new Error('Editing help request failed');
      }
      return response;
    });
  }

  async printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));
    
    const passed = this.testResults.filter(t => t.status === 'PASS').length;
    const failed = this.testResults.filter(t => t.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n🎉 Testing complete!');
  }

  async runAllTests() {
    try {
      await this.setupTestEnvironment();
      await this.startServer();
      
      // Change to test workspace
      process.chdir(TEST_DIR);
      
      // Run all test suites
      await this.testFileOperations();
      await this.testDirectoryOperations();
      await this.testSearchOperations();
      await this.testAnalysisFeatures();
      await this.testSnippetExtraction();
      await this.testEditingHelp();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    } finally {
      // Return to original directory
      process.chdir(dirname(TEST_DIR));
      
      await this.stopServer();
      await this.cleanupTestEnvironment();
      await this.printResults();
    }
  }
}

// Run the tests
async function main() {
  console.log('🧪 Starting Comprehensive Filesystem Tools Test');
  console.log('=' .repeat(60));
  
  const testSuite = new FilesystemTestSuite();
  await testSuite.runAllTests();
}

main().catch(console.error);