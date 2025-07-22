import { spawn } from 'child_process';

async function debugReduxToolkitResult() {
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
  
  // Test Redux Toolkit pattern (the clean, modern code)
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
    id: 1,
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

  console.log('📊 Response Text (first 300 chars):');
  console.log(response.result.content[0].text.substring(0, 300));
  
  console.log('\n🔍 Full Text Analysis:');
  const text = response.result.content[0].text;
  console.log(`- Contains "✅": ${text.includes('✅')}`);
  console.log(`- Contains "no issues detected": ${text.includes('no issues detected')}`);
  console.log(`- Contains "follows best practices": ${text.includes('follows best practices')}`);
  
  if (response.result.content[1]) {
    const jsonData = JSON.parse(response.result.content[1].text);
    console.log('\n📈 JSON Summary:');
    console.log(`- Total issues: ${jsonData.summary.totalIssues}`);
    console.log(`- Severity breakdown:`, jsonData.summary.severityBreakdown);
  }
  
  server.kill();
  console.log('\n🛑 Server stopped');
}

debugReduxToolkitResult().catch(console.error);