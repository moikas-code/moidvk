# Enhanced Security Model for MOIDVK

## Overview

The enhanced security model addresses the core issue you identified: why `secure_bash` couldn't run development tools like `bun`, `npm`, or `node` while Claude Code's regular `Bash` tool could.

## The Problem

**Original Implementation:**
- ❌ Hardcoded whitelist of only basic file system tools
- ❌ No support for development tools (bun, npm, node)
- ❌ All-or-nothing security approach
- ❌ No learning or adaptation capability
- ❌ Forces fallback to regular Bash (privacy risk)

**Result:** Users had to choose between security (limited tools) or functionality (privacy risk).

## The Solution: Adaptive Security

### 🎯 **Core Principles**

1. **Privacy-First**: All output is sanitized, paths are normalized, sensitive data is redacted
2. **Development-Friendly**: Supports all common development tools out of the box
3. **Adaptive Learning**: Learns and remembers user-approved commands
4. **Gradual Trust**: Builds a personalized whitelist over time
5. **Transparent Security**: Clear explanations for all security decisions

### 🔧 **Security Levels**

#### **DEVELOPMENT** (Recommended)
- ✅ **Full development tool support**
- ✅ **Privacy protection active**
- ✅ **Dynamic learning enabled**
- ✅ **User consent for new commands**
- ✅ **Output sanitization**

#### **BALANCED** (Standard)
- ✅ **Common tools + utilities**
- ✅ **Privacy protection active**
- ❌ **Limited development tools**
- ❌ **No learning system**

#### **STRICT** (High Security)
- ✅ **Minimal file system tools only**
- ✅ **Maximum privacy protection**
- ✅ **Requires consent for everything**
- ❌ **No development tools**

#### **PERMISSIVE** (Low Security)
- ✅ **All commands allowed**
- ❌ **Minimal privacy protection**
- ❌ **No consent required**
- ⚠️ **Use with caution**

### 📦 **Supported Command Categories**

#### **PACKAGE_MANAGERS**
- `bun` - install, run, test, build, start, lint, audit
- `npm` - install, run, test, build, start, lint, audit
- `yarn` - install, run, test, build, start, lint, audit
- `pnpm` - install, run, test, build, start, lint, audit
- `deno` - run, test, lint, fmt, cache, info

#### **RUNTIMES**
- `node` - version, eval, print
- `bun` - version, eval, print
- `python` - version, execute
- `python3` - version, execute

#### **TESTING**
- `jest` - version, config, run
- `vitest` - version, config, run
- `mocha` - version, config
- `playwright` - version, test
- `cypress` - version, test

#### **LINTING**
- `eslint` - version, fix, config
- `prettier` - version, write, check
- `tsc` - version, noEmit, project
- `ruff` - version, check, format

#### **BUILD_TOOLS**
- `webpack` - version, config
- `vite` - version, build, dev
- `rollup` - version, config
- `esbuild` - version, bundle

#### **FILESYSTEM**
- `grep`, `find`, `ls`, `cat`, `head`, `tail`, `wc`, `sort`, `uniq`

#### **UTILITIES**
- `echo`, `pwd`, `which`, `whoami`, `date`, `du`, `df`

#### **GIT**
- `git` - status, log, diff, branch, show (safe read-only operations)

### 🎓 **Dynamic Learning System**

#### **How It Works**
1. **New Command Detected** → User gets consent request
2. **User Approves** → Command is learned and remembered
3. **Future Uses** → No consent needed (for 24 hours)
4. **Personalized Whitelist** → Builds over time based on your workflow

#### **Storage**
- Commands are stored in `.moidvk-learned-commands.json`
- User consents are stored in memory (expire after 24 hours)
- Learning can be reset anytime for security

#### **Benefits**
- ✅ **Faster workflow** - Approved commands don't need re-approval
- ✅ **Personalized security** - Learns your specific development needs
- ✅ **Maintains privacy** - All output is still sanitized
- ✅ **Transparent** - You always know what's been learned

