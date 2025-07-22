#!/usr/bin/env node

/**
 * Test Go tools MCP server integration
 * Verifies that all Go tools are properly registered and accessible via MCP
 */

import { spawn } from 'child_process';

class GoMCPIntegrationTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.serverProcess = null;
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async assert(condition, message) {
    if (condition) {
      this.passed++;
      this.log(`✅ PASS: ${message}`);
    } else {
      this.failed++;
      this.log(`❌ FAIL: ${message}`);
    }
  }

  async startMCPServer() {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['server.js'], {
        cwd: '/home/moika/Documents/code/moidvk',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/go/bin` },
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      this.serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      this.serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Server is ready when it starts listening
        if (
          stderr.includes('Server started') ||
          stderr.includes('listening') ||
          data.toString().includes('[MOIDVK]')
        ) {
          if (!resolved) {
            resolved = true;
            resolve({ stdout, stderr });
          }
        }
      });

      this.serverProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      // Give server time to start
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ stdout, stderr });
        }
      }, 3000);
    });
  }

  async sendMCPRequest(request) {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess) {
        reject(new Error('Server not started'));
        return;
      }

      let response = '';
      let responseReceived = false;

      const timeout = setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true;
          reject(new Error('Request timeout'));
        }
      }, 10000);

      this.serverProcess.stdout.on('data', (data) => {
        response += data.toString();
        try {
          const lines = response.split('\\n').filter((line) => line.trim());
          for (const line of lines) {
            if (line.startsWith('{') && line.includes('"jsonrpc"')) {
              const jsonResponse = JSON.parse(line);
              if (!responseReceived) {
                responseReceived = true;
                clearTimeout(timeout);
                resolve(jsonResponse);
                return;
              }
            }
          }
        } catch (e) {
          // Continue collecting response
        }
      });

      // Send request
      this.serverProcess.stdin.write(JSON.stringify(request) + '\\n');
    });
  }

  async testListTools() {
    this.log('\\n🔍 Testing MCP List Tools...');

    try {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      const response = await this.sendMCPRequest(request);

      await this.assert(
        response && response.result && response.result.tools,
        'MCP server returns tools list',
      );

      const tools = response.result.tools;
      const goTools = tools.filter((tool) => tool.name.startsWith('go_'));

      await this.assert(
        goTools.length === 6,
        `All 6 Go tools are registered (found ${goTools.length})`,
      );

      const expectedGoTools = [
        'go_code_analyzer',
        'go_formatter',
        'go_security_scanner',
        'go_performance_analyzer',
        'go_test_analyzer',
        'go_dependency_scanner',
      ];

      for (const expectedTool of expectedGoTools) {
        const found = tools.find((tool) => tool.name === expectedTool);
        await this.assert(found !== undefined, `Tool ${expectedTool} is registered`);

        if (found) {
          await this.assert(
            found.description && found.description.length > 0,
            `Tool ${expectedTool} has description`,
          );

          await this.assert(
            found.inputSchema && found.inputSchema.properties,
            `Tool ${expectedTool} has input schema`,
          );
        }
      }
    } catch (error) {
      await this.assert(false, `List tools test failed: ${error.message}`);
    }
  }

  async testGoCodeAnalyzer() {
    this.log('\\n🔍 Testing Go Code Analyzer via MCP...');

    try {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'go_code_analyzer',
          arguments: {
            code: 'package main\\n\\nimport "fmt"\\n\\nfunc main() {\\n    fmt.Println("Hello, World!")\\n}',
            filename: 'main.go',
            tools: ['vet'],
            limit: 5,
          },
        },
      };

      const response = await this.sendMCPRequest(request);

      await this.assert(
        response && response.result && response.result.content,
        'Go code analyzer returns result via MCP',
      );

      if (response.result && response.result.content) {
        const content = response.result.content[0];
        await this.assert(
          content.text && content.text.includes('Go Code Analysis Results'),
          'Go code analyzer returns proper analysis results',
        );
      }
    } catch (error) {
      await this.assert(false, `Go code analyzer MCP test failed: ${error.message}`);
    }
  }

  async testGoFormatter() {
    this.log('\\n🎨 Testing Go Formatter via MCP...');

    try {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'go_formatter',
          arguments: {
            code: 'package main\\nimport"fmt"\\nfunc main(){fmt.Println("test")}',
            filename: 'main.go',
            tool: 'gofmt',
            check: true,
          },
        },
      };

      const response = await this.sendMCPRequest(request);

      await this.assert(
        response && response.result && response.result.content,
        'Go formatter returns result via MCP',
      );
    } catch (error) {
      await this.assert(false, `Go formatter MCP test failed: ${error.message}`);
    }
  }

  async testGoDependencyScanner() {
    this.log('\\n📦 Testing Go Dependency Scanner via MCP...');

    try {
      const goMod =
        'module example.com/test\\n\\ngo 1.21\\n\\nrequire (\\n    github.com/gorilla/mux v1.8.0\\n)';

      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'go_dependency_scanner',
          arguments: {
            goMod: goMod,
            scanType: 'all',
            severity: 'all',
          },
        },
      };

      const response = await this.sendMCPRequest(request);

      await this.assert(
        response && response.result && response.result.content,
        'Go dependency scanner returns result via MCP',
      );

      if (response.result && response.result.content) {
        const content = response.result.content[0];
        await this.assert(
          content.text && content.text.includes('Go Dependency Scan Results'),
          'Go dependency scanner returns proper scan results',
        );
      }
    } catch (error) {
      await this.assert(false, `Go dependency scanner MCP test failed: ${error.message}`);
    }
  }

  async stopMCPServer() {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise((resolve) => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 2000); // Fallback timeout
      });

      this.serverProcess = null;
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Go MCP Integration Test Suite...');

    try {
      // Start MCP server
      this.log('\\n🔧 Starting MCP server...');
      await this.startMCPServer();
      this.log('✅ MCP server started');

      // Run tests
      await this.testListTools();
      await this.testGoCodeAnalyzer();
      await this.testGoFormatter();
      await this.testGoDependencyScanner();
    } catch (error) {
      this.log(`❌ Test suite error: ${error.message}`);
      this.failed++;
    } finally {
      // Stop MCP server
      this.log('\\n🔧 Stopping MCP server...');
      await this.stopMCPServer();
      this.log('✅ MCP server stopped');
    }

    this.log('\\n📊 MCP Integration Test Results:');
    this.log(`✅ Passed: ${this.passed}`);
    this.log(`❌ Failed: ${this.failed}`);
    this.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);

    if (this.failed === 0) {
      this.log('\\n🎉 All MCP integration tests passed! Go tools are fully integrated.');
      return true;
    } else {
      this.log('\\n⚠️  Some MCP integration tests failed. Please review the implementation.');
      return false;
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new GoMCPIntegrationTest();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

export { GoMCPIntegrationTest };
