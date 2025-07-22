/**
 * Documentation Quality Checker
 * Analyzes documentation quality including JSDoc, TypeDoc, README files, and inline comments
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

const execAsync = promisify(exec);

/**
 * Documentation Quality Checker Tool
 */
export const documentationAnalyzerTool = {
  name: 'documentation_quality_checker',
  description: 'Analyzes documentation quality including JSDoc, TypeDoc, README files, and inline comments for completeness and best practices.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code content to analyze for documentation (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "utils.js", "README.md")',
      },
      projectPath: {
        type: 'string',
        description: 'Path to project directory for comprehensive analysis',
      },
      docType: {
        type: 'string',
        enum: ['code', 'readme', 'api', 'all'],
        default: 'all',
        description: 'Type of documentation to analyze',
      },
      standard: {
        type: 'string',
        enum: ['jsdoc', 'typedoc', 'tsdoc', 'auto'],
        default: 'auto',
        description: 'Documentation standard to enforce',
      },
      strictness: {
        type: 'string',
        enum: ['minimal', 'standard', 'strict'],
        default: 'standard',
        description: 'Documentation quality strictness level',
      },
      includePrivate: {
        type: 'boolean',
        default: false,
        description: 'Include analysis of private/internal functions',
      },
      checkSpelling: {
        type: 'boolean',
        default: false,
        description: 'Perform basic spelling checks on documentation',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
        default: 50,
        minimum: 1,
        maximum: 500,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        default: 0,
        minimum: 0,
      },
    },
    required: [],
  },
};

/**
 * Handle documentation quality analysis
 */
export async function handleDocumentationAnalyzer(request) {
  try {
    const { 
      code,
      filename,
      projectPath,
      docType = 'all',
      standard = 'auto',
      strictness = 'standard',
      includePrivate = false,
      checkSpelling = false,
      limit = 50,
      offset = 0,
    } = request.params;

    if (!code && !projectPath) {
      return {
        content: [{
          type: 'text',
          text: '❌ Either code content or project path must be provided',
        }],
      };
    }

    const analysis = {
      type: docType,
      standard: standard === 'auto' ? detectDocStandard(code, filename) : standard,
      issues: [],
      metrics: {
        totalFunctions: 0,
        documentedFunctions: 0,
        totalClasses: 0,
        documentedClasses: 0,
        totalInterfaces: 0,
        documentedInterfaces: 0,
        readmeQuality: 0,
        commentDensity: 0,
      },
      suggestions: [],
    };

    // Analyze based on type
    if (docType === 'code' || docType === 'all') {
      if (code) {
        await analyzeCodeDocumentation(code, filename, analysis, {
          standard: analysis.standard,
          strictness,
          includePrivate,
          checkSpelling,
        });
      }
    }

    if (docType === 'readme' || docType === 'all') {
      if (projectPath) {
        await analyzeReadmeDocumentation(projectPath, analysis, { strictness });
      } else if (filename && filename.toLowerCase().includes('readme')) {
        await analyzeReadmeContent(code, analysis, { strictness });
      }
    }

    if (docType === 'api' || docType === 'all') {
      if (code && filename) {
        await analyzeApiDocumentation(code, filename, analysis, {
          standard: analysis.standard,
          strictness,
        });
      }
    }

    // Generate suggestions
    generateDocumentationSuggestions(analysis);

    // Filter and paginate
    const filteredIssues = analysis.issues.slice(offset, offset + limit);

    // Calculate documentation score
    const docScore = calculateDocumentationScore(analysis);

    // Build response
    const response = {
      analysis: {
        type: docType,
        standard: analysis.standard,
        strictness,
        score: docScore,
      },
      metrics: analysis.metrics,
      issues: filteredIssues,
      suggestions: analysis.suggestions,
      summary: {
        totalIssues: analysis.issues.length,
        critical: analysis.issues.filter(i => i.severity === 'critical').length,
        high: analysis.issues.filter(i => i.severity === 'high').length,
        medium: analysis.issues.filter(i => i.severity === 'medium').length,
        low: analysis.issues.filter(i => i.severity === 'low').length,
      },
      pagination: {
        offset,
        limit,
        total: analysis.issues.length,
        hasMore: offset + limit < analysis.issues.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[DocumentationAnalyzer] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Documentation analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Detect documentation standard from code
 */
function detectDocStandard(code, filename) {
  if (!code) return 'jsdoc';
  
  if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'))) {
    if (code.includes('@param') && code.includes('{@link')) return 'tsdoc';
    return 'typedoc';
  }
  
  if (code.includes('/**') && code.includes('@param')) return 'jsdoc';
  
  return 'jsdoc'; // default
}

/**
 * Analyze code documentation
 */
async function analyzeCodeDocumentation(code, filename, analysis, options) {
  if (!code || code.length > 100000) {
    analysis.issues.push({
      type: 'input_error',
      severity: 'medium',
      message: 'Code too large or empty for analysis',
      file: filename,
    });
    return;
  }

  let ast;
  try {
    ast = parseCodeForDocs(code, filename);
  } catch (parseError) {
    analysis.issues.push({
      type: 'parse_error',
      severity: 'high',
      message: `Failed to parse code: ${parseError.message}`,
      file: filename,
    });
    return;
  }

  const codeLines = code.split('\n');
  let commentLines = 0;
  
  // Count comment lines for density calculation
  codeLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      commentLines++;
    }
  });
  
  analysis.metrics.commentDensity = codeLines.length > 0 ? commentLines / codeLines.length : 0;

  // Analyze AST for documentation
  traverse(ast, {
    FunctionDeclaration(path) {
      analyzeFunctionDocumentation(path, analysis, options, codeLines);
    },
    
    FunctionExpression(path) {
      // Only analyze named function expressions
      if (path.node.id) {
        analyzeFunctionDocumentation(path, analysis, options, codeLines);
      }
    },
    
    ArrowFunctionExpression(path) {
      // Only analyze arrow functions assigned to variables
      if (path.parent.type === 'VariableDeclarator' && path.parent.id.name) {
        analyzeFunctionDocumentation(path, analysis, options, codeLines);
      }
    },
    
    ClassDeclaration(path) {
      analyzeClassDocumentation(path, analysis, options, codeLines);
    },
    
    TSInterfaceDeclaration(path) {
      analyzeInterfaceDocumentation(path, analysis, options, codeLines);
    },
    
    MethodDefinition(path) {
      analyzeMethodDocumentation(path, analysis, options, codeLines);
    },
  });
}

