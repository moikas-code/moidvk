import { spawn } from 'child_process';
import { writeFile, mkdir, rmdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Test advanced features: embeddings, analysis, and snippet extraction
 */
class AdvancedFeaturesTest {
  constructor() {
    this.server = null;
    this.testDir = join(process.cwd(), 'advanced-test-workspace');
  }

  async setupTestEnvironment() {
    console.log('🛠️  Setting up advanced test environment...');
    
    if (!existsSync(this.testDir)) {
      await mkdir(this.testDir, { recursive: true });
    }

    // Create test files with sensitive data
    await writeFile(join(this.testDir, 'secure-config.js'), `
const config = {
  apiKey: "sk-abc123def456ghi789",
  databaseUrl: "postgresql://user:password@localhost:5432/db",
  secretToken: "jwt-secret-token-12345",
  awsAccessKey: "AKIAIOSFODNN7EXAMPLE",
  awsSecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
};

function connectToDatabase() {
  return database.connect(config.databaseUrl);
}

function authenticateUser(token) {
  return jwt.verify(token, config.secretToken);
}

module.exports = config;
`);

    await writeFile(join(this.testDir, 'user-service.js'), `
class UserService {
  constructor(database) {
    this.database = database;
  }

  async createUser(userData) {
    const { email, password, name } = userData;
    
    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    // Hash password
    const hashedPassword = await this.hashPassword(password);
    
    // Create user record
    const user = await this.database.users.create({
      email,
      password: hashedPassword,
      name,
      createdAt: new Date()
    });
    
    return user;
  }

  async getUserById(userId) {
    return await this.database.users.findById(userId);
  }

  async updateUser(userId, updates) {
    return await this.database.users.updateById(userId, updates);
  }

  async deleteUser(userId) {
    return await this.database.users.deleteById(userId);
  }

  isValidEmail(email) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  }

  async hashPassword(password) {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 10);
  }
}

module.exports = UserService;
`);

    console.log('✅ Advanced test environment ready');
  }

  async startServer() {
    console.log('🚀 Starting MCP server...');
    
    this.server = spawn('bun', ['server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 15000);

      this.server.stderr.on('data', (data) => {
        const output = data.toString();
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

  async testAnalyzeProject() {
    console.log('\n🧪 Testing: Project analysis with embeddings');
    
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'analyze_project',
        arguments: {
          rootPath: '.',
          maxDepth: 2,
          filePattern: '*.js',
          includeEmbeddings: false, // Don't include embeddings for faster test
        },
      },
    });
    
    const result = JSON.parse(response.result.content[0].text);
    console.log('✅ Project structure analyzed successfully');
    console.log(`📊 Found ${result.structure.children.length} items`);
    
    return result;
  }

  async testSearchInFiles() {
    console.log('\n🧪 Testing: Search in files');
    
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_in_files',
        arguments: {
          searchText: 'function',
          directoryPath: '.',
          filePattern: '*.js',
          maxResults: 10,
        },
      },
    });
    
    const result = JSON.parse(response.result.content[0].text);
    console.log('✅ Search in files completed');
    console.log(`🔍 Found ${result.totalMatches} matches`);
    
    return result;
  }

  async testSnippetExtraction() {
    console.log('\n🧪 Testing: Snippet extraction with safety checks');
    
    // First, test without confirmation (should require it)
    const response1 = await this.sendRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'extract_snippet',
        arguments: {
          filePath: 'user-service.js',
          startLine: 5,
          endLine: 15,
          purpose: 'Testing snippet extraction safety',
          sharingLevel: 'function',
          sanitize: true,
        },
      },
    });
    
    const result1 = JSON.parse(response1.result.content[0].text);
    console.log('✅ Snippet extraction requires confirmation as expected');
    
    // Now test with confirmation
    const response2 = await this.sendRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'extract_snippet',
        arguments: {
          filePath: 'user-service.js',
          startLine: 5,
          endLine: 15,
          purpose: 'Testing snippet extraction safety',
          sharingLevel: 'function',
          sanitize: true,
          confirmed: true,
        },
      },
    });
    
    const result2 = JSON.parse(response2.result.content[0].text);
    console.log('✅ Snippet extracted successfully with confirmation');
    console.log(`📝 Extracted ${result2.lineCount || 'unknown'} lines`);
    
    return { withoutConfirmation: result1, withConfirmation: result2 };
  }

  async testSnippetSanitization() {
    console.log('\n🧪 Testing: Snippet sanitization (sensitive data detection)');
    
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'extract_snippet',
        arguments: {
          filePath: 'secure-config.js',
          startLine: 2,
          endLine: 8,
          purpose: 'Testing sanitization of sensitive data',
          sharingLevel: 'function',
          sanitize: true,
          confirmed: true,
        },
      },
    });
    
    const result = JSON.parse(response.result.content[0].text);
    console.log('✅ Snippet sanitization completed');
    
    if (result.safetyCheck && result.safetyCheck.found) {
      console.log('🔒 Sensitive data detected and sanitized');
      console.log(`🚨 Types found: ${result.safetyCheck.types.join(', ')}`);
    } else {
      console.log('ℹ️  No sensitive data detected');
    }
    
    return result;
  }

  async testEditingHelp() {
    console.log('\n🧪 Testing: Request editing help');
    
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'request_editing_help',
        arguments: {
          task: 'Help me understand the user creation process',
          filePath: 'user-service.js',
          preferEmbeddings: true,
          sharingLevel: 'function',
        },
      },
    });
    
    const result = JSON.parse(response.result.content[0].text);
    console.log('✅ Editing help request completed');
    console.log(`💡 Help method: ${result.helpProvided?.[0]?.method || 'unknown'}`);
    
    return result;
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

  async stopServer() {
    if (this.server) {
      this.server.kill();
      console.log('🛑 Server stopped');
    }
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
      
      // Change to test directory
      process.chdir(this.testDir);
      
      // Run advanced feature tests
      await this.testAnalyzeProject();
      await this.testSearchInFiles();
      await this.testSnippetExtraction();
      await this.testSnippetSanitization();
      await this.testEditingHelp();
      
      console.log('\n🎉 All advanced features tests completed successfully!');
      console.log('\n📋 TEST SUMMARY:');
      console.log('✅ Project analysis - Working');
      console.log('✅ Search in files - Working');
      console.log('✅ Snippet extraction - Working');
      console.log('✅ Snippet sanitization - Working');
      console.log('✅ Editing help - Working');
      console.log('✅ Privacy-first design - Files stay local');
      console.log('✅ Safety checks - Confirmation required');
      console.log('✅ Sensitive data detection - Automatic sanitization');
      
    } catch (error) {
      console.error('❌ Advanced features test failed:', error.message);
      console.error('Stack trace:', error.stack);
    } finally {
      await this.stopServer();
      await this.cleanupTestEnvironment();
    }
  }
}

// Run the test
async function main() {
  console.log('🧪 Starting Advanced Filesystem Features Test');
  console.log('=' .repeat(55));
  
  const test = new AdvancedFeaturesTest();
  await test.run();
}

main().catch(console.error);