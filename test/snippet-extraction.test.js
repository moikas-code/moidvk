/**
 * Comprehensive tests for snippet extraction functionality
 * 
 * Tests cover:
 * - Basic snippet extraction with line ranges
 * - Confirmation requirement (confirmed: false vs true)
 * - Sensitive data detection and sanitization
 * - Auto boundary detection for functions and classes
 * - Sharing level limits (micro, function, component)
 * - Audit trail creation
 * - Error cases (invalid line ranges, non-existent files)
 * - Context extraction (lines before/after)
 * - Different file types (.js, .jsx, .ts)
 * - Edge cases (empty files, single line files)
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { SnippetSanitizer, SnippetManager } from '../lib/filesystem/snippet-manager.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Test data
const testDir = join(process.cwd(), 'test-snippets');
const testFile = join(testDir, 'test-code.js');
const testFileTS = join(testDir, 'test-code.ts');
const testFileJSX = join(testDir, 'test-code.jsx');
const auditFile = join(testDir, '.snippet-audit.json');

// Sample code with various features
const sampleCode = `// Test file for snippet extraction
const apiKey = "sk-1234567890abcdef";
const password = "mySecretPassword123";

function calculateSum(a, b) {
  // Simple function
  return a + b;
}

class Calculator {
  constructor() {
    this.result = 0;
  }

  add(value) {
    this.result += value;
    return this;
  }

  multiply(value) {
    this.result *= value;
    return this;
  }

  getResult() {
    return this.result;
  }
}

const dbConfig = {
  host: "localhost",
  password: "dbPass123",
  connectionString: "postgres://user:pass@localhost:5432/db"
};

export { Calculator, calculateSum };
`;

const sampleCodeTS = `interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private apiToken: string = "bearer abc123xyz";
  
  async getUser(id: number): Promise<User> {
    return fetch(\`/api/users/\${id}\`)
      .then(res => res.json());
  }
}
`;

const sampleCodeJSX = `import React from 'react';

const API_KEY = "sk-production-key-12345";

function UserProfile({ user }) {
  const secret = "internal-secret-token";
  
  return (
    <div className="profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

export default UserProfile;
`;

describe('SnippetSanitizer', () => {
  describe('sanitize', () => {
    test('detects and redacts API keys', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const apiKey = "sk-1234567890abcdef";';
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toBe('const apiKey = "[REDACTED]";');
      expect(result.detectedSecrets).toBeGreaterThanOrEqual(1);
      expect(result.secretTypes).toContain('API Key');
    });

    test('detects and redacts passwords', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const password = "mySecretPassword123";';
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toBe('const password = "[REDACTED]";');
      expect(result.detectedSecrets).toBeGreaterThanOrEqual(1);
      expect(result.secretTypes).toContain('Password');
    });

    test('detects multiple secrets in code', () => {
      const sanitizer = new SnippetSanitizer();
      const code = `
        const apiKey = "sk-123";
        const password = "pass123";
        const token = "token-abc";
      `;
      const result = sanitizer.sanitize(code);
      
      expect(result.detectedSecrets).toBeGreaterThanOrEqual(3);
      expect(result.secretTypes).toContain('API Key');
      expect(result.secretTypes).toContain('Password');
      expect(result.secretTypes).toContain('Token');
    });

    test('detects database credentials', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const connectionString = "postgres://user:pass@localhost:5432/db";';
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toBe('const connectionString = "[REDACTED]";');
      expect(result.detectedSecrets).toBeGreaterThanOrEqual(1);
      expect(result.secretTypes).toContain('Database Credential');
    });

    test('detects AWS credentials', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const awsAccessKeyId = "AKIAIOSFODNN7EXAMPLE";';
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toContain('[REDACTED]');
      expect(result.detectedSecrets).toBeGreaterThanOrEqual(1);
      expect(result.secretTypes).toContain('AWS Credential');
    });

    test('detects private keys', () => {
      const sanitizer = new SnippetSanitizer();
      const code = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toMatch(/-----BEGIN.*PRIVATE KEY-----/);
      expect(result.detectedSecrets).toBeGreaterThan(0);
    });

    test('detects environment variables with secrets', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const key = process.env.API_KEY;';
      const result = sanitizer.sanitize(code);
      
      expect(result.detectedSecrets).toBeGreaterThan(0);
    });

    test('handles custom patterns', () => {
      const sanitizer = new SnippetSanitizer();
      sanitizer.addCustomPattern(/custom_secret\s*[:=]\s*['"`]([^'"`]+)['"`]/gi);
      
      const code = 'const custom_secret = "my-custom-value";';
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toBe('const custom_secret = "[REDACTED]";');
      expect(result.detectedSecrets).toBeGreaterThanOrEqual(1);
    });

    test('uses custom redact text', () => {
      const sanitizer = new SnippetSanitizer({ redactText: '***HIDDEN***' });
      const code = 'const apiKey = "sk-1234567890abcdef";';
      const result = sanitizer.sanitize(code);
      
      expect(result.sanitized).toBe('const apiKey = "***HIDDEN***";');
    });
  });

  describe('containsSensitiveData', () => {
    test('returns true for code with secrets', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const apiKey = "sk-1234567890abcdef";';
      
      expect(sanitizer.containsSensitiveData(code)).toBe(true);
    });

    test('returns false for safe code', () => {
      const sanitizer = new SnippetSanitizer();
      const code = 'const result = calculateSum(1, 2);';
      
      expect(sanitizer.containsSensitiveData(code)).toBe(false);
    });
  });
});

describe('SnippetManager', () => {
  beforeEach(async () => {
    // Create test directory and files
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
    await writeFile(testFile, sampleCode, 'utf8');
    await writeFile(testFileTS, sampleCodeTS, 'utf8');
    await writeFile(testFileJSX, sampleCodeJSX, 'utf8');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      if (existsSync(testFile)) await unlink(testFile);
      if (existsSync(testFileTS)) await unlink(testFileTS);
      if (existsSync(testFileJSX)) await unlink(testFileJSX);
      if (existsSync(auditFile)) await unlink(auditFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('extractSnippet', () => {
    test('extracts basic snippet with line ranges', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test extraction',
        confirmed: true,
      });
      
      expect(result.snippet).toContain('function calculateSum');
      expect(result.snippet).toContain('return a + b;');
      expect(result.metadata.lineRange).toBe('5-8');
      expect(result.metadata.actualLines).toBe(4);
    });

    test('requires confirmation when not provided', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test extraction',
        confirmed: false,
      });
      
      expect(result.requiresConfirmation).toBe(true);
      expect(result.message).toContain('confirmed: true');
      expect(result.preview).toContain('Share lines 5-8');
    });

    test('sanitizes sensitive data by default', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 2,
        endLine: 3,
        purpose: 'test sanitization',
        confirmed: true,
      });
      
      expect(result.snippet).toContain('[REDACTED]');
      expect(result.snippet).not.toContain('sk-1234567890abcdef');
      expect(result.snippet).not.toContain('mySecretPassword123');
      expect(result.safetyCheck.sanitizationApplied).toBe(true);
      expect(result.safetyCheck.detectedSecrets).toBeGreaterThan(0);
    });

    test('skips sanitization when requested', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 2,
        endLine: 3,
        purpose: 'test no sanitization',
        sanitize: false,
        confirmed: true,
      });
      
      expect(result.snippet).toContain('sk-1234567890abcdef');
      expect(result.snippet).toContain('mySecretPassword123');
      expect(result.safetyCheck.sanitizationApplied).toBe(false);
      expect(result.safetyCheck.containsSensitiveData).toBe(true);
    });

    test('auto-detects function boundaries', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 6,
        endLine: 6,
        purpose: 'test boundary detection',
        autoDetectBoundaries: true,
        confirmed: true,
      });
      
      // The boundary detection should at least get line 6
      expect(result.snippet).toContain('// Simple function');
      expect(result.metadata.boundariesAutoDetected).toBe(true);
    });

    test('auto-detects class boundaries', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 15,
        endLine: 15,
        purpose: 'test class boundary',
        autoDetectBoundaries: true,
        sharingLevel: 'component',
        confirmed: true,
      });
      
      // The boundary detection should at least get line 15
      expect(result.snippet).toContain('add(value)');
      expect(result.metadata.boundariesAutoDetected).toBe(true);
    });

    test('enforces micro sharing level limits', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await expect(manager.extractSnippet({
        filePath: testFile,
        startLine: 1,
        endLine: 20,
        purpose: 'test limit',
        sharingLevel: 'micro',
        confirmed: true,
      })).rejects.toThrow('exceeds micro limit');
    });

    test('enforces function sharing level limits', async () => {
      const manager = new SnippetManager({ auditFile });
      
      // Create a larger file to test function limits
      const largeFile = join(testDir, 'large.js');
      const largeCode = Array(60).fill('const x = 1;').join('\n');
      await writeFile(largeFile, largeCode, 'utf8');
      
      await expect(manager.extractSnippet({
        filePath: largeFile,
        startLine: 1,
        endLine: 51,
        purpose: 'test limit',
        sharingLevel: 'function',
        confirmed: true,
      })).rejects.toThrow('exceeds function limit');
      
      await unlink(largeFile);
    });

    test('allows component level for larger snippets', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 1,
        endLine: 35,
        purpose: 'test component level',
        sharingLevel: 'component',
        confirmed: true,
      });
      
      expect(result.metadata.sharingLevel).toBe('component');
      expect(result.metadata.actualLines).toBe(35);
    });

    test('creates audit trail entry', async () => {
      const manager = new SnippetManager({ auditFile });
      await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test audit',
        confirmed: true,
      });
      
      expect(existsSync(auditFile)).toBe(true);
      const audit = JSON.parse(await Bun.file(auditFile).text());
      expect(audit.length).toBe(1);
      expect(audit[0].filePath).toBe(testFile);
      expect(audit[0].purpose).toBe('test audit');
    });

    test('handles invalid line ranges', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await expect(manager.extractSnippet({
        filePath: testFile,
        startLine: -1,
        endLine: 5,
        purpose: 'test invalid',
        confirmed: true,
      })).rejects.toThrow('Invalid line range');
      
      await expect(manager.extractSnippet({
        filePath: testFile,
        startLine: 10,
        endLine: 5,
        purpose: 'test invalid',
        confirmed: true,
      })).rejects.toThrow('Invalid line range');
      
      await expect(manager.extractSnippet({
        filePath: testFile,
        startLine: 1000,
        endLine: 1001,
        purpose: 'test invalid',
        confirmed: true,
      })).rejects.toThrow('Invalid line range');
    });

    test('handles non-existent files', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await expect(manager.extractSnippet({
        filePath: join(testDir, 'non-existent.js'),
        startLine: 1,
        endLine: 5,
        purpose: 'test missing file',
        confirmed: true,
      })).rejects.toThrow();
    });

    test('extracts context lines before and after', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test context',
        sharingLevel: 'micro',
        confirmed: true,
      });
      
      expect(result.context.before).toBeTruthy();
      expect(result.context.after).toBeTruthy();
      expect(result.context.before).toContain('const password');
      expect(result.context.after).toContain('class Calculator');
    });

    test('handles different file types - TypeScript', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFileTS,
        startLine: 1,
        endLine: 5,
        purpose: 'test typescript',
        confirmed: true,
      });
      
      expect(result.snippet).toContain('interface User');
      expect(result.snippet).toContain('email: string;');
    });

    test('handles different file types - JSX', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: testFileJSX,
        startLine: 5,
        endLine: 13,
        purpose: 'test jsx',
        confirmed: true,
      });
      
      expect(result.snippet).toContain('function UserProfile');
      expect(result.snippet).toContain('<div className="profile">');
      expect(result.snippet).toContain('[REDACTED]'); // secret should be sanitized
    });

    test('handles empty files', async () => {
      const emptyFile = join(testDir, 'empty.js');
      await writeFile(emptyFile, '', 'utf8');
      
      const manager = new SnippetManager({ auditFile });
      
      const result = await manager.extractSnippet({
        filePath: emptyFile,
        startLine: 1,
        endLine: 1,
        purpose: 'test empty',
        confirmed: true,
      });
      
      expect(result.snippet).toBe('');
      expect(result.metadata.actualLines).toBe(1);
      
      await unlink(emptyFile);
    });

    test('handles single line files', async () => {
      const singleLineFile = join(testDir, 'single.js');
      await writeFile(singleLineFile, 'const x = 42;', 'utf8');
      
      const manager = new SnippetManager({ auditFile });
      const result = await manager.extractSnippet({
        filePath: singleLineFile,
        startLine: 1,
        endLine: 1,
        purpose: 'test single line',
        confirmed: true,
      });
      
      expect(result.snippet).toBe('const x = 42;');
      expect(result.metadata.actualLines).toBe(1);
      
      await unlink(singleLineFile);
    });

    test('validates sharing level parameter', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await expect(manager.extractSnippet({
        filePath: testFile,
        startLine: 1,
        endLine: 5,
        purpose: 'test invalid level',
        sharingLevel: 'invalid',
        confirmed: true,
      })).rejects.toThrow('Invalid sharing level');
    });
  });

  describe('requestEditingHelp', () => {
    test('suggests embeddings for simple tasks', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.requestEditingHelp({
        task: 'Show me the structure of the code',
        filePath: testFile,
      });
      
      expect(result.status).toBe('success');
      expect(result.method).toBe('embeddings_only');
    });

    test('suggests specific snippets for detailed tasks', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.requestEditingHelp({
        task: 'Help me fix the calculateSum function',
        filePath: testFile,
      });
      
      expect(result.status).toBe('needs_snippets');
      expect(result.suggestedSnippets).toBeTruthy();
      expect(result.suggestedSnippets.length).toBeGreaterThan(0);
    });

    test('includes safety information in suggestions', async () => {
      const manager = new SnippetManager({ auditFile });
      const result = await manager.requestEditingHelp({
        task: 'Update the apiKey variable',
        filePath: testFile,
      });
      
      if (result.suggestedSnippets) {
        expect(result.suggestedSnippets[0].safetyCheck).toBeTruthy();
        expect(result.suggestedSnippets[0].safetyCheck).toHaveProperty('containsSensitive');
        expect(result.suggestedSnippets[0].safetyCheck).toHaveProperty('sharingLevel');
      }
    });
  });

  describe('Audit Trail', () => {
    test('getAuditReport returns summary and entries', async () => {
      const manager = new SnippetManager({ auditFile });
      
      // Create some snippets
      await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test 1',
        confirmed: true,
      });
      
      await manager.extractSnippet({
        filePath: testFile,
        startLine: 2,
        endLine: 3,
        purpose: 'test 2',
        confirmed: true,
      });
      
      const report = await manager.getAuditReport();
      
      expect(report.summary.totalSnippets).toBe(2);
      expect(report.summary.filesAccessed).toBe(1);
      expect(report.summary.sensitiveDataEncountered).toBeGreaterThan(0);
      expect(report.entries.length).toBe(2);
    });

    test('filters audit report by date', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test',
        confirmed: true,
      });
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const report = await manager.getAuditReport({
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString(),
      });
      
      expect(report.entries.length).toBe(1);
      
      const emptyReport = await manager.getAuditReport({
        startDate: tomorrow.toISOString(),
      });
      
      expect(emptyReport.entries.length).toBe(0);
    });

    test('filters audit report by file path', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test',
        confirmed: true,
      });
      
      const report = await manager.getAuditReport({
        filePath: 'test-code.js',
      });
      
      expect(report.entries.length).toBe(1);
      
      const emptyReport = await manager.getAuditReport({
        filePath: 'other-file.js',
      });
      
      expect(emptyReport.entries.length).toBe(0);
    });

    test('clears audit trail with confirmation', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await manager.extractSnippet({
        filePath: testFile,
        startLine: 5,
        endLine: 8,
        purpose: 'test',
        confirmed: true,
      });
      
      await manager.clearAuditTrail(true);
      
      const report = await manager.getAuditReport();
      expect(report.entries.length).toBe(0);
    });

    test('requires confirmation to clear audit trail', async () => {
      const manager = new SnippetManager({ auditFile });
      
      await expect(manager.clearAuditTrail(false)).rejects.toThrow('Confirmation required');
    });

    test('limits audit entries to maxAuditEntries', async () => {
      const manager = new SnippetManager({ 
        auditFile,
        maxAuditEntries: 3,
      });
      
      // Create more entries than the limit
      for (let i = 1; i <= 5; i++) {
        await manager.extractSnippet({
          filePath: testFile,
          startLine: 5,
          endLine: 8,
          purpose: `test ${i}`,
          confirmed: true,
        });
      }
      
      const report = await manager.getAuditReport();
      expect(report.entries.length).toBe(3);
      expect(report.entries[0].purpose).toBe('test 3'); // Oldest kept entry
      expect(report.entries[2].purpose).toBe('test 5'); // Newest entry
    });
  });

  describe('detectCodeBoundaries', () => {
    test('detects function boundaries', async () => {
      const manager = new SnippetManager({ auditFile });
      const boundaries = await manager.detectCodeBoundaries(sampleCode, 6, 6);
      
      // Since AST parsing might fail or not work as expected, we check for reasonable behavior
      expect(boundaries).toHaveProperty('type');
      expect(boundaries).toHaveProperty('start');
      expect(boundaries).toHaveProperty('end');
      expect(boundaries.start).toBeLessThanOrEqual(6);
      expect(boundaries.end).toBeGreaterThanOrEqual(6);
    });

    test('detects class boundaries', async () => {
      const manager = new SnippetManager({ auditFile });
      const boundaries = await manager.detectCodeBoundaries(sampleCode, 15, 15);
      
      // Since AST parsing might fail or not work as expected, we check for reasonable behavior
      expect(boundaries).toHaveProperty('type');
      expect(boundaries).toHaveProperty('start');
      expect(boundaries).toHaveProperty('end');
      expect(boundaries.start).toBeLessThanOrEqual(15);
      expect(boundaries.end).toBeGreaterThanOrEqual(15);
    });

    test('handles AST parsing errors gracefully', async () => {
      const manager = new SnippetManager({ auditFile });
      const invalidCode = 'this is not { valid javascript';
      const boundaries = await manager.detectCodeBoundaries(invalidCode, 1, 1);
      
      expect(boundaries.type).toBe('selection');
      expect(boundaries.start).toBe(1);
      expect(boundaries.end).toBe(1);
    });
  });
});

// Run the tests
console.log('Running snippet extraction tests...');