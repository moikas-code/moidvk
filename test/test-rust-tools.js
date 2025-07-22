#!/usr/bin/env bun

/**
 * Test script for Rust tools in MOIDVK
 * 
 * This demonstrates how to use the Rust analysis tools
 */

import { readFile } from 'fs/promises';

// Example Rust code with various issues
const rustCode = `
fn main() {
    // Unwrap that could panic
    let file = std::fs::File::open("test.txt").unwrap();
    
    // Unsafe block
    unsafe {
        let x = 5;
        let ptr = &x as *const i32;
        println!("{}", *ptr);
    }
    
    // Missing error handling
    let result = divide(10, 0);
}

fn divide(a: i32, b: i32) -> i32 {
    a / b  // No zero check!
}
`;

// Test configurations
const tests = [
  {
    name: "Rust Code Practices (Standard)",
    tool: "rust_code_practices",
    args: {
      code: rustCode,
      edition: "2021",
      pedantic: false,
      limit: 10
    }
  },
  {
    name: "Rust Code Practices (Pedantic)",
    tool: "rust_code_practices", 
    args: {
      code: rustCode,
      edition: "2021",
      pedantic: true,
      category: "correctness"
    }
  },
  {
    name: "Rust Formatter",
    tool: "rust_formatter",
    args: {
      code: "fn main(){let x=1;println!(\"{}\",x);}",
      edition: "2021",
      max_width: 80,
      tab_spaces: 4
    }
  },
  {
    name: "Rust Safety Checker",
    tool: "rust_safety_checker",
    args: {
      code: rustCode,
      strict: true
    }
  }
];

// Simple test runner
async function runTests() {
  console.log("🦀 Testing Rust Tools for MOIDVK\n");
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log("─".repeat(50));
    
    try {
      // In a real MCP client, you would call the tool like this:
      // const result = await client.callTool(test.tool, test.args);
      
      console.log(`Tool: ${test.tool}`);
      console.log(`Args:`, JSON.stringify(test.args, null, 2));
      console.log("\n✅ Test configuration ready");
      
      // Example expected output format
      console.log("\nExpected output format:");
      switch(test.tool) {
        case 'rust_code_practices':
          console.log("- Lint violations with line numbers");
          console.log("- Severity levels (error/warning)");
          console.log("- Suggestions for fixes");
          break;
        case 'rust_formatter':
          console.log("- Formatted code");
          console.log("- Indication if changes were made");
          break;
        case 'rust_safety_checker':
          console.log("- Safety score (0-100)");
          console.log("- List of unsafe patterns");
          console.log("- Memory safety violations");
          break;
      }
    } catch (error) {
      console.error(`❌ Error in test: ${error.message}`);
    }
  }
  
  console.log("\n\n📝 Summary:");
  console.log("- To use these tools, ensure Rust toolchain is installed");
  console.log("- Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh");
  console.log("- Add components: rustup component add clippy rustfmt");
  console.log("- Tools require cargo, clippy, and rustfmt in PATH");
}

// Run the tests
runTests().catch(console.error);