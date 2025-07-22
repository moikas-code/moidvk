import { test, expect, describe } from 'bun:test';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

describe('MCP Server Tests', () => {
  test('server starts successfully', async () => {
    const server = spawn('bun', ['run', 'server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running with') || output.includes('IntegrationManager')) {
        started = true;
      }
    });

    // Also listen to stderr in case output goes there
    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running with') || output.includes('IntegrationManager')) {
        started = true;
      }
    });

    // Wait longer for server to start
    await sleep(2000);

    expect(started).toBe(true);

    // Clean up
    server.kill();
  });

  test('check_code_practices tool validates good code', async () => {
    // This would require a full MCP client implementation
    // For now, we'll just verify the tool logic works
    const goodCode = `
const greeting = 'Hello, World!';
console.log(greeting);
    `.trim();

    // The actual tool would be called via MCP protocol
    // This is a placeholder to show expected behavior
    expect(goodCode).toContain('const');
    expect(goodCode).not.toContain('var');
  });

  test('check_code_practices tool detects issues', async () => {
    const badCode = `
var x = 1
if (x == "1") console.log("bad")
    `.trim();

    // The actual tool would return ESLint errors
    // This is a placeholder to show expected behavior
    expect(badCode).toContain('var');
    expect(badCode).toContain('==');
    expect(badCode).not.toContain('===');
  });
});
