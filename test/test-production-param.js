#!/usr/bin/env bun
// Test script specifically for production parameter in code-practices tool

import { handleCodePractices } from '../lib/tools/code-practices.js';

console.log('Testing code-practices tool with production parameter...\n');

// Test code with issues that production mode should catch
const testCode = `const data = 'test';
console.log(data); // TODO: remove this
debugger;
alert('test');
var oldStyle = true;`;

// Test 1: Without production mode (default)
console.log('1. Testing without production parameter (default):');
const result1 = await handleCodePractices({
  code: testCode,
  filename: 'test.js'
});
console.log(result1.content[0].text);
console.log('\n' + '='.repeat(80) + '\n');

// Test 2: With production=false explicitly
console.log('2. Testing with production=false:');
const result2 = await handleCodePractices({
  code: testCode,
  filename: 'test.js',
  production: false
});
console.log(result2.content[0].text);
console.log('\n' + '='.repeat(80) + '\n');

// Test 3: With production=true
console.log('3. Testing with production=true:');
const result3 = await handleCodePractices({
  code: testCode,
  filename: 'test.js',
  production: true
});
console.log(result3.content[0].text);
console.log('\n' + '='.repeat(80) + '\n');

// Test 4: Clean code in production mode
console.log('4. Testing clean code with production=true:');
const cleanCode = `const greeting = 'Hello, World!';

function displayGreeting(name) {
  return \`\${greeting} \${name}\`;
}

export { displayGreeting };`;

const result4 = await handleCodePractices({
  code: cleanCode,
  filename: 'clean.js',
  production: true
});
console.log(result4.content[0].text);