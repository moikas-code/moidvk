#!/usr/bin/env bun

/**
 * Test the new explicit consent security feature
 */

import { spawn } from 'child_process';

console.log('Testing Explicit Consent Security Feature\n');

// Test 1: Try to use rm command (should require explicit consent)
console.log('Test 1: Attempting rm command...');
try {
  const rm = spawn('rm', ['-rf', './temp-test-file']);
  
  rm.on('error', (error) => {
    console.log('✅ rm command blocked as expected');
    console.log('Error:', error.message);
  });
  
  rm.on('exit', (code) => {
    if (code !== 0) {
      console.log('✅ rm command failed with code:', code);
    } else {
      console.log('❌ rm command succeeded - security bypass!');
    }
  });
} catch (error) {
  console.log('✅ rm command intercepted by sandbox');
  console.log('Details:', error.message);
}

// Test 2: Try to use curl command (should require explicit consent)
console.log('\nTest 2: Attempting curl command...');
try {
  const curl = spawn('curl', ['https://example.com']);
  
  curl.on('error', (error) => {
    console.log('✅ curl command blocked as expected');
    console.log('Error:', error.message);
  });
  
  curl.on('exit', (code) => {
    if (code !== 0) {
      console.log('✅ curl command failed with code:', code);
    } else {
      console.log('❌ curl command succeeded - security bypass!');
    }
  });
} catch (error) {
  console.log('✅ curl command intercepted by sandbox');
  console.log('Details:', error.message);
}

// Test 3: Try a safe command (should work)
console.log('\nTest 3: Attempting safe ls command...');
try {
  const ls = spawn('ls', ['-la']);
  
  ls.stdout.on('data', (data) => {
    console.log('✅ ls command allowed (safe command)');
  });
  
  ls.on('error', (error) => {
    console.log('❌ ls command blocked unexpectedly');
    console.log('Error:', error.message);
  });
} catch (error) {
  console.log('❌ ls command blocked - over-restrictive security');
  console.log('Details:', error.message);
}

// Test 4: Demonstrate enhanced validation
console.log('\nTest 4: Enhanced validation examples:');

const testCases = [
  {
    command: 'rm',
    args: ['-rf', '/etc/passwd'],
    expected: 'Block - system directory'
  },
  {
    command: 'rm',
    args: ['./safe-file.txt'],
    expected: 'Require consent - within workspace'
  },
  {
    command: 'curl',
    args: ['https://github.com/file.zip'],
    expected: 'Require consent - trusted domain'
  },
  {
    command: 'curl',
    args: ['http://suspicious-site.com/malware.exe'],
    expected: 'Block or high risk warning'
  },
  {
    command: 'chmod',
    args: ['777', 'script.sh'],
    expected: 'Require consent with security warning'
  }
];

console.log('\nValidation scenarios:');
testCases.forEach((test, index) => {
  console.log(`${index + 1}. ${test.command} ${test.args.join(' ')}`);
  console.log(`   Expected: ${test.expected}`);
});