/**
 * Parse code for documentation analysis
 */
function parseCodeForDocs(code, filename) {
  const isTypeScript = filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'));
  
  return parser.parse(code, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: [
      'jsx',
      'asyncGenerators',
      'bigInt',
      'classProperties',
      'decorators-legacy',
      'doExpressions',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'functionBind',
      'functionSent',
      'importMeta',
      'nullishCoalescingOperator',
      'numericSeparator',
      'objectRestSpread',
      'optionalCatchBinding',
      'optionalChaining',
      'throwExpressions',
      'topLevelAwait',
      'trailingFunctionCommas',
      ...(isTypeScript ? ['typescript'] : []),
    ],
  });
}

/**
 * Analyze function documentation
 */
function analyzeFunctionDocumentation(path, analysis, options, codeLines) {
  analysis.metrics.totalFunctions++;
  
  const functionName = getFunctionName(path);
  const isPrivate = functionName.startsWith('_') || functionName.startsWith('#');
  
  if (isPrivate && !options.includePrivate) return;
  
  const line = path.node.loc?.start.line || 0;
  const docComment = getDocComment(path, codeLines);
  
  if (!docComment) {
    const severity = options.strictness === 'strict' ? 'high' : 
                    options.strictness === 'standard' ? 'medium' : 'low';
    
    analysis.issues.push({
      type: 'missing_documentation',
      severity,
      message: `Function '${functionName}' lacks documentation`,
      line,
      function: functionName,
      recommendation: 'Add JSDoc comment describing function purpose, parameters, and return value',
    });
  } else {
    analysis.metrics.documentedFunctions++;
    
    // Analyze documentation quality
    analyzeDocCommentQuality(docComment, analysis, options, {
      type: 'function',
      name: functionName,
      line,
      parameters: path.node.params,
    });
  }
}

/**
 * Analyze class documentation
 */
