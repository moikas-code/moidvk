#!/usr/bin/env bun

import { spawn } from 'child_process';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testFilesystemTools() {
  console.log('Starting Filesystem Tools test...');
  
  // Start the server
  const server = spawn('bun', ['run', 'server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Log server errors
  server.stderr.on('data', (data) => {
    console.error('Server:', data.toString());
  });

  // Wait for server to start
  await sleep(1000);

  // Test 1: List tools to verify filesystem tools are registered
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  };

  console.log('\nRequesting list of tools...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Wait for response
  await sleep(500);
  
  // Test 2: Create a test file
  const createFileRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'create_file',
      arguments: {
        filePath: 'test-files/hello.txt',
        content: 'Hello from filesystem tools!',
      },
    },
  };
  
  console.log('\nTesting create_file tool...');
  server.stdin.write(JSON.stringify(createFileRequest) + '\n');
  
  await sleep(500);
  
  // Test 3: Read the file
  const readFileRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'read_file',
      arguments: {
        filePath: 'test-files/hello.txt',
      },
    },
  };
  
  console.log('\nTesting read_file tool...');
  server.stdin.write(JSON.stringify(readFileRequest) + '\n');
  
  await sleep(500);
  
  // Test 4: List directory
  const listDirRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'list_directory',
      arguments: {
        directoryPath: 'test-files',
      },
    },
  };
  
  console.log('\nTesting list_directory tool...');
  server.stdin.write(JSON.stringify(listDirRequest) + '\n');
  
  await sleep(500);
  
  // Test 5: Delete file (without confirmation - should fail)
  const deleteFileRequest = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'delete_file',
      arguments: {
        filePath: 'test-files/hello.txt',
        confirmed: false,
      },
    },
  };
  
  console.log('\nTesting delete_file tool (should require confirmation)...');
  server.stdin.write(JSON.stringify(deleteFileRequest) + '\n');
  
  await sleep(1000);
  
  // Clean up
  console.log('\nStopping server...');
  server.kill();
  
  console.log('\nTest complete!');
}

// Capture server output
async function callTool(server, method, params) {
  return new Promise((resolve) => {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };
    
    let response = '';
    const onData = (data) => {
      response += data.toString();
      try {
        const json = JSON.parse(response);
        console.log('Response:', JSON.stringify(json, null, 2));
        resolve(json);
      } catch (e) {
        // Continue accumulating
      }
    };
    
    server.stdout.on('data', onData);
    server.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      server.stdout.removeListener('data', onData);
      resolve(null);
    }, 1000);
  });
}

// Run the test
testFilesystemTools().catch(console.error);