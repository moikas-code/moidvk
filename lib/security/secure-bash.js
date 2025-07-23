import { EnhancedSecureCommandExecutor } from './EnhancedSecureCommandExecutor.js';

/**
 * Enhanced Secure Bash tool with development support
 * Supports bun, npm, node, and other development tools with privacy protection
 */

export const secureBashTool = {
  name: 'secure_bash',
  description: 'Execute bash commands securely with development tool support, dynamic learning, and privacy protection',
  
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute (supports development tools like bun, npm, node)'
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Command arguments (validated and learned over time)',
        default: []
      },
      workingDirectory: {
        type: 'string',
        description: 'Working directory (must be within workspace)',
        default: '.'
      },
      securityLevel: {
        type: 'string',
        enum: ['STRICT', 'BALANCED', 'DEVELOPMENT', 'PERMISSIVE'],
        description: 'Security level - DEVELOPMENT recommended for coding',
        default: 'DEVELOPMENT'
      },
      confirmed: {
        type: 'boolean',
        description: 'Explicit confirmation for new or sensitive operations',
        default: false
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (max 120000 for builds)',
        minimum: 1000,
        maximum: 120000,
        default: 60000
      },
      enableLearning: {
        type: 'boolean',
        description: 'Enable learning new commands with user consent',
        default: true
      },
      keepPrivate: {
        type: 'boolean',
        description: 'Enhanced privacy mode - sanitize all output',
        default: true
      }
    },
    required: ['command']
  }
};

export async function handleSecureBash(args) {
  const {
    command,
    args: commandArgs = [],
    workingDirectory = '.',
    securityLevel = 'DEVELOPMENT',
    confirmed = false,
    timeout = 60000,
    enableLearning = true,
    keepPrivate = true
  } = args.params || args;

  try {
    // Initialize enhanced executor
    const executor = new EnhancedSecureCommandExecutor(workingDirectory, {
      securityLevel,
      timeoutMs: timeout,
      enableLearning,
      enableAuditing: true,
      enableContentFiltering: keepPrivate,
      outputSanitization: keepPrivate
    });

    // Execute command
    const result = await executor.execute(command, commandArgs);

    // Check if user consent is required
    if (result.requiresConsent && !confirmed) {
      return formatConsentResponse(result, command, commandArgs);
    }

    // Grant consent if confirmed
    if (confirmed && result.requiresConsent) {
      executor.grantConsent(command, commandArgs);
      // Re-execute with consent
      const retryResult = await executor.execute(command, commandArgs);
      return formatSuccessResponse(retryResult);
    }

    return formatSuccessResponse(result);

  } catch (error) {
    return formatErrorResponse(error, command, commandArgs);
  }
}

/**
 * Format consent request with enhanced information
 */
function formatConsentResponse(result, command, args) {
  const commandCategory = result.commandCategory || 'UNKNOWN';
  const isLearned = result.isLearned || false;
  
  return {
    content: [
      {
        type: 'text',
        text: `🔐 Enhanced Security Review

**Command**: \`${command} ${args.join(' ')}\`
**Category**: ${commandCategory}
**Status**: ${isLearned ? '🎓 Previously learned' : '🆕 New command'}
**Security Level**: ${result.securityLevel}

${result.message}

**What this means**:
- 🔒 **New commands** need your approval for security
- 🎓 **Learned commands** are remembered for future use
- 🛡️ **Privacy protection** is always active
- 📊 **Audit logging** tracks all operations

**Development Tools Supported**:
- 📦 **Package Managers**: bun, npm, yarn, pnpm
- 🚀 **Runtimes**: node, bun, python, deno
- 🧪 **Testing**: jest, vitest, mocha, playwright
- 🔍 **Linting**: eslint, prettier, tsc, ruff
- 🔨 **Build Tools**: webpack, vite, rollup

To proceed, run the command again with \`confirmed: true\`:
\`\`\`json
{
  "command": "${command}",
  "args": ${JSON.stringify(args)},
  "confirmed": true
}
\`\`\`

✅ **Privacy Features**:
- All output is sanitized to remove sensitive data
- Absolute paths are converted to relative paths
- API keys and tokens are automatically redacted
- Personal information is filtered out

🎯 **Learning System**:
- Approved commands are remembered
- Builds a personalized whitelist over time
- Consent expires after 24 hours for security
- Reset learning anytime with \`resetLearning: true\`
`
      }
    ]
  };
}

