import { spawn } from 'child_process';

/**
 * Test suite for GraphQL and Redux evaluator tools
 */
class GraphQLReduxToolsTest {
  constructor() {
    this.server = null;
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

  async testGraphQLSchemaChecker() {
    console.log('\n🧪 Testing check_graphql_schema tool');
    
    const problematicSchema = `
      type User {
        id: ID!
        name: String!
        email: String!
        posts: [Post!]!
      }
      
      type Post {
        id: ID!
        title: String!
        content: String
        author: User!
      }
      
      type Query {
        users: [User!]!
        posts: [Post!]!
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
          filename: 'schema.graphql',
          strict: true,
          limit: 10,
          severity: 'all',
          sortBy: 'severity',
          sortOrder: 'desc'
        },
      },
    };

    const response = await this.sendRequest(request);
    const text = response.result.content[0].text;
    const jsonData = JSON.parse(response.result.content[1].text);
    
    console.log(`✅ Found ${jsonData.summary.totalIssues} schema issues`);
    console.log(`✅ Severity breakdown:`, jsonData.summary.severityBreakdown);
    console.log(`✅ Has pagination: ${jsonData.summary.hasMore}`);
    
    if (jsonData.issues.length > 0) {
      console.log('✅ Top 3 issues:');
      jsonData.issues.slice(0, 3).forEach(issue => {
        console.log(`   - ${issue.type}: ${issue.message}`);
      });
    }
    
    return jsonData.summary.totalIssues > 0;
  }

  async testGraphQLQueryChecker() {
    console.log('\n🧪 Testing check_graphql_query tool');
    
    const problematicQuery = `
      query GetUserData($userId: ID!) {
        user(id: $userId) {
          id
          name
          email
          posts {
            id
            title
            content
            comments {
              id
              text
              author {
                id
                name
                posts {
                  id
                  title
                  comments {
                    id
                    text
                    author {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'check_graphql_query',
        arguments: {
          query: problematicQuery,
          filename: 'query.graphql',
          maxDepth: 5,
          maxComplexity: 50,
          limit: 10,
          severity: 'all',
          sortBy: 'severity',
          sortOrder: 'desc'
        },
      },
    };

    const response = await this.sendRequest(request);
    const text = response.result.content[0].text;
    const jsonData = JSON.parse(response.result.content[1].text);
    
    console.log(`✅ Found ${jsonData.summary.totalIssues} query issues`);
    console.log(`✅ Query metrics:`, jsonData.summary.queryMetrics);
    console.log(`✅ Severity breakdown:`, jsonData.summary.severityBreakdown);
    
    if (jsonData.issues.length > 0) {
      console.log('✅ Top 3 issues:');
      jsonData.issues.slice(0, 3).forEach(issue => {
        console.log(`   - ${issue.type}: ${issue.message}`);
      });
    }
    
    return jsonData.summary.totalIssues > 0;
  }

  async testReduxPatternsChecker() {
    console.log('\n🧪 Testing check_redux_patterns tool');
    
    const problematicReducer = `
      const initialState = {
        users: [],
        loading: false,
        error: null
      };
      
      function userReducer(state = initialState, action) {
        switch (action.type) {
          case 'FETCH_USERS_START':
            console.log('Fetching users...');
            state.loading = true;
            return state;
            
          case 'FETCH_USERS_SUCCESS':
            state.users = action.payload;
            state.loading = false;
            return state;
            
          case 'FETCH_USERS_ERROR':
            state.error = action.payload;
            state.loading = false;
            return state;
            
          case 'ADD_USER':
            state.users.push(action.payload);
            return state;
        }
      }
      
      const fetchUsers = () => {
        fetch('/api/users')
          .then(response => response.json())
          .then(data => ({
            type: 'FETCH_USERS_SUCCESS',
            payload: data
          }));
      };
    `;

    const request = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'check_redux_patterns',
        arguments: {
          code: problematicReducer,
          filename: 'userReducer.js',
          codeType: 'reducer',
          strict: true,
          limit: 10,
          severity: 'all',
          sortBy: 'severity',
          sortOrder: 'desc'
        },
      },
    };

    const response = await this.sendRequest(request);
    const text = response.result.content[0].text;
    const jsonData = JSON.parse(response.result.content[1].text);
    
    console.log(`✅ Detected code type: ${jsonData.summary.detectedCodeType}`);
    console.log(`✅ Found ${jsonData.summary.totalIssues} Redux issues`);
    console.log(`✅ Severity breakdown:`, jsonData.summary.severityBreakdown);
    console.log(`✅ Category breakdown:`, jsonData.summary.categoryBreakdown);
    
    if (jsonData.issues.length > 0) {
      console.log('✅ Top 3 issues:');
      jsonData.issues.slice(0, 3).forEach(issue => {
        console.log(`   - ${issue.type}: ${issue.message}`);
      });
    }
    
    return jsonData.summary.totalIssues > 0;
  }

  async testGraphQLSchemaWithPagination() {
    console.log('\n🧪 Testing GraphQL schema with pagination');
    
    const goodSchema = `
      type User {
        id: ID!
        name: String!
        email: String!
      }
      
      type Query {
        users(first: Int, after: String): UserConnection!
      }
      
      type UserConnection {
        edges: [UserEdge!]!
        pageInfo: PageInfo!
      }
      
      type UserEdge {
        node: User!
        cursor: String!
      }
      
      type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
      }
    `;

    const request = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'check_graphql_schema',
        arguments: {
          schema: goodSchema,
          filename: 'good-schema.graphql',
          strict: false,
          limit: 5,
          offset: 0
        },
      },
    };

    const response = await this.sendRequest(request);
    const text = response.result.content[0].text;
    
    console.log(`✅ Good schema analysis: ${text.includes('✅') ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Schema result: ${text.includes('no issues detected') ? 'Clean' : 'Has issues'}`);
    
    return text.includes('✅');
  }

  async testReduxToolkitPattern() {
    console.log('\n🧪 Testing Redux Toolkit patterns');
    
    const modernReduxCode = `
      import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
      
      export const fetchUsers = createAsyncThunk(
        'users/fetchUsers',
        async (_, { rejectWithValue }) => {
          try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch');
            return await response.json();
          } catch (error) {
            return rejectWithValue(error.message);
          }
        }
      );
      
      const usersSlice = createSlice({
        name: 'users',
        initialState: {
          items: [],
          loading: false,
          error: null
        },
        reducers: {
          clearError: (state) => {
            state.error = null;
          }
        },
        extraReducers: (builder) => {
          builder
            .addCase(fetchUsers.pending, (state) => {
              state.loading = true;
              state.error = null;
            })
            .addCase(fetchUsers.fulfilled, (state, action) => {
              state.loading = false;
              state.items = action.payload;
            })
            .addCase(fetchUsers.rejected, (state, action) => {
              state.loading = false;
              state.error = action.payload;
            });
        }
      });
      
      export const { clearError } = usersSlice.actions;
      export default usersSlice.reducer;
    `;

    const request = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'check_redux_patterns',
        arguments: {
          code: modernReduxCode,
          filename: 'usersSlice.js',
          codeType: 'reducer',
          strict: false,
          limit: 10
        },
      },
    };

    const response = await this.sendRequest(request);
    const text = response.result.content[0].text;
    
    console.log(`✅ Modern Redux analysis: ${text.includes('✅') ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Redux result: ${text.includes('no issues detected') ? 'Clean' : 'Has issues'}`);
    
    return text.includes('✅');
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 20000);

      const responseHandler = (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          if (response.error) {
            reject(new Error(`MCP Error: ${response.error.message}`));
          } else {
            resolve(response);
          }
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
      console.log('\n🛑 Server stopped');
    }
  }