function analyzeClassDocumentation(path, analysis, options, codeLines) {
  analysis.metrics.totalClasses++;
  
  const className = path.node.id?.name || 'anonymous';
  const line = path.node.loc?.start.line || 0;
  const docComment = getDocComment(path, codeLines);
  
  if (!docComment) {
    const severity = options.strictness === 'strict' ? 'high' : 'medium';
    
    analysis.issues.push({
      type: 'missing_documentation',
      severity,
      message: `Class '${className}' lacks documentation`,
      line,
      class: className,
      recommendation: 'Add JSDoc comment describing class purpose and usage',
    });
  } else {
    analysis.metrics.documentedClasses++;
    
    analyzeDocCommentQuality(docComment, analysis, options, {
      type: 'class',
      name: className,
      line,
    });
  }
}

/**
 * Analyze interface documentation (TypeScript)
 */
function analyzeInterfaceDocumentation(path, analysis, options, codeLines) {
  analysis.metrics.totalInterfaces++;
  
  const interfaceName = path.node.id?.name || 'anonymous';
  const line = path.node.loc?.start.line || 0;
  const docComment = getDocComment(path, codeLines);
  
  if (!docComment) {
    analysis.issues.push({
      type: 'missing_documentation',
      severity: 'medium',
      message: `Interface '${interfaceName}' lacks documentation`,
      line,
      interface: interfaceName,
      recommendation: 'Add TSDoc comment describing interface purpose',
    });
  } else {
    analysis.metrics.documentedInterfaces++;
    
    analyzeDocCommentQuality(docComment, analysis, options, {
      type: 'interface',
      name: interfaceName,
      line,
    });
  }
}

/**
 * Analyze method documentation
 */
function analyzeMethodDocumentation(path, analysis, options, codeLines) {
  const methodName = path.node.key?.name || 'anonymous';
  const isPrivate = methodName.startsWith('_') || methodName.startsWith('#');
  
  if (isPrivate && !options.includePrivate) return;
  
  const line = path.node.loc?.start.line || 0;
  const docComment = getDocComment(path, codeLines);
  
  if (!docComment && options.strictness !== 'minimal') {
    analysis.issues.push({
      type: 'missing_documentation',
      severity: 'low',
      message: `Method '${methodName}' lacks documentation`,
      line,
      method: methodName,
      recommendation: 'Add JSDoc comment for public methods',
    });
  }
}

/**
 * Get function name from AST node
 */
function getFunctionName(path) {
  if (path.node.id?.name) return path.node.id.name;
  
  // Arrow function assigned to variable
  if (path.parent.type === 'VariableDeclarator' && path.parent.id?.name) {
    return path.parent.id.name;
  }
  
  return 'anonymous';
}

/**
 * Get documentation comment for a node
 */
function getDocComment(path, codeLines) {
  const line = path.node.loc?.start.line || 0;
  if (line <= 1) return null;
  
  // Look for JSDoc comment in previous lines
  for (let i = line - 2; i >= Math.max(0, line - 5); i--) {
    const codeLine = codeLines[i]?.trim() || '';
    if (codeLine.startsWith('/**')) {
      // Found start of JSDoc comment
      let comment = '';
      for (let j = i; j < Math.min(codeLines.length, line - 1); j++) {
        comment += codeLines[j] + '\n';
        if (codeLines[j].trim().endsWith('*/')) break;
      }
      return comment;
    }
    if (codeLine && !codeLine.startsWith('*') && !codeLine.startsWith('//')) {
      break; // Found non-comment code, stop looking
    }
  }
  
  return null;
}

/**
 * Analyze documentation comment quality
 */
