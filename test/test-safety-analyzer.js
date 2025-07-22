import { SafetyAnalyzer } from '../lib/safety-analyzer.js';

// Test the refactored safety analyzer
const analyzer = new SafetyAnalyzer();

// Test 1: Basic functionality
console.log('=== Test 1: Basic functionality ===');
const result1 = analyzer.analyze(`
function test() {
  console.log('hello');
}
`, 'test.js');
console.log('Result:', result1);

// Test 2: Code with violations
console.log('\n=== Test 2: Code with violations ===');
const result2 = analyzer.analyze(`
function recursiveFunction() {
  recursiveFunction();
}

while (true) {
  console.log('infinite loop');
}
`, 'violations.js');
console.log('Result:', result2);

// Test 3: Production-ready code
console.log('\n=== Test 3: Production-ready code ===');
const result3 = analyzer.analyze(`
function calculateSum(a, b) {
  // Assert: Input validation
  if (typeof a !== 'number') {
    throw new TypeError('Parameter a must be a number');
  }
  if (typeof b !== 'number') {
    throw new TypeError('Parameter b must be a number');
  }
  
  return a + b;
}
`, 'production.js');
console.log('Result:', result3);

console.log('\n✅ Safety analyzer tests completed successfully!');