# Security Guide

This comprehensive guide covers MOIDVK's security architecture, privacy protections, explicit consent system, and security best practices.

## 🎯 Security Overview

MOIDVK implements a multi-layered security model that prioritizes privacy, data protection, and secure operations. The security model is built around the principle of "privacy-first" development tools with explicit consent for all sensitive operations.

## 🏗️ Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Explicit Consent & Authorization                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Input Validation & Sanitization                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Path Security & Workspace Isolation                │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Privacy Protection & Data Handling                 │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Network Security & Communication                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Monitoring & Audit Trail                           │
└─────────────────────────────────────────────────────────────┘
```

### Security Principles

1. **Privacy-First**: All operations prioritize user privacy
2. **Explicit Consent**: No sensitive operations without user approval
3. **Data Minimization**: Only process necessary data
4. **Local Processing**: Keep data on user's device when possible
5. **Transparency**: Clear visibility into all operations
6. **Defense in Depth**: Multiple security layers

## 🔐 Explicit Consent System

### Consent Levels

MOIDVK implements a graduated consent system:

#### Level 1: Basic Operations (Always Allowed)
- Code quality checking
- Code formatting
- Basic file operations (read-only)
- Safe commands: `ls`, `find`, `grep`, `cat`, `head`, `tail`

#### Level 2: Moderate Risk (Require Consent)
- Security vulnerability scanning
- Production readiness analysis
- Project modification commands: `npm`, `yarn`, `bun`, `git`, `docker`

#### Level 3: High Risk (Require Explicit Consent)
- File deletion (`rm`)
- Network requests (`curl`, `wget`)
- Permission changes (`chmod`)
- Directory operations

#### Level 4: Extreme Risk (Never Allowed)
- Privilege escalation (`sudo`, `su`)
- System operations (`dd`, `fdisk`, `mount`)
- Remote access (`ssh`, `scp`)
- Arbitrary code execution (`eval`, `python`)

### Command Security Categories

#### ALWAYS_ALLOW (Safe Commands)
```bash
ls, find, grep, cat, head, tail, wc, sort, uniq, cut, diff
```
- Read-only operations with no side effects
- No consent required

#### REQUIRE_CONSENT (Moderate Risk)
```bash
npm, yarn, bun, git, docker, make, cmake, tsc, webpack
```
- Commands that modify the project but are generally safe
- Basic consent required

#### REQUIRE_EXPLICIT_CONSENT (High Risk)
```bash
rm -rf ./directory    # File deletion with validation
curl https://api.com  # Network requests with whitelist
chmod 755 file.js     # Permission changes with validation
```
- High-risk operations that may be necessary
- Explicit consent with audit trail required

#### NEVER_ALLOW (Extreme Risk)
```bash
sudo, su              # Privilege escalation
chown                 # Ownership changes
ssh, scp, nc, telnet  # Remote access
dd, fdisk, mkfs, mount # System operations
eval, python, ruby, perl # Arbitrary code execution
```
- Never allowed under any circumstances

### Enhanced Validation for Explicit Consent Commands

#### `rm` Command Validation
```javascript
// Blocked paths
const blockedPaths = [
  '/', '/etc', '/usr', '/bin', '/sbin', '/var', '/opt',
  '/home', '/root', '/proc', '/sys', '/dev'
];

// Validation logic
function validateRmCommand(args) {
  const paths = args.filter(arg => !arg.startsWith('-'));
  
  for (const path of paths) {
    // Check for blocked system directories
    if (blockedPaths.some(blocked => path.startsWith(blocked))) {
      throw new SecurityError('Access to system directories blocked');
    }
    
    // Check for recursive force deletion
    if (args.includes('-rf') || args.includes('-fr')) {
      console.warn('⚠️  WARNING: Recursive force deletion detected');
    }
  }
}
```

#### `curl`/`wget` Command Validation
```javascript
// Allowed domains (configurable)
const allowedDomains = [
  'github.com', 'githubusercontent.com',
  'npmjs.org', 'registry.npmjs.org',
  'nodejs.org', 'deno.land',
  'unpkg.com', 'cdn.jsdelivr.net'
];