function analyzeDocCommentQuality(docComment, analysis, options, context) {
  const lines = docComment.split('\n');
  const content = lines.map(line => line.replace(/^\s*\*?\s?/, '')).join('\n');
  
  // Check for empty documentation
  if (content.replace(/[/*\s]/g, '').length < 10) {
    analysis.issues.push({
      type: 'poor_documentation',
      severity: 'medium',
      message: `${context.type} '${context.name}' has minimal documentation`,
      line: context.line,
      [context.type]: context.name,
      recommendation: 'Provide more detailed description',
    });
    return;
  }
  
  // Check for standard JSDoc tags
  const hasDescription = !content.trim().startsWith('@');
  if (!hasDescription) {
    analysis.issues.push({
      type: 'missing_description',
      severity: 'medium',
      message: `${context.type} '${context.name}' missing description`,
      line: context.line,
      [context.type]: context.name,
      recommendation: 'Add description before @tags',
    });
  }
  
  // Check parameter documentation for functions
  if (context.type === 'function' && context.parameters) {
    const paramTags = (content.match(/@param/g) || []).length;
    const actualParams = context.parameters.length;
    
    if (actualParams > 0 && paramTags === 0 && options.strictness !== 'minimal') {
      analysis.issues.push({
        type: 'missing_param_docs',
        severity: 'medium',
        message: `Function '${context.name}' parameters not documented`,
        line: context.line,
        function: context.name,
        recommendation: 'Add @param tags for all parameters',
      });
    } else if (paramTags !== actualParams && paramTags > 0) {
      analysis.issues.push({
        type: 'param_mismatch',
        severity: 'medium',
        message: `Function '${context.name}' has ${actualParams} parameters but ${paramTags} @param tags`,
        line: context.line,
        function: context.name,
        recommendation: 'Ensure @param tags match actual parameters',
      });
    }
  }
  
  // Check for return documentation
  if (context.type === 'function' && !content.includes('@returns') && !content.includes('@return')) {
    if (options.strictness === 'strict') {
      analysis.issues.push({
        type: 'missing_return_docs',
        severity: 'low',
        message: `Function '${context.name}' missing @returns documentation`,
        line: context.line,
        function: context.name,
        recommendation: 'Add @returns tag if function returns a value',
      });
    }
  }
  
  // Check for example usage
  if (!content.includes('@example') && options.strictness === 'strict') {
    analysis.issues.push({
      type: 'missing_examples',
      severity: 'low',
      message: `${context.type} '${context.name}' missing usage examples`,
      line: context.line,
      [context.type]: context.name,
      recommendation: 'Add @example tag with usage examples',
    });
  }
  
  // Basic spelling check if enabled
  if (options.checkSpelling) {
    checkSpelling(content, analysis, context);
  }
}

/**
 * Analyze README documentation
 */
async function analyzeReadmeDocumentation(projectPath, analysis, options) {
  const readmeFiles = ['README.md', 'readme.md', 'README.rst', 'README.txt'];
  let readmeFound = false;
  
  for (const filename of readmeFiles) {
    const readmePath = join(projectPath, filename);
    if (existsSync(readmePath)) {
      readmeFound = true;
      const content = readFileSync(readmePath, 'utf8');
      await analyzeReadmeContent(content, analysis, options, filename);
      break;
    }
  }
  
  if (!readmeFound) {
    analysis.issues.push({
      type: 'missing_readme',
      severity: 'high',
      message: 'No README file found',
      recommendation: 'Create a README.md file with project information',
    });
  }
}

/**
 * Analyze README content quality
 */
async function analyzeReadmeContent(content, analysis, options, filename = 'README.md') {
  if (!content || content.trim().length < 100) {
    analysis.issues.push({
      type: 'minimal_readme',
      severity: 'high',
      message: 'README file is too short or empty',
      file: filename,
      recommendation: 'Expand README with project description, installation, and usage instructions',
    });
    analysis.metrics.readmeQuality = 10;
    return;
  }
  
  let score = 100;
  const sections = {
    title: false,
    description: false,
    installation: false,
    usage: false,
    api: false,
    contributing: false,
    license: false,
  };
  
  const contentLower = content.toLowerCase();
  
  // Check for common sections
  if (content.match(/^#\s+/m)) sections.title = true;
  else score -= 15;
  
  if (contentLower.includes('description') || content.length > 300) sections.description = true;
  else score -= 20;
  
  if (contentLower.includes('install') || contentLower.includes('setup')) sections.installation = true;
  else score -= 15;
  
  if (contentLower.includes('usage') || contentLower.includes('example')) sections.usage = true;
  else score -= 15;
  
  if (contentLower.includes('api') || contentLower.includes('documentation')) sections.api = true;
  else score -= 10;
  
  if (contentLower.includes('contribut') || contentLower.includes('develop')) sections.contributing = true;
  else score -= 10;
  
  if (contentLower.includes('license') || contentLower.includes('mit') || contentLower.includes('apache')) sections.license = true;
  else score -= 15;
  
  // Additional checks
  const lines = content.split('\n');
  const codeBlocks = (content.match(/```/g) || []).length / 2;
  
  if (codeBlocks === 0 && sections.usage) {
    analysis.issues.push({
      type: 'missing_code_examples',
      severity: 'medium',
      message: 'README mentions usage but has no code examples',
      file: filename,
      recommendation: 'Add code examples using markdown code blocks',
    });
    score -= 10;
  }
  
  // Check for broken links (simple check)
  const links = content.match(/\[.*?\]\(.*?\)/g) || [];
  links.forEach(link => {
    if (link.includes('](http') && !link.includes('https://')) {
      analysis.issues.push({
        type: 'insecure_link',
        severity: 'low',
        message: 'README contains HTTP links (should be HTTPS)',
        file: filename,
        recommendation: 'Use HTTPS links when possible',
      });
    }
  });
  
  analysis.metrics.readmeQuality = Math.max(0, score);
  
  // Generate specific missing section issues
  Object.entries(sections).forEach(([section, present]) => {
    if (!present && options.strictness !== 'minimal') {
      const severity = ['title', 'description', 'installation'].includes(section) ? 'medium' : 'low';
      analysis.issues.push({
        type: 'missing_readme_section',
        severity,
        message: `README missing ${section} section`,
        file: filename,
        recommendation: `Add ${section} section to README`,
        section,
      });
    }
  });
}

/**
 * Analyze API documentation
 */
async function analyzeApiDocumentation(code, filename, analysis, options) {
  // This would analyze API endpoints, OpenAPI specs, etc.
  // For now, just check for exported functions that might be API endpoints
  
  const exports = [];
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes('export') && (line.includes('function') || line.includes('const') || line.includes('class'))) {
      exports.push({
        line: index + 1,
        content: line.trim(),
      });
    }
  });
  
  if (exports.length > 5 && analysis.metrics.documentedFunctions / Math.max(1, analysis.metrics.totalFunctions) < 0.8) {
    analysis.issues.push({
      type: 'api_documentation',
      severity: 'medium',
      message: 'File exports many functions but documentation coverage is low',
      file: filename,
      recommendation: 'Document exported functions as they form the public API',
      exports: exports.length,
    });
  }
}

/**
 * Basic spelling check
 */
function checkSpelling(text, analysis, context) {
  // Simple spell check for common technical terms
  const commonMisspellings = {
    'recieve': 'receive',
    'seperate': 'separate',
    'definately': 'definitely',
    'occured': 'occurred',
    'thier': 'their',
    'lenght': 'length',
    'widht': 'width',
    'heigth': 'height',
  };
  
  Object.entries(commonMisspellings).forEach(([wrong, correct]) => {
    if (text.toLowerCase().includes(wrong)) {
      analysis.issues.push({
        type: 'spelling',
        severity: 'low',
        message: `Possible spelling error: '${wrong}' should be '${correct}'`,
        line: context.line,
        [context.type]: context.name,
        recommendation: `Use '${correct}' instead of '${wrong}'`,
      });
    }
  });
}

/**
 * Generate documentation suggestions
 */
function generateDocumentationSuggestions(analysis) {
  const { metrics } = analysis;
  
  if (metrics.totalFunctions > 0) {
    const docCoverage = metrics.documentedFunctions / metrics.totalFunctions;
    if (docCoverage < 0.5) {
      analysis.suggestions.push({
        type: 'coverage',
        message: `Function documentation coverage is ${Math.round(docCoverage * 100)}%`,
        recommendation: 'Aim for at least 80% documentation coverage for maintainable code',
        priority: 'high',
      });
    }
  }
  
  if (metrics.commentDensity < 0.1) {
    analysis.suggestions.push({
      type: 'comments',
      message: 'Code has low comment density',
      recommendation: 'Add inline comments for complex logic and algorithms',
      priority: 'medium',
    });
  }
  
  if (metrics.readmeQuality < 70) {
    analysis.suggestions.push({
      type: 'readme',
      message: `README quality score is ${metrics.readmeQuality}%`,
      recommendation: 'Improve README with better structure and comprehensive information',
      priority: 'high',
    });
  }
}

/**
 * Calculate overall documentation score
 */
function calculateDocumentationScore(analysis) {
  let score = 100;
  
  // Deduct points for issues
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical': score -= 15; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  });
  
  // Factor in metrics
  const { metrics } = analysis;
  
  if (metrics.totalFunctions > 0) {
    const coverage = metrics.documentedFunctions / metrics.totalFunctions;
    score = score * (0.7 + coverage * 0.3); // Weight coverage
  }
  
  if (metrics.readmeQuality > 0) {
    score = score * (0.8 + (metrics.readmeQuality / 100) * 0.2); // Weight README quality
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}