#!/usr/bin/env bun

// Comprehensive audit test with debug output
import { spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";

const sleep = promisify(setTimeout);

async function runComprehensiveAudit() {
  console.log("Starting comprehensive moidvk server audit with debug output...\n");
  
  // Start the server
  const server = spawn("bun", ["run", "server.js"], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  
  let allOutput = "";
  let responses = [];
  
  // Listen for all output
  server.stdout.on("data", (data) => {
    const output = data.toString();
    allOutput += output;
    console.log("[STDOUT]:", output);
    
    const lines = output.split("\n").filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        if (response.result && response.result.content) {
          console.log("\n" + "=".repeat(80));
          console.log(`✅ Response for request ${response.id}:`);
          console.log("=".repeat(80));
          response.result.content.forEach(content => {
            if (content.type === 'text') {
              console.log(content.text);
            }
          });
        }
      } catch (e) {
        // Log non-JSON output
        if (line.trim()) {
          console.log("[Non-JSON]:", line);
        }
      }
    });
  });
  
  // Listen for stderr
  server.stderr.on("data", (data) => {
    console.log("[STDERR]:", data.toString());
  });
  
  // Wait for server to start
  await sleep(2000);
  
  // Send initialization request
  const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-10-07",
      capabilities: {},
      clientInfo: {
        name: "audit-client",
        version: "1.0.0"
      }
    }
  };
  
  console.log("\nSending initialization request...");
  server.stdin.write(JSON.stringify(initRequest) + "\n");
  await sleep(1000);
  
  // Test each tool individually with proper error handling
  const tests = [
    {
      name: "check_code_practices",
      description: "Code practices on server.js",
      request: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "check_code_practices",
          arguments: {
            code: fs.readFileSync("server.js", "utf8").slice(0, 1000), // First 1000 chars
            filename: "server.js"
          }
        }
      }
    },
    {
      name: "check_production_readiness",
      description: "Production readiness with strict mode",
      request: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "check_production_readiness",
          arguments: {
            code: `console.error('Test error');
debugger;
// TODO: Fix this
const api_key = "hardcoded-key";`,
            filename: "test.js",
            strict: true
          }
        }
      }
    },
    {
      name: "check_safety_rules", 
      description: "Safety rules on RateLimiter",
      request: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "check_safety_rules",
          arguments: {
            code: fs.readFileSync("lib/security/RateLimiter.js", "utf8"),
            filename: "RateLimiter.js"
          }
        }
      }
    },
    {
      name: "check_accessibility",
      description: "Accessibility on HTML content",
      request: {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "check_accessibility",
          arguments: {
            code: `<div class="container">
  <h1>Security Audit Report</h1>
  <p>This is a sample HTML page for accessibility testing.</p>
  <button onclick="alert('test')">Click me</button>
  <img src="test.jpg" alt="Test image">
  <img src="no-alt.jpg">
  <div onclick="doSomething()">Clickable div without role</div>
</div>`,
            filename: "test.html"
          }
        }
      }
    },
    {
      name: "scan_security_vulnerabilities",
      description: "Security vulnerability scan",
      request: {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "scan_security_vulnerabilities",
          arguments: {
            format: "summary",
            includeTests: false
          }
        }
      }
    }
  ];
  
  // Run each test
  for (const test of tests) {
    console.log(`\n\n🔍 Testing: ${test.description}`);
    console.log("Request:", JSON.stringify(test.request, null, 2));
    server.stdin.write(JSON.stringify(test.request) + "\n");
    await sleep(3000); // Give more time for each test
  }
  
  // Final wait
  await sleep(2000);
  
  // Clean up
  console.log("\n\nStopping server...");
  server.kill();
  
  // Save debug output
  fs.writeFileSync("audit-debug-output.txt", allOutput);
  
  console.log("\n" + "=".repeat(80));
  console.log("AUDIT SUMMARY");
  console.log("=".repeat(80));
  console.log("Total responses received:", responses.length);
  console.log("Debug output saved to: audit-debug-output.txt");
  
  // Analyze responses
  if (responses.length > 0) {
    console.log("\nSuccessful responses:");
    responses.forEach(r => {
      if (r.result) {
        console.log(`- Request ${r.id}: Success`);
      } else if (r.error) {
        console.log(`- Request ${r.id}: Error - ${r.error.message}`);
      }
    });
  }
}

// Run the audit
runComprehensiveAudit().catch(console.error);