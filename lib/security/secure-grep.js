import { EnhancedSecureCommandExecutor } from './EnhancedSecureCommandExecutor.js';
import { getSecuritySandbox } from './security-init.js';

// Store process reference at module level to avoid conflicts
const nodeProcess = process;

/**
 * Secure Grep tool for MCP server
 * Provides safe grep operations with comprehensive security controls
 */

export const secureGrepTool = {
  name: 'secure_grep',
  description: 'Search text patterns in files securely with input validation, path restrictions, and content filtering',
  
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The search pattern or regular expression'
      },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'File paths or directories to search (must be within workspace)',
        default: ['.']
      },
      recursive: {
        type: 'boolean',
        description: 'Search recursively in directories',
        default: true
      },
      caseInsensitive: {
        type: 'boolean',
        description: 'Perform case-insensitive search',
        default: false
      },
      showLineNumbers: {
        type: 'boolean',
        description: 'Show line numbers in results',
        default: true
      },
      showFilenamesOnly: {
        type: 'boolean',
        description: 'Show only filenames that match (not the matched lines)',
        default: false
      },
      includePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to include (e.g., "*.js", "*.ts")',
        default: []
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File patterns to exclude (e.g., "*.log", "node_modules/*")',
        default: ['node_modules/*', '.git/*', '*.log']
      },
      maxMatches: {
        type: 'number',
        description: 'Maximum number of matches to return',
        minimum: 1,
        maximum: 1000,
        default: 100
      },
      contextLines: {
        type: 'number',
        description: 'Number of context lines before and after matches',
        minimum: 0,
        maximum: 10,
        default: 0
      },
      securityLevel: {
        type: 'string',
        enum: ['STRICT', 'BALANCED', 'PERMISSIVE'],
        description: 'Security level for search operation',
        default: 'BALANCED'
      },
      confirmed: {
        type: 'boolean',
        description: 'Explicit confirmation for sensitive operations',
        default: false
      }
    },
    required: ['pattern']
  }
};

export async function handleSecureGrep(args) {
  const {
    pattern,
    paths = ['.'],
    recursive = true,
    caseInsensitive = false,
    showLineNumbers = true,
    showFilenamesOnly = false,
    includePatterns = [],
    excludePatterns = ['node_modules/*', '.git/*', '*.log'],
    maxMatches = 100,
    contextLines = 0,
    securityLevel = 'BALANCED',
    confirmed = false
  } = args.params || args;

  try {
    // Validate pattern for security
    validateSearchPattern(pattern);

    // Build grep command
    const grepArgs = buildGrepArguments({
      pattern,
      paths,
      recursive,
      caseInsensitive,
      showLineNumbers,
      showFilenamesOnly,
      includePatterns,
      excludePatterns,
      maxMatches,
      contextLines
    });

    // Initialize secure executor with policy manager
    const executor = new EnhancedSecureCommandExecutor(nodeProcess.cwd(), {
      securityLevel,
      timeoutMs: 30000,
      enableAuditing: true,
      enableContentFiltering: true,
      policyManager: getSecuritySandbox()
    });

    // Execute grep command
    const result = await executor.execute('grep', grepArgs);

    // Check if user consent is required
    if (result.requiresConsent && !confirmed) {
      return formatConsentResponse(result, pattern);
    }

    // Parse and format grep results
    const matches = parseGrepOutput(result.output, showLineNumbers, contextLines);
    
    return formatGrepResponse(matches, {
      pattern,
      paths,
      securityLevel,
      contentFiltered: result.contentFiltered,
      filesSearched: result.paths.length,
      timestamp: result.timestamp
    });

  } catch (error) {
    return formatErrorResponse(error, pattern);
  }
}

/**
 * Validate search pattern for security issues
 */
