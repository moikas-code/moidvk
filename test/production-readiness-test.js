import { test, expect, describe } from 'bun:test';
import { productionReadinessTool, handleProductionReadiness } from '../lib/tools/production-readiness.js';

describe('Production Readiness Tool', () => {
  test('tool definition has correct structure', () => {
    expect(productionReadinessTool.name).toBe('check_production_readiness');
    expect(productionReadinessTool.description).toContain('production deployment readiness');
    expect(productionReadinessTool.inputSchema.type).toBe('object');
    expect(productionReadinessTool.inputSchema.properties).toHaveProperty('code');
    expect(productionReadinessTool.inputSchema.properties).toHaveProperty('filename');
    expect(productionReadinessTool.inputSchema.properties).toHaveProperty('strict');
  });

  test('input schema allows optional parameters', () => {
    expect(productionReadinessTool.inputSchema.required).toEqual(['code']);
  });

  test('handler returns MCP-compliant response for clean code', async () => {
    const cleanCode = `
const greeting = 'Hello, World!';
const name = 'User';

function greetUser(username) {
  if (!username) {
    throw new Error('Username is required');
  }
  return greeting + ' ' + username;
}

export { greetUser };
`;
    
    const result = await handleProductionReadiness({ code: cleanCode });
    
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
    expect(typeof result.content[0].text).toBe('string');
    expect(result.content[0].text).toContain('Production Readiness Check Results');
  });

  test('detects TODO comments as production blockers', async () => {
    const codeWithTodo = `
const value = 42;
// TODO: optimize this later
console.log(value);
`;
    
    const result = await handleProductionReadiness({ code: codeWithTodo });
    const text = result.content[0].text;
    
    expect(text).toContain('NOT PRODUCTION READY');
    expect(text).toContain('BLOCKING ISSUES');
    expect(text).toContain('TODO');
  });

  test('detects console.log as production blocker', async () => {
    const codeWithConsole = `
const data = { name: 'test' };
console.log('Debug:', data);
const result = data.name;
`;
    
    const result = await handleProductionReadiness({ code: codeWithConsole });
    const text = result.content[0].text;
    
    expect(text).toContain('NOT PRODUCTION READY');
    expect(text).toContain('BLOCKING ISSUES');
    expect(text).toContain('console');
  });

  test('detects debugger statements', async () => {
    const codeWithDebugger = `
function processData(input) {
  debugger;
  return input * 2;
}
`;
    
    const result = await handleProductionReadiness({ code: codeWithDebugger });
    const text = result.content[0].text;
    
    expect(text).toContain('NOT PRODUCTION READY');
    expect(text).toContain('BLOCKING ISSUES');
  });

  test('detects incomplete implementations', async () => {
    const incompleteCode = `
function processData(input) {
  // TODO: implement this function
  // placeholder for now
}

const result = 'not implemented';
`;
    
    const result = await handleProductionReadiness({ code: incompleteCode });
    const text = result.content[0].text;
    
    expect(text).toContain('NOT PRODUCTION READY');
    expect(text).toContain('BLOCKING ISSUES');
    expect(text.toLowerCase()).toMatch(/todo|placeholder|implement/);
  });

  test('detects temporary code markers', async () => {
    const tempCode = `
const tempValue = 123; // temporary for testing
const debugOnly = true; // debug only - remove before prod
`;
    
    const result = await handleProductionReadiness({ code: tempCode });
    const text = result.content[0].text;
    
    expect(text).toContain('NOT PRODUCTION READY');
    expect(text).toContain('BLOCKING ISSUES');
  });

  test('provides production readiness score', async () => {
    const result = await handleProductionReadiness({ 
      code: 'const value = 42; export { value };' 
    });
    const text = result.content[0].text;
    
    expect(text).toMatch(/Readiness Score: \d+\/100/);
  });

  test('shows production deployment checklist', async () => {
    const result = await handleProductionReadiness({ 
      code: 'const value = 42;' 
    });
    const text = result.content[0].text;
    
    expect(text).toContain('Production Deployment Checklist');
    expect(text).toContain('No TODO/FIXME comments');
    expect(text).toContain('No console.log statements');
    expect(text).toContain('No debugger statements');
  });

  test('handles strict mode parameter', async () => {
    const codeWithWarnings = `
const unusedVar = 'test';
const value = 42;
`;
    
    const result = await handleProductionReadiness({ 
      code: codeWithWarnings, 
      strict: true 
    });
    const text = result.content[0].text;
    
    expect(text).toContain('STRICT MODE');
  });

  test('handles invalid code gracefully', async () => {
    const result = await handleProductionReadiness({ code: '' });
    
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('No code provided');
  });

  test('handles syntax errors gracefully', async () => {
    const result = await handleProductionReadiness({ 
      code: 'const invalid = function( { // missing closing brace' 
    });
    
    expect(result.content[0].text).toContain('Parsing error');
  });

  test('provides different recommendations based on score', async () => {
    // Test high-quality code
    const cleanCode = `
const API_URL = 'https://api.example.com';

function fetchUserData(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  return fetch(API_URL + '/users/' + userId);
}

export { fetchUserData };
`;
    
    const result = await handleProductionReadiness({ code: cleanCode });
    const text = result.content[0].text;
    
    expect(text).toContain('PRODUCTION READY');
    expect(text).toMatch(/Excellent|Good|Fair/);
  });
});

describe('Production Readiness Integration', () => {
  test('comprehensive production blocking test', async () => {
    const problematicCode = `
// TODO: refactor this entire module
const DEBUG = true; // temporary - for testing only

function processOrder(order) {
  console.log('Processing order:', order); // debug only
  debugger; // remove before prod
  
  if (DEBUG) {
    console.log('Debug mode active');
  }
  
  // FIXME: add proper validation
  // placeholder implementation
  return { status: 'pending' };
}

// XXX: this is a hack
export { processOrder };
`;
    
    const result = await handleProductionReadiness({ code: problematicCode });
    const text = result.content[0].text;
    
    expect(text).toContain('NOT PRODUCTION READY');
    expect(text).toContain('BLOCKING ISSUES');
    
    // Should detect multiple types of issues
    expect(text.toLowerCase()).toMatch(/todo|fixme|xxx/);
    expect(text).toContain('console');
    expect(text.toLowerCase()).toMatch(/temporary|placeholder|testing/);
  });

  test('production ready code passes all checks', async () => {
    const productionCode = `
const API_ENDPOINTS = {
  USERS: '/api/users',
  ORDERS: '/api/orders',
};

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('Valid user ID string required');
  }
  return userId.trim();
}

async function fetchUser(userId) {
  const validId = validateUserId(userId);
  
  try {
    const response = await fetch(API_ENDPOINTS.USERS + '/' + validId);
    if (!response.ok) {
      throw new Error('Failed to fetch user: ' + response.status);
    }
    return await response.json();
  } catch (error) {
    throw new Error('User fetch failed: ' + error.message);
  }
}

export { fetchUser, validateUserId };
`;
    
    const result = await handleProductionReadiness({ code: productionCode });
    const text = result.content[0].text;
    
    expect(text).toContain('PRODUCTION READY');
    expect(text).toContain('✅');
    expect(text).toMatch(/Readiness Score: [89][0-9]\/100|Readiness Score: 100\/100/);
  });
});