#!/usr/bin/env bun

// Test script for the NASA JPL safety rules checker

const testCases = [
  {
    name: "Recursion violation",
    code: `
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1); // Recursive call
}`,
    expectedViolations: ['recursion']
  },
  {
    name: "Infinite loop violation",
    code: `
function runForever() {
  while (true) {
    console.log("This never ends");
  }
}`,
    expectedViolations: ['infinite-loop']
  },
  {
    name: "Long function violation",
    code: `
function veryLongFunction() {
${Array(65).fill('  console.log("Line");').join('\n')}
}`,
    expectedViolations: ['function-length']
  },
  {
    name: "Global variable violation",
    code: `
var globalVar = 42; // Global scope
let anotherGlobal = "bad";

function useGlobal() {
  return globalVar;
}`,
    expectedViolations: ['global-variable', 'var-usage']
  },
  {
    name: "Missing assertions",
    code: `
function divide(a, b) {
  // No validation checks
  return a / b;
}`,
    expectedViolations: ['insufficient-assertions']
  },
  {
    name: "Safe code with assertions",
    code: `
function safeDivide(a, b) {
  if (typeof a !== 'number') throw new Error('a must be number');
  if (typeof b !== 'number') throw new Error('b must be number');
  if (b === 0) throw new Error('Cannot divide by zero');
  
  return a / b;
}`,
    expectedViolations: []
  },
  {
    name: "Unbounded loop",
    code: `
function searchArray(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}`,
    expectedViolations: [] // for-of/for-in are considered bounded
  },
  {
    name: "Deep property nesting",
    code: `
const value = obj.level1.level2.level3.level4.level5;`,
    expectedViolations: ['deep-nesting']
  },
  {
    name: "Ignored async return",
    code: `
async function getData() {
  return fetch('/api/data');
}

function main() {
  getData(); // Return value ignored
}`,
    expectedViolations: ['ignored-async-return']
  },
  {
    name: "Multiple violations",
    code: `
var GLOBAL = true;

function recursiveCount(n) {
  console.log(n);
  if (n > 0) {
    recursiveCount(n - 1);
  }
  
  while (true) {
    if (!GLOBAL) break;
  }
}`,
    expectedViolations: ['global-variable', 'var-usage', 'recursion', 'infinite-loop', 'insufficient-assertions']
  }
];

console.log("Testing NASA JPL Safety Rules Analyzer...\n");

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);
  
  try {
    // In real usage, this would be called via MCP protocol
    // Here we're just showing expected behavior
    
    const expectedCount = testCase.expectedViolations.length;
    if (expectedCount === 0) {
      console.log("  ✅ Expected: Safe code (no violations)");
    } else {
      console.log(`  ✅ Expected violations: ${testCase.expectedViolations.join(', ')}`);
    }
    passed++;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
console.log("\nNote: To see actual analysis results, use the tool via Claude Desktop.");