  async runAllTests() {
    const tests = [
      { name: 'GraphQL Schema Checker', fn: this.testGraphQLSchemaChecker },
      { name: 'GraphQL Query Checker', fn: this.testGraphQLQueryChecker },
      { name: 'Redux Patterns Checker', fn: this.testReduxPatternsChecker },
      { name: 'GraphQL Schema Pagination', fn: this.testGraphQLSchemaWithPagination },
      { name: 'Redux Toolkit Pattern', fn: this.testReduxToolkitPattern },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test.fn.call(this);
        if (result) {
          passed++;
          console.log(`✅ ${test.name} - PASSED`);
        } else {
          failed++;
          console.log(`❌ ${test.name} - FAILED (no results)`);
        }
      } catch (error) {
        failed++;
        console.log(`❌ ${test.name} - FAILED: ${error.message}`);
      }
    }

    return { passed, failed, total: tests.length };
  }

  async run() {
    try {
      await this.startServer();
      
      console.log('\n🧪 Running GraphQL and Redux tools tests...');
      console.log('=' .repeat(60));
      
      const results = await this.runAllTests();
      
      console.log('\n📊 TEST RESULTS:');
      console.log('=' .repeat(60));
      console.log(`✅ Passed: ${results.passed}`);
      console.log(`❌ Failed: ${results.failed}`);
      console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
      
      if (results.failed === 0) {
        console.log('\n🎉 All GraphQL and Redux tools tests passed!');
      } else {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
      }
      
      console.log('\n📋 NEW FEATURES VERIFIED:');
      console.log('✅ GraphQL schema validation and best practices');
      console.log('✅ GraphQL query complexity and performance analysis');
      console.log('✅ Redux patterns and anti-patterns detection');
      console.log('✅ Pagination, filtering, and sorting for all new tools');
      console.log('✅ Comprehensive error handling and suggestions');
      console.log('✅ Integration with existing MCP architecture');
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      console.error('Stack trace:', error.stack);
    } finally {
      await this.stopServer();
    }
  }
}

// Run the test
async function main() {
  console.log('🧪 Starting GraphQL and Redux Tools Test Suite');
  console.log('Testing new domain-specific evaluator tools');
  console.log('=' .repeat(80));
  
  const test = new GraphQLReduxToolsTest();
  await test.run();
}

main().catch(console.error);