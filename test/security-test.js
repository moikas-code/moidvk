import { test, expect, describe } from 'bun:test';
import { securityScannerTool, handleSecurityScanner } from '../lib/tools/security-scanner.js';

describe('Security Scanner Tool', () => {
  test('tool definition has correct structure', () => {
    expect(securityScannerTool.name).toBe('scan_security_vulnerabilities');
    expect(securityScannerTool.description).toContain('security vulnerabilities');
    expect(securityScannerTool.inputSchema.type).toBe('object');
    expect(securityScannerTool.inputSchema.properties).toHaveProperty('projectPath');
    expect(securityScannerTool.inputSchema.properties).toHaveProperty('severity');
    expect(securityScannerTool.inputSchema.properties).toHaveProperty('production');
    expect(securityScannerTool.inputSchema.properties).toHaveProperty('format');
  });

  test('input schema allows optional parameters', () => {
    expect(securityScannerTool.inputSchema.required).toEqual([]);
  });

  test('severity enum has correct values', () => {
    const severityEnum = securityScannerTool.inputSchema.properties.severity.enum;
    expect(severityEnum).toContain('low');
    expect(severityEnum).toContain('moderate');
    expect(severityEnum).toContain('high');
    expect(severityEnum).toContain('critical');
  });

  test('format enum has correct values', () => {
    const formatEnum = securityScannerTool.inputSchema.properties.format.enum;
    expect(formatEnum).toContain('summary');
    expect(formatEnum).toContain('detailed');
  });

  test('handler returns MCP-compliant response for no vulnerabilities', async () => {
    // Test with current project (should have no vulnerabilities)
    const result = await handleSecurityScanner({});
    
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text');
    expect(typeof result.content[0].text).toBe('string');
  });

  test('handler responds to different format options', async () => {
    const summaryResult = await handleSecurityScanner({ format: 'summary' });
    const detailedResult = await handleSecurityScanner({ format: 'detailed' });
    
    expect(summaryResult.content[0].text).toContain('Security Vulnerability Scan Results');
    expect(detailedResult.content[0].text).toContain('Security Vulnerability Scan Results');
  });

  test('handler responds to severity filtering', async () => {
    const result = await handleSecurityScanner({ severity: 'high' });
    
    expect(result.content[0].text).toContain('Security Vulnerability Scan Results');
  });

  test('handler responds to production flag', async () => {
    const result = await handleSecurityScanner({ production: true });
    
    expect(result.content[0].text).toContain('Security Vulnerability Scan Results');
  });

  test('handler handles invalid project path gracefully', async () => {
    const result = await handleSecurityScanner({ projectPath: '/nonexistent/path' });
    
    expect(result.content[0].text).toContain('No lockfile found');
  });

  test('response includes security recommendations', async () => {
    const result = await handleSecurityScanner({});
    const text = result.content[0].text;
    
    // Should contain some security guidance
    expect(text).toMatch(/security|vulnerabilities|dependencies/i);
  });
});

describe('Security Scanner Integration', () => {
  test('scanner detects package manager correctly', async () => {
    // This test runs in our project which has bun.lock
    const result = await handleSecurityScanner({});
    const text = result.content[0].text;
    
    // Should mention bun since we have bun.lock
    expect(text).toContain('bun');
  });

  test('scanner provides actionable output', async () => {
    const result = await handleSecurityScanner({ format: 'detailed' });
    const text = result.content[0].text;
    
    // Should contain structured sections
    expect(text).toContain('Security Vulnerability Scan Results');
    expect(text).toContain('No security vulnerabilities found');
  });
});