function validateNetworkRequest(url) {
  const domain = new URL(url).hostname;
  
  if (!allowedDomains.includes(domain)) {
    throw new SecurityError(`Domain ${domain} not in allowed list`);
  }
  
  if (!url.startsWith('https://')) {
    console.warn('⚠️  WARNING: HTTP connection detected (HTTPS recommended)');
  }
}
```

#### `chmod` Command Validation
```javascript
function validateChmodCommand(args) {
  const permissions = args.find(arg => /^[0-7]{3,4}$/.test(arg));
  
  if (permissions) {
    // Check for world-writable permissions
    if (permissions.includes('7') || permissions.includes('6')) {
      console.warn('⚠️  WARNING: World-writable permissions detected');
      console.warn('💡 RECOMMENDATION: Use restrictive permissions (755, 644)');
    }
  }
}
```

### Consent Flow Implementation

When a command requires explicit consent:

```javascript
// Consent request generation
function generateConsentRequest(command, args, risks) {
  const auditId = generateAuditId();
  
  return {
    auditId: auditId,
    command: command,
    args: args,
    risks: risks,
    timestamp: new Date().toISOString(),
    recommendations: generateRecommendations(command, args)
  };
}

// Example consent request
const consentRequest = {
  auditId: 'AUDIT-1234567890-ABC123DEF',
  command: 'rm',
  args: ['-rf', './old-build'],
  risks: [
    'Recursive force deletion can permanently destroy data',
    'No confirmation prompt for file deletion'
  ],
  recommendations: [
    'Consider using trash/recycle bin instead',
    'Verify directory contents before deletion'
  ],
  timestamp: '2024-01-15T10:30:00.000Z'
};
```

### Consent Request Display

```
🚨 EXPLICIT CONSENT REQUIRED 🚨

Command: rm -rf ./old-build
Audit ID: AUDIT-1234567890-ABC123DEF

⚠️  RISKS:
  • Recursive force deletion can permanently destroy data
  • No confirmation prompt for file deletion

💡 RECOMMENDATIONS:
  • Consider using trash/recycle bin instead
  • Verify directory contents before deletion

To proceed, you must explicitly confirm this operation with audit ID: AUDIT-1234567890-ABC123DEF
```

## 🛡️ Privacy Protections

### Data Handling Principles

1. **Local Processing**: All code analysis happens locally
2. **No Data Transmission**: Code never leaves your device
3. **Temporary Storage**: Data is stored temporarily and securely
4. **Automatic Cleanup**: Sensitive data is automatically removed

### Sensitive Data Detection

MOIDVK automatically detects and protects sensitive data:

```javascript
// Sensitive data patterns
const sensitivePatterns = [
  /sk-[a-zA-Z0-9]{32,}/,                    // API keys
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
  /password\s*[:=]\s*['"][^'"]+['"]/,       // Passwords
  /token\s*[:=]\s*['"][^'"]+['"]/,          // Tokens
  /secret\s*[:=]\s*['"][^'"]+['"]/,         // Secrets
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit cards
  /private_key\s*[:=]\s*['"][^'"]+['"]/,    // Private keys
  /ssh-rsa\s+[A-Za-z0-9+/]+[=]{0,3}\s+[^@]+@[^@]+/, // SSH keys
];

function sanitizeSensitiveData(content) {
  let sanitized = content;
  
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
}
```

### Embedding Privacy

Local AI embeddings ensure privacy:

```javascript
// Local embedding configuration
const embeddingConfig = {
  model: 'all-mpnet-base-v2',
  cacheDir: '/opt/moidvk/cache/embeddings',
  privacy: {
    localOnly: true,
    noTransmission: true,
    automaticCleanup: true,
    encryption: true
  }
};

// Generate embeddings locally
async function generateEmbeddings(text) {
  const sanitizedText = sanitizeSensitiveData(text);
  const embeddings = await localModel.embed(sanitizedText);
  
  // Store with encryption
  const encryptedEmbeddings = encrypt(embeddings);
  await storeEmbeddings(encryptedEmbeddings);
  
  return embeddings;
}
```

## 🔒 Path Security

### Workspace Isolation

MOIDVK enforces strict workspace boundaries:

```javascript
// Workspace security configuration
const workspaceConfig = {
  root: process.env.WORKSPACE_ROOT || '/workspace',
  allowedPaths: [
    '/workspace/**',
    '/tmp/moidvk/**'
  ],
  blockedPaths: [
    '/etc/**',
    '/var/**',
    '/root/**',
    '/home/**',
    '/proc/**',
    '/sys/**',
    '/dev/**',
    '/boot/**'
  ],
  maxDepth: 10,
  maxFileSize: 10 * 1024 * 1024 // 10MB
};

