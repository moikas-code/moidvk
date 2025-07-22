#!/usr/bin/env bun

import { SafetyAnalyzer } from '../lib/safety-analyzer.js';

// Test the SafetyAnalyzer directly
console.log("Testing SafetyAnalyzer directly...\n");

const analyzer = new SafetyAnalyzer();

// Test 1: Recursion
console.log("Test 1: Recursion Detection");
const recursiveCode = `
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}`;

const result1 = analyzer.analyze(recursiveCode);
console.log("  Result:", JSON.stringify(result1, null, 2));
if (result1.success) {
  console.log(`  Safety Score: ${result1.score}/100`);
  console.log(`  Violations: ${result1.violations.map(v => v.rule).join(', ')}`);
  console.log(`  ${result1.violations.some(v => v.rule === 'recursion') ? '✅' : '❌'} Recursion detected\n`);
} else {
  console.log(`  ❌ Analysis failed: ${result1.error}\n`);
}

// Test 2: Safe code
console.log("Test 2: Safe Code");
const safeCode = `
function add(a, b) {
  if (typeof a !== 'number') throw new Error('a must be number');
  if (typeof b !== 'number') throw new Error('b must be number');
  return a + b;
}`;

const result2 = analyzer.analyze(safeCode);
console.log(`  Safety Score: ${result2.score}/100`);
console.log(`  Violations: ${result2.violations.length}`);
console.log(`  ${result2.score === 100 ? '✅' : '❌'} Perfect safety score\n`);

// Test 3: Multiple violations
console.log("Test 3: Multiple Violations");
const unsafeCode = `
var globalConfig = {};

function processData() {
  while (true) {
    console.log("Processing...");
  }
}`;

const result3 = analyzer.analyze(unsafeCode);
if (result3.success) {
  console.log(`  Safety Score: ${result3.score}/100`);
  console.log(`  Critical: ${result3.summary.critical}`);
  console.log(`  Warnings: ${result3.summary.warning}`);
  console.log(`  ${result3.summary.critical > 0 ? '✅' : '❌'} Critical issues found\n`);
} else {
  console.log(`  ❌ Analysis failed: ${result3.error}\n`);
}

console.log("All tests completed!");