### 🔒 **Privacy Protection**

#### **Output Sanitization**
- **Absolute paths** → Converted to relative paths
- **API keys/tokens** → Replaced with `[REDACTED]`
- **Database URLs** → Replaced with `[REDACTED]`
- **Personal data** → Emails, SSNs, credit cards filtered
- **Private keys** → JWT tokens, SSH keys, AWS keys filtered

#### **Content Filtering**
- **Sensitive patterns** automatically detected and removed
- **User directory paths** replaced with generic placeholders
- **Credentials** in environment variables filtered
- **Authentication tokens** in config files redacted

#### **Privacy Levels**
- **keepPrivate: true** (default) - Maximum privacy protection
- **keepPrivate: false** - Minimal filtering for debugging

### 🛡️ **Security Features**

#### **Workspace Restrictions**
- All commands are restricted to the current workspace
- No access to system directories like `/etc`, `/home`, `/root`
- Blocked paths include `.env`, `.ssh`, `.aws`, etc.

#### **Command Validation**
- All commands must be in allowed categories or learned
- Arguments are validated against known safe patterns
- Suspicious operations require explicit confirmation

#### **Audit Logging**
- All command executions are logged
- Success/failure rates tracked
- Learning statistics maintained
- Audit logs can be exported for review

### 🔧 **Usage Examples**

#### **Run a Build Command**
```json
{
  "command": "bun",
  "args": ["run", "build"],
  "securityLevel": "DEVELOPMENT"
}
```

#### **Install Dependencies (with confirmation)**
```json
{
  "command": "npm",
  "args": ["install"],
  "confirmed": true,
  "securityLevel": "DEVELOPMENT"
}
```

#### **Run Tests with Maximum Privacy**
```json
{
  "command": "jest",
  "args": ["--passWithNoTests"],
  "securityLevel": "DEVELOPMENT",
  "keepPrivate": true
}
```

#### **Learn a New Command**
```json
{
  "command": "custom-build-tool",
  "args": ["--version"],
  "confirmed": true,
  "enableLearning": true
}
```

### 📊 **Comparison: Before vs After**

| Feature | Original secure_bash | Enhanced secure_bash |
|---------|---------------------|---------------------|
| **Development Tools** | ❌ None | ✅ Full support |
| **Privacy Protection** | ✅ Basic | ✅ Advanced |
| **Learning System** | ❌ None | ✅ Dynamic |
| **User Experience** | ❌ Frustrating | ✅ Smooth |
| **Flexibility** | ❌ Rigid | ✅ Adaptive |
| **Transparency** | ❌ Opaque | ✅ Clear |

### 🎯 **Why This Solves Your Problem**

1. **No More Fallback to Regular Bash**
   - Development tools are supported natively
   - Privacy is maintained throughout
   - No need to compromise security for functionality

2. **Best of Both Worlds**
   - **Security**: All commands are validated and logged
   - **Privacy**: All output is sanitized and filtered
   - **Functionality**: Full development tool support
   - **Usability**: Learns your preferences over time

3. **Emulates Claude Code's Approach**
   - **Accepts commands over time**: ✅ Dynamic learning
   - **Builds allowlist**: ✅ Personalized whitelist
   - **But maintains privacy**: ✅ Output sanitization

### 🚀 **Migration Path**

1. **Immediate**: Use `securityLevel: "DEVELOPMENT"` for best experience
2. **Gradual**: Approve new commands as needed
3. **Optimize**: Review learned commands periodically
4. **Maintain**: Learning system keeps your workflow smooth

### 💡 **Best Practices**

1. **Start with DEVELOPMENT level** for coding projects
2. **Use `confirmed: true`** for new commands the first time
3. **Enable learning** to build your personalized whitelist
4. **Keep privacy protection active** with `keepPrivate: true`
5. **Review audit logs** periodically for security awareness

This enhanced security model gives you the development tool support you need while maintaining the privacy and security benefits that make MOIDVK valuable.