function validatePath(path) {
  const resolvedPath = path.resolve(path);
  
  // Check if path is within workspace
  if (!resolvedPath.startsWith(workspaceConfig.root)) {
    throw new SecurityError('Path outside workspace boundary');
  }
  
  // Check for blocked patterns
  for (const blocked of workspaceConfig.blockedPaths) {
    if (minimatch(resolvedPath, blocked)) {
      throw new SecurityError('Access to blocked path');
    }
  }
  
  return resolvedPath;
}
```

### Path Traversal Protection

```javascript
// Path traversal protection
function sanitizePath(inputPath) {
  // Remove path traversal attempts
  let sanitized = inputPath
    .replace(/\.\./g, '')           // Remove ..
    .replace(/\/\//g, '/')          // Normalize slashes
    .replace(/^\/+/, '')            // Remove leading slashes
    .replace(/\/+$/, '');           // Remove trailing slashes
  
  // Validate final path
  if (sanitized.includes('..') || sanitized.includes('//')) {
    throw new SecurityError('Invalid path detected');
  }
  
  return sanitized;
}
```

### File Access Controls

```javascript
// File access control
const fileAccessConfig = {
  allowedExtensions: [
    '.js', '.ts', '.jsx', '.tsx',
    '.json', '.md', '.txt', '.html',
    '.css', '.scss', '.graphql', '.yml', '.yaml'
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  blockedPatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/*.env*',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/.DS_Store',
    '**/Thumbs.db'
  ]
};

function validateFileAccess(filePath) {
  const ext = path.extname(filePath);
  
  // Check file extension
  if (!fileAccessConfig.allowedExtensions.includes(ext)) {
    throw new SecurityError('File type not allowed');
  }
  
  // Check file size
  const stats = fs.statSync(filePath);
  if (stats.size > fileAccessConfig.maxFileSize) {
    throw new SecurityError('File too large');
  }
  
  // Check blocked patterns
  for (const pattern of fileAccessConfig.blockedPatterns) {
    if (minimatch(filePath, pattern)) {
      throw new SecurityError('Access to blocked file');
    }
  }
}
```

## 🔍 Security Monitoring

### Audit Trail

MOIDVK maintains comprehensive audit logs:

```javascript
// Audit logging
const auditLogger = {
  log: function(operation, user, details) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation: operation,
      user: user,
      details: details,
      ip: getClientIP(),
      userAgent: getUserAgent(),
      sessionId: getSessionId(),
      consentLevel: details.consentLevel || 0
    };
    
    // Log to secure audit file
    fs.appendFileSync('/opt/moidvk/logs/audit.log', 
      JSON.stringify(auditEntry) + '\n');
  }
};

// Usage examples
auditLogger.log('file_read', 'user123', {
  filePath: '/workspace/src/app.js',
  fileSize: 1024,
  consentLevel: 1
});

auditLogger.log('file_delete', 'user123', {
  filePath: '/workspace/temp.js',
  auditId: 'AUDIT-1234567890-ABC123DEF',
  consentLevel: 3
});
```

### Security Events

```javascript
// Security event monitoring
const securityEvents = {
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  PATH_TRAVERSAL: 'path_traversal',
  SENSITIVE_DATA_EXPOSURE: 'sensitive_data_exposure',
  CONSENT_VIOLATION: 'consent_violation',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  EXPLICIT_CONSENT_REQUIRED: 'explicit_consent_required'
};