function validateSearchPattern(pattern) {
  // Block potentially dangerous patterns
  const dangerousPatterns = [
    /system\s*\(/gi,
    /exec\s*\(/gi,
    /eval\s*\(/gi,
    /\$\([^)]*\)/g, // Command substitution
    /`[^`]*`/g, // Backtick execution
    /\|\s*(rm|del|format|dd)\s/gi, // Dangerous pipe commands
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      throw new Error(`Pattern contains potentially dangerous syntax: ${pattern}`);
    }
  }

  // Check pattern length
  if (pattern.length > 500) {
    throw new Error('Search pattern is too long (max 500 characters)');
  }

  // Validate regex if it looks like one
  if (pattern.includes('[') || pattern.includes('(') || pattern.includes('{')) {
    try {
      new RegExp(pattern);
    } catch (error) {
      throw new Error(`Invalid regular expression pattern: ${error.message}`);
    }
  }
}

/**
 * Build grep command arguments
 */
function buildGrepArguments(options) {
  const args = [];

  // Add flags
  if (options.recursive) args.push('-r');
  if (options.caseInsensitive) args.push('-i');
  if (options.showLineNumbers) args.push('-n');
  if (options.showFilenamesOnly) args.push('-l');

  // Add context lines
  if (options.contextLines > 0) {
    args.push('-C', options.contextLines.toString());
  }

  // Add include patterns
  for (const include of options.includePatterns) {
    args.push('--include', include);
  }

  // Add exclude patterns  
  for (const exclude of options.excludePatterns) {
    args.push('--exclude', exclude);
  }

  // Add the search pattern
  args.push(options.pattern);

  // Add paths
  args.push(...options.paths);

  return args;
}

/**
 * Parse grep output into structured results
 */
function parseGrepOutput(output, showLineNumbers, contextLines) {
  if (!output.trim()) {
    return [];
  }

  const lines = output.split('\n').filter(line => line.trim());
  const matches = [];
  let currentMatch = null;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Parse grep output format: filename:lineNumber:content or filename:content
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const filename = line.substring(0, colonIndex);
    const remainder = line.substring(colonIndex + 1);

    let lineNumber = null;
    let content = remainder;

    // Check if line number is present
    if (showLineNumbers) {
      const secondColonIndex = remainder.indexOf(':');
      if (secondColonIndex !== -1) {
        const potentialLineNumber = remainder.substring(0, secondColonIndex);
        if (/^\d+$/.test(potentialLineNumber)) {
          lineNumber = parseInt(potentialLineNumber);
          content = remainder.substring(secondColonIndex + 1);
        }
      }
    }

    // Create match object
    const match = {
      filename,
      lineNumber,
      content: content.trim(),
      contextLines: []
    };

    matches.push(match);
  }

  return matches;
}

/**
 * Format response when user consent is required
 */
function formatConsentResponse(result, pattern) {
  return {
    content: [
      {
        type: 'text',
        text: `🔒 Search Operation Requires Confirmation

**Pattern**: \`${pattern}\`
**Operation**: ${result.operation}
**Security Level**: ${result.securityLevel}
**Files/Directories**: ${result.paths.length > 0 ? result.paths.join(', ') : 'Current directory'}

${result.message}

⚠️ This search operation requires explicit confirmation due to security policies.

To proceed, run the command again with \`confirmed: true\`.

🛡️ **Security Features Active**:
- Pattern validation for dangerous syntax
- Path restriction to workspace only
- Content filtering for sensitive data
- Comprehensive audit logging
`
      }
    ]
  };
}

/**
 * Format successful grep response
 */
function formatGrepResponse(matches, metadata) {
  const { pattern, paths, securityLevel, contentFiltered, filesSearched, timestamp } = metadata;

  if (matches.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `🔍 Search Results

**Pattern**: \`${pattern}\`
**Paths**: ${paths.join(', ')}
**Security Level**: ${securityLevel}

📋 **No matches found**

🛡️ **Security Status**:
- ✅ Pattern validated for safety
- ✅ Search restricted to workspace
- ✅ ${contentFiltered ? 'Sensitive content filtered' : 'No content filtering applied'}
- ✅ Operation logged for audit trail

**Files Searched**: ${filesSearched}
**Timestamp**: ${timestamp}
`
        }
      ]
    };
  }

  // Group matches by file
  const fileGroups = {};
  matches.forEach(match => {
    if (!fileGroups[match.filename]) {
      fileGroups[match.filename] = [];
    }
    fileGroups[match.filename].push(match);
  });

  const fileCount = Object.keys(fileGroups).length;
  const totalMatches = matches.length;

  // Format results
  let resultText = `🔍 Search Results

**Pattern**: \`${pattern}\`
**Paths**: ${paths.join(', ')}
**Security Level**: ${securityLevel}
**Files with matches**: ${fileCount}
**Total matches**: ${totalMatches}

`;

  // Add matches grouped by file
  for (const [filename, fileMatches] of Object.entries(fileGroups)) {
    resultText += `\n📁 **${filename}** (${fileMatches.length} matches)\n`;
    
    fileMatches.forEach(match => {
      const lineInfo = match.lineNumber ? `Line ${match.lineNumber}: ` : '';
      resultText += `   ${lineInfo}${match.content}\n`;
    });
  }

  resultText += `\n🛡️ **Security Status**:
- ✅ Pattern validated for safety
- ✅ Search restricted to workspace  
- ✅ ${contentFiltered ? 'Sensitive content filtered' : 'No content filtering applied'}
- ✅ Operation logged for audit trail

**Files Searched**: ${filesSearched}
**Timestamp**: ${timestamp}
`;

  return {
    content: [
      {
        type: 'text',
        text: resultText
      },
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          pattern,
          totalMatches,
          filesWithMatches: fileCount,
          filesSearched,
          securityLevel,
          contentFiltered,
          timestamp,
          matches: matches.slice(0, 50) // Limit JSON output
        }, null, 2)
      }
    ]
  };
}

/**
 * Format error response
 */
function formatErrorResponse(error, pattern) {
  return {
    content: [
      {
        type: 'text',
        text: `❌ Search Operation Failed

**Pattern**: \`${pattern || 'N/A'}\`
**Error**: ${error.message}

🛡️ **Security Protection Active**

This error occurred due to security protections in place:

**Common Issues**:
- **Dangerous pattern**: Pattern contains potentially harmful syntax
- **Path access denied**: Search paths outside workspace or in blocked directories
- **Invalid regex**: Pattern is not a valid regular expression
- **Pattern too long**: Search pattern exceeds size limit (500 chars)
- **File access restricted**: Certain file types may be blocked

**Safe Pattern Examples**:
- \`function myFunc\` - Simple text search
- \`TODO|FIXME\` - Multiple terms with OR
- \`class [A-Z]\\w+\` - Class names with regex
- \`console\\.log\` - Escaped special characters

**Security Features**:
- Pattern validation for dangerous syntax
- Path restriction to workspace only
- Content filtering for sensitive data
- File type restrictions based on security level

For help with search patterns and security levels, check the documentation.
`
      }
    ]
  };
}

export default { secureGrepTool, handleSecureGrep };