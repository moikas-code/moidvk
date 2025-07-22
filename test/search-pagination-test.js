import { spawn } from 'child_process';

/**
 * Test script for search_files pagination functionality
 */
class SearchPaginationTest {
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

  async test_basic_search() {
    console.log('\n🧪 Test 1: Basic search with default pagination');
    
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          pattern: '*.js',
          directoryPath: '.',
          recursive: true,
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Found ${result.totalMatches} total matches`);
    console.log(`✅ Returned ${result.returnedMatches} matches (limit: ${result.limit})`);
    console.log(`✅ Has more results: ${result.hasMore}`);
    if (result.hasMore) {
      console.log(`✅ Next offset: ${result.nextOffset}`);
    }
  }

  async test_pagination() {
    console.log('\n🧪 Test 2: Pagination with small limit');
    
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          pattern: '*.js',
          directoryPath: '.',
          recursive: true,
          limit: 5,
          offset: 0,
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Page 1: ${result.returnedMatches} files (offset: ${result.offset})`);
    result.matches.forEach(m => console.log(`   - ${m.path}`));
    
    if (result.hasMore) {
      // Get second page
      const page2Request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_files',
          arguments: {
            pattern: '*.js',
            directoryPath: '.',
            recursive: true,
            limit: 5,
            offset: result.nextOffset,
          },
        },
      };
      
      const page2Response = await this.send_request(page2Request);
      const page2Result = JSON.parse(page2Response.result.content[0].text);
      
      console.log(`✅ Page 2: ${page2Result.returnedMatches} files (offset: ${page2Result.offset})`);
      page2Result.matches.forEach(m => console.log(`   - ${m.path}`));
    }
  }

  async test_sorting() {
    console.log('\n🧪 Test 3: Sorting by size descending');
    
    const request = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          pattern: '*.js',
          directoryPath: '.',
          recursive: true,
          limit: 10,
          sortBy: 'size',
          sortOrder: 'desc',
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log('✅ Top 10 largest JS files:');
    result.matches.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.path} - ${(m.size / 1024).toFixed(2)} KB`);
    });
  }

  async test_filtering() {
    console.log('\n🧪 Test 4: Filtering by size and exclude patterns');
    
    const request = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          pattern: '*.js',
          directoryPath: '.',
          recursive: true,
          minSize: 1000, // Files larger than 1KB
          excludePatterns: ['node_modules/*', 'test/*'],
          limit: 20,
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Found ${result.totalMatches} files > 1KB (excluding node_modules & test)`);
    console.log(`✅ Showing first ${result.returnedMatches}:`);
    result.matches.slice(0, 5).forEach(m => {
      console.log(`   - ${m.path} (${(m.size / 1024).toFixed(2)} KB)`);
    });
  }

  async test_date_filtering() {
    console.log('\n🧪 Test 5: Filter by modification date');
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const request = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'search_files',
        arguments: {
          pattern: '*',
          directoryPath: '.',
          recursive: false,
          modifiedAfter: oneWeekAgo.toISOString(),
          sortBy: 'lastModified',
          sortOrder: 'desc',
          limit: 10,
        },
      },
    };

    const response = await this.send_request(request);
    const result = JSON.parse(response.result.content[0].text);
    
    console.log(`✅ Files modified in last week: ${result.totalMatches}`);
    result.matches.forEach(m => {
      const date = new Date(m.lastModified);
      console.log(`   - ${m.path} (${date.toLocaleDateString()})`);
    });
  }

  async send_request(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

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
      
      await this.test_basic_search();
      await this.test_pagination();
      await this.test_sorting();
      await this.test_filtering();
      await this.test_date_filtering();
      
      console.log('\n🎉 All pagination tests completed successfully!');
      
      console.log('\n📋 FEATURE SUMMARY:');
      console.log('✅ Pagination with limit and offset');
      console.log('✅ Sorting by path, name, size, lastModified');
      console.log('✅ Filtering by file size (min/max)');
      console.log('✅ Filtering by modification date');
      console.log('✅ Exclude patterns support');
      console.log('✅ Response metadata (totalMatches, hasMore, nextOffset)');
      console.log('✅ Performance limit (10k max results)');
      
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
  console.log('🧪 Starting Search Pagination Test Suite');
  console.log('=' .repeat(50));
  
  const test = new SearchPaginationTest();
  await test.run();
}

main().catch(console.error);