function monitorSecurityEvent(event, details) {
  const securityAlert = {
    event: event,
    timestamp: new Date().toISOString(),
    details: details,
    severity: getEventSeverity(event),
    action: getRecommendedAction(event)
  };
  
  // Log security event
  fs.appendFileSync('/opt/moidvk/logs/security.log', 
    JSON.stringify(securityAlert) + '\n');
  
  // Trigger alerts for high-severity events
  if (securityAlert.severity === 'high') {
    sendSecurityAlert(securityAlert);
  }
}
```

### Rate Limiting

```javascript
// Rate limiting implementation
const rateLimiter = {
  limits: {
    requests_per_minute: 100,
    requests_per_hour: 1000,
    file_operations_per_minute: 50,
    explicit_consent_requests_per_hour: 10
  },
  
  checkLimit: function(user, operation) {
    const key = `${user}:${operation}`;
    const current = getCurrentCount(key);
    const limit = this.limits[operation] || this.limits.requests_per_minute;
    
    if (current >= limit) {
      monitorSecurityEvent('RATE_LIMIT_EXCEEDED', {
        user: user,
        operation: operation,
        limit: limit
      });
      throw new SecurityError('Rate limit exceeded');
    }
    
    incrementCount(key);
  }
};
```

## 🔧 Security Configuration

### Environment Variables

```bash
# Security environment variables
SECURITY_LEVEL=strict                    # strict, balanced, permissive
EXPLICIT_CONSENT=true                    # Require explicit consent
MCP_SECURITY_MODE=block                 # block, monitor
ALLOWED_ORIGINS=https://your-domain.com  # CORS origins
MAX_FILE_SIZE=10485760                   # 10MB file size limit
TIMEOUT=30000                           # 30 second timeout
RATE_LIMIT_REQUESTS_PER_MINUTE=100      # Rate limiting
ENABLE_AUDIT_LOGGING=true               # Audit trail
SENSITIVE_DATA_DETECTION=true           # Auto-detect sensitive data
```

### Configuration File

```json
{
  "security": {
    "level": "strict",
    "explicit_consent": true,
    "mcp_security_mode": "block",
    "allowed_origins": ["https://your-domain.com"],
    "rate_limiting": {
      "enabled": true,
      "requests_per_minute": 100,
      "requests_per_hour": 1000,
      "explicit_consent_requests_per_hour": 10
    },
    "file_access": {
      "max_size": 10485760,
      "allowed_extensions": [".js", ".ts", ".jsx", ".tsx", ".json"],
      "blocked_patterns": ["**/node_modules/**", "**/.git/**"]
    },
    "network": {
      "allowed_domains": [
        "github.com", "githubusercontent.com",
        "npmjs.org", "registry.npmjs.org"
      ],
      "require_https": true
    },
    "privacy": {
      "local_processing": true,
      "sensitive_data_detection": true,
      "automatic_cleanup": true
    },
    "monitoring": {
      "audit_logging": true,
      "security_alerts": true,
      "rate_limit_monitoring": true
    }
  }
}
```

### Security Levels

#### Permissive Level
- Basic validation only
- Minimal consent requirements
- Limited monitoring
- Suitable for development

#### Balanced Level (Default)
- Standard security measures
- Explicit consent for sensitive operations
- Comprehensive monitoring
- Suitable for most environments

#### Strict Level
- Maximum security measures
- Explicit consent for all operations
- Full audit trail
- Suitable for production

## 🚨 Emergency Procedures

### Security Incident Response

#### Incident Classification

1. **Low Severity**: Minor policy violations
2. **Medium Severity**: Unauthorized access attempts
3. **High Severity**: Data breaches, system compromise
4. **Critical Severity**: Active attacks, data exfiltration

#### Response Procedures

```bash
#!/bin/bash
# Emergency security response script

INCIDENT_LEVEL=$1
INCIDENT_DETAILS=$2

case $INCIDENT_LEVEL in
  "low")
    echo "Low severity incident: $INCIDENT_DETAILS"
    # Log incident
    # Monitor for escalation
    ;;
  "medium")
    echo "Medium severity incident: $INCIDENT_DETAILS"
    # Log incident
    # Notify security team
    # Review access logs
    ;;
  "high")
    echo "High severity incident: $INCIDENT_DETAILS"
    # Stop service
    sudo systemctl stop moidvk
    # Isolate system
    # Notify emergency contacts
    # Begin incident investigation
    ;;
  "critical")
    echo "Critical severity incident: $INCIDENT_DETAILS"
    # Immediate service shutdown
    sudo systemctl stop moidvk
    # Network isolation
    # Emergency contact notification
    # Incident response team activation
    ;;
esac
```

### Data Breach Response

```bash
#!/bin/bash
# Data breach response script

echo "Data breach detected at $(date)"

# 1. Immediate containment
sudo systemctl stop moidvk
sudo ufw deny 3000

