# Security Guide

MOIDVK implements comprehensive security measures to protect your code, data, and development
environment. This guide covers all security features, best practices, and configuration options.

## 📋 Table of Contents

- [Security Architecture](#security-architecture)
- [Security Levels](#security-levels)
- [Command Execution Security](#command-execution-security)
- [File Access Security](#file-access-security)
- [Data Privacy & Sanitization](#data-privacy--sanitization)
- [Vulnerability Scanning](#vulnerability-scanning)
- [Code Safety Analysis](#code-safety-analysis)
- [Secure Development Practices](#secure-development-practices)
- [Security Configuration](#security-configuration)
- [Audit & Compliance](#audit--compliance)

## 🏗️ Security Architecture

### Multi-Layer Security Model

MOIDVK implements a defense-in-depth security architecture:

```
┌─────────────────────────────────────────┐
│           Application Layer             │
├─────────────────────────────────────────┤
│         Input Validation Layer          │
├─────────────────────────────────────────┤
│        Command Execution Layer          │
├─────────────────────────────────────────┤
│         File Access Layer               │
├─────────────────────────────────────────┤
│        Sandboxing Layer                 │
├─────────────────────────────────────────┤
│         System Layer                    │
└─────────────────────────────────────────┘
```

### Core Security Components

1. **Enhanced Secure Command Executor** - Validates and sandboxes command execution
2. **Input Validator** - Sanitizes and validates all inputs
3. **Trusted Tool Verifier** - Ensures tool integrity and authenticity
4. **Rate Limiter** - Prevents abuse and DoS attacks
5. **Error Handler** - Secure error handling without information leakage
6. **JPL Assertions** - NASA JPL Power of 10 safety rule enforcement

## 🔒 Security Levels

MOIDVK provides four security levels to balance security with development productivity:

### STRICT Mode

- **Use Case**: Production environments, critical systems
- **Features**: Maximum security, minimal permissions
- **Command Execution**: Highly restricted whitelist
- **File Access**: Minimal required paths only
- **Learning**: Disabled
- **Privacy**: Maximum data sanitization

```json
{
  "security": {
    "level": "STRICT",
    "features": {
      "enableLearning": false,
      "keepPrivate": true,
      "sanitizeOutput": true,
      "validateInputs": true,
      "auditLogging": true
    }
  }
}
```

### BALANCED Mode

- **Use Case**: Team development, shared environments
- **Features**: Good security with reasonable flexibility
- **Command Execution**: Curated whitelist with common tools
- **File Access**: Project-scoped access
- **Learning**: Limited with explicit consent
- **Privacy**: Standard data sanitization

```json
{
  "security": {
    "level": "BALANCED",
    "features": {
      "enableLearning": true,
      "keepPrivate": true,
      "sanitizeOutput": true,
      "validateInputs": true
    }
  }
}
```

### DEVELOPMENT Mode (Default)

- **Use Case**: Individual development, local environments
- **Features**: Security with development convenience
- **Command Execution**: Extended whitelist for dev tools
- **File Access**: Workspace-scoped access
- **Learning**: Enabled with consent prompts
- **Privacy**: Selective data sanitization

```json
{
  "security": {
    "level": "DEVELOPMENT",
    "features": {
      "enableLearning": true,
      "keepPrivate": true,
      "sanitizeOutput": false,
      "validateInputs": true
    }
  }
}
```

### PERMISSIVE Mode

- **Use Case**: Testing, experimentation, trusted environments
- **Features**: Minimal restrictions for maximum flexibility
- **Command Execution**: Broad command access
- **File Access**: Extended file system access
- **Learning**: Fully enabled
- **Privacy**: Minimal sanitization

```json
{
  "security": {
    "level": "PERMISSIVE",
    "features": {
      "enableLearning": true,
      "keepPrivate": false,
      "sanitizeOutput": false,
      "validateInputs": false
    }
  }
}
```

## ⚡ Command Execution Security

### Secure Command Executor

MOIDVK's Enhanced Secure Command Executor provides multiple layers of protection:

#### Command Validation

```javascript
// Example of command validation process
const secureExecutor = new EnhancedSecureCommandExecutor({
  securityLevel: 'DEVELOPMENT',
  enableLearning: true,
  keepPrivate: true,
});

// Commands are validated against:
// 1. Whitelist/blacklist
// 2. Argument sanitization
// 3. Path traversal prevention
// 4. Injection attack prevention
```

#### Whitelisted Commands by Security Level

**STRICT Mode:**

```json
{
  "allowedCommands": ["node", "npm", "git", "echo", "cat", "ls", "pwd"]
}
```

**DEVELOPMENT Mode:**

```json
{
  "allowedCommands": [
    "node",
    "npm",
    "yarn",
    "pnpm",
    "bun",
    "git",
    "cargo",
    "rustc",
    "python",
    "pip",
    "echo",
    "cat",
    "ls",
    "pwd",
    "find",
    "grep",
    "curl",
    "wget",
    "docker",
    "kubectl"
  ]
}
```

#### Command Learning System

MOIDVK can learn new commands with explicit user consent:

```bash
# When a new command is encountered
$ moidvk secure-bash "newcommand --flag"

🔍 Unknown command detected: newcommand
📋 Command: newcommand --flag
🛡️ Security Level: DEVELOPMENT

Would you like to:
1. Allow once
2. Allow and remember (add to whitelist)
3. Deny
4. Deny and block (add to blacklist)

Choice: 2

✅ Command learned and executed safely
```

### Sandboxing

Commands are executed in a controlled environment:

```json
{
  "sandbox": {
    "workingDirectory": "./",
    "allowedPaths": ["./src", "./tests", "./docs"],
    "deniedPaths": ["/etc", "/usr", "/var", "/root"],
    "environmentVariables": "filtered",
    "networkAccess": "restricted",
    "timeout": 60000
  }
}
```

## 📁 File Access Security

### Path Validation

All file operations are validated against security policies:

```javascript
// Path validation example
const validator = new SecurityValidator();

// Prevents path traversal attacks
validator.validatePath('../../../etc/passwd'); // ❌ Blocked
validator.validatePath('./src/app.js'); // ✅ Allowed
validator.validatePath('/tmp/malicious'); // ❌ Blocked
```

### File Access Policies

```json
{
  "fileAccess": {
    "allowedPaths": [
      "./src/**",
      "./tests/**",
      "./docs/**",
      "./package.json",
      "./tsconfig.json",
      "./.moidvk.json"
    ],
    "deniedPaths": ["/etc/**", "/usr/**", "/var/**", "/root/**", "~/.ssh/**", "~/.aws/**"],
    "maxFileSize": "10MB",
    "allowSymlinks": false,
    "allowHiddenFiles": false
  }
}
```

### File Content Sanitization

Sensitive content is automatically detected and sanitized:

```javascript
// Sensitive patterns automatically redacted
const sensitivePatterns = [
  /password\s*[:=]\s*["']?([^"'\s]+)/gi,
  /api[_-]?key\s*[:=]\s*["']?([^"'\s]+)/gi,
  /secret\s*[:=]\s*["']?([^"'\s]+)/gi,
  /token\s*[:=]\s*["']?([^"'\s]+)/gi,
  /private[_-]?key\s*[:=]\s*["']?([^"'\s]+)/gi,
];

// Example output sanitization
// Before: const apiKey = "sk-1234567890abcdef";
// After:  const apiKey = "[REDACTED]";
```

## 🔐 Data Privacy & Sanitization

### Privacy Modes

#### Standard Privacy Mode

```json
{
  "privacy": {
    "sanitizeSecrets": true,
    "sanitizePersonalInfo": true,
    "sanitizeFilePaths": false,
    "logLevel": "info"
  }
}
```

#### Enhanced Privacy Mode

```json
{
  "privacy": {
    "sanitizeSecrets": true,
    "sanitizePersonalInfo": true,
    "sanitizeFilePaths": true,
    "sanitizeContent": true,
    "anonymizeData": true,
    "logLevel": "error"
  }
}
```

### Data Sanitization Examples

```javascript
// Input sanitization
const input = `
const config = {
  apiKey: "sk-1234567890abcdef",
  password: "mySecretPassword123",
  email: "user@company.com",
  filePath: "/home/user/project/src/app.js"
};
`;

// Sanitized output (Enhanced Privacy Mode)
const sanitized = `
const config = {
  apiKey: "[REDACTED]",
  password: "[REDACTED]",
  email: "[EMAIL_REDACTED]",
  filePath: "[PATH_REDACTED]/app.js"
};
`;
```

### Consent Management

MOIDVK implements explicit consent for data sharing:

```bash
# Snippet extraction with consent
$ moidvk extract-snippet --file src/app.js --lines 10-20

🔒 Data Sharing Request
📄 File: src/app.js (lines 10-20)
🔍 Content: 150 characters
🛡️ Privacy: Enhanced mode enabled

The following data will be processed:
- Code snippet (10 lines)
- File metadata
- No personal information detected

Do you consent to processing this data? [y/N]: y
✅ Consent granted, processing snippet...
```

## 🔍 Vulnerability Scanning

### Dependency Scanning

MOIDVK provides comprehensive dependency vulnerability scanning:

```bash
# Scan for security vulnerabilities
moidvk scan-security-vulnerabilities

# Filter by severity
moidvk scan-security-vulnerabilities --severity high

# Production dependencies only
moidvk scan-security-vulnerabilities --production

# Detailed report
moidvk scan-security-vulnerabilities --format detailed
```

### Vulnerability Database

MOIDVK uses multiple vulnerability databases:

- **NPM Audit** - Node.js package vulnerabilities
- **PyUp Safety** - Python package vulnerabilities
- **RustSec** - Rust crate vulnerabilities
- **GitHub Advisory** - Cross-platform vulnerabilities
- **CVE Database** - Common Vulnerabilities and Exposures

### Vulnerability Reporting

```json
{
  "vulnerability": {
    "id": "GHSA-xxxx-xxxx-xxxx",
    "package": "lodash",
    "version": "4.17.15",
    "severity": "high",
    "title": "Prototype Pollution",
    "description": "Lodash versions prior to 4.17.19 are vulnerable to...",
    "fixedIn": "4.17.19",
    "references": ["https://github.com/advisories/GHSA-xxxx-xxxx-xxxx"],
    "remediation": {
      "type": "update",
      "command": "npm update lodash"
    }
  }
}
```

## 🛡️ Code Safety Analysis

### NASA JPL Power of 10 Rules

MOIDVK enforces NASA JPL's Power of 10 safety-critical programming rules:

```bash
# Check safety rules
moidvk check-safety-rules --file src/critical.js

# Example violations detected:
# ❌ Rule 1: Avoid complex flow constructs (goto, setjmp, recursion)
# ❌ Rule 2: All loops must have fixed bounds
# ❌ Rule 3: Avoid heap memory allocation after initialization
# ❌ Rule 4: Restrict functions to a single printed page
# ❌ Rule 5: Use a minimum of two runtime assertions per function
```

### Safety Rule Examples

#### Rule 1: Avoid Complex Flow Constructs

```javascript
// ❌ Unsafe: Unbounded recursion
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

// ✅ Safe: Iterative approach with bounds
function factorial(n) {
  if (n < 0 || n > 20) throw new Error('Invalid input');
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
```

#### Rule 2: Fixed Loop Bounds

```javascript
// ❌ Unsafe: Unbounded loop
while (condition) {
  // potentially infinite loop
}

// ✅ Safe: Bounded loop
for (let i = 0; i < MAX_ITERATIONS && condition; i++) {
  // bounded iteration
}
```

#### Rule 5: Runtime Assertions

```javascript
// ✅ Safe: Function with assertions
function divide(a, b) {
  assert(typeof a === 'number', 'First argument must be number');
  assert(typeof b === 'number', 'Second argument must be number');
  assert(b !== 0, 'Division by zero not allowed');

  const result = a / b;

  assert(isFinite(result), 'Result must be finite');
  return result;
}
```

### Language-Specific Safety

#### Rust Safety Analysis

```bash
# Rust memory safety check
moidvk rust-safety-checker --file src/lib.rs

# Checks for:
# - Unsafe blocks
# - Memory leaks
# - Data races
# - Buffer overflows
# - Use after free
```

#### Python Security Analysis

```bash
# Python security scan
moidvk python-security-scanner --file src/app.py

# Checks for:
# - SQL injection vulnerabilities
# - Command injection
# - Hardcoded secrets
# - Insecure random number generation
# - Unsafe deserialization
```

## 🔧 Secure Development Practices

### Secure Coding Guidelines

#### Input Validation

```javascript
// Always validate inputs
function processUserInput(input) {
  // Validate type
  if (typeof input !== 'string') {
    throw new Error('Input must be string');
  }

  // Validate length
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error('Input too long');
  }

  // Sanitize content
  const sanitized = input.replace(/[<>'"&]/g, '');

  return sanitized;
}
```

#### Error Handling

```javascript
// Secure error handling
try {
  riskyOperation();
} catch (error) {
  // Log detailed error internally
  logger.error('Operation failed', { error, context });

  // Return generic error to user
  throw new Error('Operation failed');
}
```

#### Secret Management

```javascript
// ❌ Never hardcode secrets
const apiKey = 'sk-1234567890abcdef';

// ✅ Use environment variables
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable required');
}
```

### Security Testing

#### Automated Security Testing

```bash
# Comprehensive security test suite
moidvk security-test-suite

# Individual security tests
moidvk test-input-validation
moidvk test-command-injection
moidvk test-path-traversal
moidvk test-xss-prevention
```

#### Security Test Examples

```javascript
// Security test example
describe('Input Validation Security', () => {
  test('prevents path traversal attacks', () => {
    const maliciousPath = '../../../etc/passwd';
    expect(() => validatePath(maliciousPath)).toThrow();
  });

  test('sanitizes SQL injection attempts', () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const sanitized = sanitizeInput(maliciousInput);
    expect(sanitized).not.toContain('DROP TABLE');
  });
});
```

## ⚙️ Security Configuration

### Security Policy Configuration

```json
{
  "security": {
    "level": "DEVELOPMENT",
    "policies": {
      "commandExecution": {
        "allowList": ["npm", "node", "git"],
        "denyList": ["rm", "sudo", "chmod"],
        "requireConfirmation": ["curl", "wget"],
        "timeout": 60000,
        "maxConcurrent": 3
      },

      "fileAccess": {
        "allowedExtensions": [".js", ".ts", ".json", ".md"],
        "deniedExtensions": [".exe", ".bat", ".sh"],
        "maxFileSize": "10MB",
        "scanForMalware": true
      },

      "dataHandling": {
        "sanitizeSecrets": true,
        "sanitizePersonalInfo": true,
        "encryptAtRest": false,
        "encryptInTransit": true
      }
    }
  }
}
```

### Rate Limiting Configuration

```json
{
  "rateLimiting": {
    "enabled": true,
    "global": {
      "maxRequests": 100,
      "windowMs": 60000,
      "skipSuccessfulRequests": false
    },
    "perTool": {
      "scan_security_vulnerabilities": {
        "maxRequests": 10,
        "windowMs": 300000
      },
      "secure_bash": {
        "maxRequests": 50,
        "windowMs": 60000
      }
    }
  }
}
```

### Audit Configuration

```json
{
  "audit": {
    "enabled": true,
    "logLevel": "info",
    "logFile": "security-audit.log",
    "events": ["command_execution", "file_access", "security_violation", "configuration_change"],
    "retention": "90d",
    "encryption": true
  }
}
```

## 📊 Audit & Compliance

### Security Audit Logging

MOIDVK maintains comprehensive audit logs:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "command_execution",
  "user": "developer",
  "command": "npm install",
  "securityLevel": "DEVELOPMENT",
  "result": "success",
  "duration": 5432,
  "metadata": {
    "workingDirectory": "/project",
    "arguments": ["install"],
    "exitCode": 0
  }
}
```

### Compliance Reports

```bash
# Generate compliance report
moidvk audit-report --format compliance

# SOX compliance report
moidvk audit-report --standard sox

# GDPR compliance report
moidvk audit-report --standard gdpr

# Custom compliance report
moidvk audit-report --config compliance-config.json
```

### Security Metrics

```json
{
  "securityMetrics": {
    "period": "30d",
    "commandExecutions": {
      "total": 1250,
      "blocked": 15,
      "learned": 8
    },
    "fileAccess": {
      "total": 3420,
      "blocked": 23,
      "sanitized": 156
    },
    "vulnerabilities": {
      "detected": 12,
      "fixed": 10,
      "remaining": 2
    },
    "securityScore": 94
  }
}
```

### Incident Response

```bash
# Security incident detection
moidvk security-monitor --real-time

# Incident response
moidvk incident-response --type security_breach

# Forensic analysis
moidvk forensic-analysis --timeframe "2024-01-15T09:00:00Z/2024-01-15T11:00:00Z"
```

## 🚨 Security Best Practices

### Development Environment

1. **Use appropriate security level** for your environment
2. **Regularly update dependencies** to patch vulnerabilities
3. **Enable audit logging** for compliance and monitoring
4. **Review and approve** new commands before adding to whitelist
5. **Sanitize sensitive data** before sharing or logging
6. **Use environment variables** for secrets and configuration
7. **Implement proper error handling** to prevent information leakage

### Production Environment

1. **Use STRICT security level** for production deployments
2. **Disable learning features** in production
3. **Enable comprehensive audit logging**
4. **Implement network security** controls
5. **Regular security assessments** and penetration testing
6. **Monitor for security incidents** in real-time
7. **Maintain incident response procedures**

### Team Environment

1. **Establish security policies** and guidelines
2. **Train team members** on secure coding practices
3. **Implement code review** processes with security focus
4. **Use BALANCED security level** for shared environments
5. **Regular security training** and awareness programs
6. **Automated security testing** in CI/CD pipelines

## 🔧 Security Troubleshooting

### Common Security Issues

#### Command Blocked

```bash
# Issue: Command not in whitelist
$ moidvk secure-bash "newcommand"
❌ Command 'newcommand' not allowed in DEVELOPMENT mode

# Solution: Add to whitelist or use learning mode
$ moidvk config set security.commandExecution.allowList.+ "newcommand"
```

#### File Access Denied

```bash
# Issue: File outside allowed paths
$ moidvk read-file "/etc/passwd"
❌ File access denied: /etc/passwd

# Solution: Check file access policies
$ moidvk config show security.fileAccess
```

#### Rate Limit Exceeded

```bash
# Issue: Too many requests
❌ Rate limit exceeded for tool 'scan_security_vulnerabilities'

# Solution: Wait or adjust rate limits
$ moidvk config set rateLimiting.perTool.scan_security_vulnerabilities.maxRequests 20
```

### Security Debugging

```bash
# Enable security debugging
export MOIDVK_SECURITY_DEBUG=true

# View security events
moidvk security-events --tail

# Test security policies
moidvk security-test --policy command_execution
```

## 📚 Additional Resources

- **[Configuration Guide](configuration.md)** - Security configuration options
- **[Tool Reference](tool-reference.md)** - Security tool documentation
- **[Troubleshooting](../user-guide/troubleshooting.md)** - Common security issues
- **[Workflow Examples](../user-guide/workflow-examples.md)** - Secure development workflows

### External Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NASA JPL Power of 10](https://en.wikipedia.org/wiki/The_Power_of_10:_Rules_for_Developing_Safety-Critical_Code)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls/)

---

**Security Notice:** Always keep MOIDVK updated to the latest version to ensure you have the latest
security patches and improvements. Report security issues to our security team through responsible
disclosure channels.
