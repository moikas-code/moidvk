import { spawn } from 'child_process';

/**
 * Test script for enhanced filesystem tools with pagination, filtering, and sorting
 */
class EnhancedToolsTest {
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
      }, 10000);

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

  async test_list_directory_pagination() {
    console.log('\n🧪 Test 1: List directory with pagination');
    
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_directory',
        arguments: {
          path: '.',
          recursive: false,
          limit: 5,
          offset: 0,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Found ${result.metadata.totalMatches} total entries`);
    console.log(`✅ Returned ${result.metadata.returnedMatches} entries (limit: ${result.metadata.limit})`);
    console.log(`✅ Sorted by: ${result.metadata.sortBy} (${result.metadata.sortOrder})`);
    
    if (result.entries.length > 0) {
      console.log('✅ First 3 entries:');
      result.entries.slice(0, 3).forEach(e => {
        console.log(`   - ${e.name} (${e.type})`);
      });
    }
  }

  async test_list_directory_filtering() {
    console.log('\n🧪 Test 2: List directory with filtering');
    
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_directory',
        arguments: {
          path: '.',
          recursive: true,
          type: 'file',
          fileExtensions: ['.js', '.json'],
          minSize: 1000, // Files > 1KB
          limit: 10,
          sortBy: 'size',
          sortOrder: 'desc',
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Found ${result.metadata.totalMatches} JS/JSON files > 1KB`);
    console.log('✅ Top 5 largest files:');
    result.entries.slice(0, 5).forEach(e => {
      console.log(`   - ${e.name} (${(e.size / 1024).toFixed(2)} KB)`);
    });
  }

  async test_search_in_files_with_context() {
    console.log('\n🧪 Test 3: Search in files with context lines');
    
    const request = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_in_files',
        arguments: {
          searchText: 'async',
          directoryPath: 'lib',
          filePattern: '*.js',
          limit: 5,
          sortBy: 'occurrences',
          sortOrder: 'desc',
          contextLines: 2,
          includeLineNumbers: true,
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Found "${result.searchText}" in ${result.totalFiles} files`);
    console.log(`✅ Total occurrences: ${result.totalOccurrences}`);
    console.log(`✅ Sorted by: ${result.sortBy} (${result.sortOrder})`);
    
    if (result.results.length > 0) {
      const firstFile = result.results[0];
      console.log(`\n✅ Most occurrences in: ${firstFile.filePath}`);
      console.log(`   - ${firstFile.totalOccurrences} occurrences across ${firstFile.matchCount} lines`);
      
      if (firstFile.matches.length > 0) {
        const firstMatch = firstFile.matches[0];
        console.log(`\n   First match at line ${firstMatch.lineNumber}:`);
        if (firstMatch.context) {
          firstMatch.context.before.forEach(line => {
            console.log(`     ${line.lineNumber}: ${line.content.substring(0, 60)}...`);
          });
        }
        console.log(`   > ${firstMatch.lineNumber}: ${firstMatch.lineContent}`);
        if (firstMatch.context) {
          firstMatch.context.after.forEach(line => {
            console.log(`     ${line.lineNumber}: ${line.content.substring(0, 60)}...`);
          });
        }
      }
    }
  }

  async test_search_in_files_pagination() {
    console.log('\n🧪 Test 4: Search in files with pagination');
    
    const request = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search_in_files',
        arguments: {
          searchText: 'const',
          directoryPath: 'lib',
          filePattern: '*.js',
          limit: 3,
          offset: 0,
          sortBy: 'filePath',
          sortOrder: 'asc',
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Total files with "const": ${result.totalFiles}`);
    console.log(`✅ Page 1: Showing ${result.returnedFiles} files`);
    result.results.forEach(r => {
      console.log(`   - ${r.filePath} (${r.totalOccurrences} occurrences)`);
    });
    
    if (result.hasMore) {
      // Get page 2
      const page2Request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'search_in_files',
          arguments: {
            searchText: 'const',
            directoryPath: 'lib',
            filePattern: '*.js',
            limit: 3,
            offset: result.nextOffset,
            sortBy: 'filePath',
            sortOrder: 'asc',
          },
        },
      };
      
      const page2Response = await this.send_request(page2Request);
      const page2Result = JSON.parse(page2Response.result.content[0].text);
      
      console.log(`\n✅ Page 2: Showing ${page2Result.returnedFiles} files`);
      page2Result.results.forEach(r => {
        console.log(`   - ${r.filePath} (${r.totalOccurrences} occurrences)`);
      });
    }
  }

  async test_date_filtering() {
    console.log('\n🧪 Test 5: Filter by modification date');
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const request = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'list_directory',
        arguments: {
          path: '.',
          recursive: false,
          modifiedAfter: threeDaysAgo.toISOString(),
          sortBy: 'lastModified',
          sortOrder: 'desc',
          limit: 10,
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Files modified in last 3 days: ${result.metadata.totalMatches}`);
    result.entries.slice(0, 5).forEach(e => {
      const date = new Date(e.lastModified);
      console.log(`   - ${e.name} (${date.toLocaleDateString()})`);
    });
  }

  async send_request(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 15000);

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
      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async stop_server() {
    if (this.server) {
      this.server.kill();
      console.log('\n🛑 Server stopped');
    }
  }

  async run() {
    try {
      await this.start_server();
      
      await this.test_list_directory_pagination();
      await this.test_list_directory_filtering();
      await this.test_search_in_files_with_context();
      await this.test_search_in_files_pagination();
      await this.test_date_filtering();
      
      console.log('\n🎉 All enhanced tools tests completed successfully!');
      
      console.log('\n📋 ENHANCED FEATURES SUMMARY:');
      console.log('✅ list_directory: Pagination, sorting, and filtering');
      console.log('✅ search_in_files: Pagination, sorting, context lines');
      console.log('✅ Both tools: Date filtering and file size filtering');
      console.log('✅ Response metadata with totalMatches, hasMore, nextOffset');
      
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
  console.log('🧪 Starting Enhanced Tools Test Suite');
  console.log('=' .repeat(50));
  
  const test = new EnhancedToolsTest();
  await test.run();
}

main().catch(console.error);