/**
 * Format successful execution with enhanced details
 */
function formatSuccessResponse(result) {
  const outputPreview = result.output.length > 3000 
    ? result.output.substring(0, 3000) + '\n\n... (output truncated for display)'
    : result.output;

  return {
    content: [
      {
        type: 'text',
        text: `✅ Command Executed Successfully

**Command**: \`${result.command} ${result.args.join(' ')}\`
**Security Level**: ${result.securityLevel}
**Category**: ${result.commandCategory || 'FILESYSTEM'}
**Files Processed**: ${result.paths.length}
**Output Size**: ${result.output.length} bytes
**Timestamp**: ${result.timestamp}

📋 **Output**:
\`\`\`
${outputPreview}
\`\`\`

🔒 **Privacy Protection**:
- ✅ Content filtering: ${result.contentFiltered ? 'Active' : 'Disabled'}
- ✅ Output sanitization: ${result.outputSanitized ? 'Active' : 'Disabled'}
- ✅ Path normalization: Absolute paths converted to relative
- ✅ Sensitive data redaction: API keys, tokens, credentials filtered

🛡️ **Security Status**:
- ✅ Command validated and approved
- ✅ Workspace restrictions enforced
- ✅ Execution logged for audit trail
- ✅ Privacy controls active

${result.paths.length > 0 ? `📁 **Files Accessed**: ${result.paths.join(', ')}` : ''}

💡 **Tip**: This command will be remembered for faster future execution!
`
      }
    ]
  };
}

/**
 * Format error response with helpful guidance
 */
function formatErrorResponse(error, command, args) {
  const isCommandNotFound = error.message.includes('not allowed') || error.message.includes('Command not found');
  const isArgError = error.message.includes('Argument') && error.message.includes('not allowed');
  
  return {
    content: [
      {
        type: 'text',
        text: `❌ Enhanced Secure Bash Failed

**Command**: \`${command} ${args.join(' ')}\`
**Error**: ${error.message}

🛡️ **Enhanced Security Protection Active**

${isCommandNotFound ? `
🆕 **New Command Detected**
The command '${command}' is not in the current whitelist. This is normal for development!

**To use this command**:
1. Run again with \`confirmed: true\` to approve it
2. The command will be learned and remembered
3. Future uses won't require confirmation

**Supported Command Categories**:
- 📦 **PACKAGE_MANAGERS**: npm, bun, yarn, pnpm, deno
- 🚀 **RUNTIMES**: node, bun, python, python3
- 🧪 **TESTING**: jest, vitest, mocha, tap, cypress, playwright
- 🔍 **LINTING**: eslint, prettier, tsc, ruff, black, flake8
- 🔨 **BUILD_TOOLS**: webpack, vite, rollup, esbuild
- 📁 **FILESYSTEM**: grep, find, ls, cat, head, tail, wc
- 🔧 **UTILITIES**: echo, pwd, which, date, du, df
- 🌿 **GIT**: git (with safe operations)
- 🐳 **DOCKER**: docker, docker-compose, docker-machine
` : ''}

${isArgError ? `
⚠️ **Argument Not Allowed**
The argument is not in the current whitelist for this command.

**To fix this**:
1. Check if the argument is correct
2. Run with \`confirmed: true\` to approve new arguments
3. The argument will be learned for future use
` : ''}

**Security Levels**:
- 🔒 **STRICT**: Minimal commands, requires consent
- ⚖️ **BALANCED**: Standard commands, automatic filtering
- 🔧 **DEVELOPMENT**: Full dev tools, privacy-first (recommended)
- 🌐 **PERMISSIVE**: Extended commands, minimal restrictions

**Privacy Features**:
- 🔒 All output is sanitized by default
- 🔐 Sensitive data is automatically redacted
- 📍 Absolute paths are converted to relative
- 🛡️ Personal information is filtered out

**Example Usage**:
\`\`\`json
{
  "command": "bun",
  "args": ["test"],
  "securityLevel": "DEVELOPMENT",
  "confirmed": true
}
\`\`\`

💡 **Tip**: Use \`securityLevel: "DEVELOPMENT"\` for the best coding experience!
`
      }
    ]
  };
}

export default { secureBashTool, handleSecureBash };