# 2. Preserve evidence
sudo cp -r /opt/moidvk/logs /opt/moidvk/logs-backup-$(date +%Y%m%d_%H%M%S)
sudo cp -r /opt/moidvk/cache /opt/moidvk/cache-backup-$(date +%Y%m%d_%H%M%S)

# 3. Assess scope
echo "Assessing breach scope..."
grep -i "error\|warning\|unauthorized" /opt/moidvk/logs/*.log

# 4. Notify stakeholders
echo "Notifying security team..."
# Add notification commands

# 5. Begin recovery
echo "Beginning recovery procedures..."
# Add recovery commands
```

## 📋 Security Checklist

### Pre-Deployment Security

- [ ] Security level configured appropriately
- [ ] Explicit consent enabled
- [ ] Rate limiting configured
- [ ] File access controls set
- [ ] Audit logging enabled
- [ ] Sensitive data detection active
- [ ] Emergency procedures documented
- [ ] Security team contacts configured

### Ongoing Security

- [ ] Regular security audits
- [ ] Monitor security logs
- [ ] Update security configurations
- [ ] Review access patterns
- [ ] Test incident response procedures
- [ ] Update security documentation
- [ ] Conduct security training

### Incident Response

- [ ] Incident classification procedures
- [ ] Emergency contact list
- [ ] Response team roles defined
- [ ] Communication procedures
- [ ] Evidence preservation procedures
- [ ] Recovery procedures
- [ ] Post-incident review process

## 🔒 Compliance

### GDPR Compliance

MOIDVK is designed with GDPR compliance in mind:

- **Data Minimization**: Only processes necessary data
- **Local Processing**: Data stays on user's device
- **Explicit Consent**: Clear consent mechanisms
- **Right to Erasure**: Automatic data cleanup
- **Data Portability**: Export capabilities
- **Privacy by Design**: Built-in privacy protections

### SOC 2 Compliance

Security controls for SOC 2 compliance:

- **Access Control**: Strict access management
- **Audit Logging**: Comprehensive audit trails
- **Data Protection**: Encryption and privacy controls
- **Incident Response**: Documented procedures
- **Change Management**: Controlled updates
- **Monitoring**: Continuous security monitoring

### ISO 27001 Alignment

Security management system alignment:

- **Risk Assessment**: Regular security assessments
- **Security Policies**: Documented security policies
- **Access Control**: Comprehensive access management
- **Incident Management**: Structured incident response
- **Business Continuity**: Recovery procedures
- **Compliance Monitoring**: Regular compliance checks

## 📞 Security Support

### Security Contacts

- **Security Team**: security@moidvk.com
- **Emergency Contact**: emergency@moidvk.com
- **Bug Bounty**: security@moidvk.com
- **Compliance**: compliance@moidvk.com

### Security Reporting

To report security issues:

1. **Email**: security@moidvk.com
2. **Encrypted**: Use PGP key for sensitive reports
3. **Response Time**: 24 hours for initial response
4. **Disclosure**: Coordinated disclosure policy

### Security Updates

- **Security Patches**: Released as needed
- **Security Advisories**: Published for vulnerabilities
- **Update Notifications**: Automatic security updates
- **Compliance Updates**: Regular compliance reviews

## 🛡️ Security Best Practices

### For Users

1. **Review Consent Requests**: Always review consent requests carefully
2. **Verify Commands**: Ensure commands match your intention
3. **Use Safer Alternatives**: Choose safer options when available
4. **Keep Audit Logs**: Maintain logs for compliance
5. **Regular Reviews**: Periodically review allowed domains list

### For Administrators

1. **Configure Security Levels**: Set appropriate security levels
2. **Monitor Logs**: Regularly review security and audit logs
3. **Update Configurations**: Keep security configurations current
4. **Train Users**: Provide security training for users
5. **Test Procedures**: Regularly test incident response procedures

### For Developers

1. **Follow Security Guidelines**: Adhere to security coding practices
2. **Use Security Tools**: Leverage MOIDVK security tools
3. **Report Issues**: Report security vulnerabilities promptly
4. **Stay Updated**: Keep up with security updates
5. **Code Reviews**: Include security in code reviews

---

**Security Guide Complete!** 🛡️ MOIDVK's comprehensive security model ensures your code and data remain protected while providing powerful development tools. For security questions or incidents, contact the security team immediately.