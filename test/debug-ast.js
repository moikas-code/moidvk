import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const code = `
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
`;

const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'decorators-legacy'],
});

console.log('🔍 Analyzing AST structure...');

traverse(ast, {
  AssignmentExpression(path) {
    const left = path.node.left;
    if (left.type === 'MemberExpression' && left.object.name === 'state') {
      console.log(`\n📍 Found state mutation at line ${path.node.loc?.start.line}:`);
      console.log(`   Assignment: ${left.object.name}.${left.property.name} = ...`);
      
      // Debug the path structure
      console.log('\n🔍 Path structure:');
      let currentPath = path;
      let depth = 0;
      while (currentPath && depth < 10) {
        console.log(`   ${depth}: ${currentPath.node.type} (${currentPath.node.key?.name || currentPath.node.callee?.name || ''})`);
        currentPath = currentPath.parentPath;
        depth++;
      }
    }
  }
});