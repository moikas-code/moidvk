import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { extname } from 'path';

/**
 * Extracts metadata from code files
 * Provides semantic understanding without exposing raw code
 */
export class FileMetadataExtractor {
  constructor() {
    this.supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  }

  /**
   * Extract metadata from file content
   * @param {string} content - File content
   * @param {string} filePath - File path for type detection
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(content, filePath) {
    const ext = extname(filePath).toLowerCase();
    const fileType = this.detectFileType(filePath, content);

    const metadata = {
      fileType,
      lineCount: content.split('\n').length,
      characterCount: content.length,
      isEmpty: content.trim().length === 0,
    };

    // Extract code-specific metadata
    if (this.supportedExtensions.includes(ext)) {
      try {
        const codeMetadata = await this.extractCodeMetadata(content, ext);
        Object.assign(metadata, codeMetadata);
      } catch (error) {
        metadata.parseError = error.message;
      }
    }

    // Add complexity estimation
    metadata.complexity = this.estimateComplexity(metadata);

    // Generate summary
    metadata.summary = this.generateSummary(metadata, fileType);

    return metadata;
  }

  /**
   * Extract metadata from JavaScript/TypeScript code
   * @param {string} content - Code content
   * @param {string} ext - File extension
   * @returns {Object} Code metadata
   */
  extractCodeMetadata(content, ext) {
    const metadata = {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      variables: [],
      comments: 0,
      hasJSX: false,
      hasTypeScript: false,
      asyncFunctions: [],
      hooks: [], // React hooks
    };

    // Parse options based on file type
    const isTypeScript = ['.ts', '.tsx'].includes(ext);
    const isJSX = ['.jsx', '.tsx'].includes(ext);

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          ...(isJSX ? ['jsx'] : []),
          ...(isTypeScript ? ['typescript'] : []),
          'importMeta',
          'topLevelAwait',
          'classProperties',
          'classPrivateProperties',
          'classPrivateMethods',
          'decorators-legacy',
          'dynamicImport',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'nullishCoalescingOperator',
          'optionalChaining',
        ],
      });

      traverse.default(ast, {
        // Functions
        FunctionDeclaration(path) {
          const name = path.node.id?.name;
          if (name) {
            metadata.functions.push(name);
            if (path.node.async) {
              metadata.asyncFunctions.push(name);
            }
          }
        },
        
        // Arrow functions assigned to variables
        VariableDeclarator(path) {
          if (path.node.init?.type === 'ArrowFunctionExpression' ||
              path.node.init?.type === 'FunctionExpression') {
            const name = path.node.id?.name;
            if (name) {
              metadata.functions.push(name);
              if (path.node.init.async) {
                metadata.asyncFunctions.push(name);
              }
              // Check for React hooks
              if (name.startsWith('use') && name[3]?.match(/[A-Z]/)) {
                metadata.hooks.push(name);
              }
            }
          } else if (path.node.id?.name) {
            metadata.variables.push(path.node.id.name);
          }
        },

        // Classes
        ClassDeclaration(path) {
          const name = path.node.id?.name;
          if (name) {
            metadata.classes.push(name);
          }
        },

        // Imports
        ImportDeclaration(path) {
          const source = path.node.source.value;
          const specifiers = path.node.specifiers.map(spec => {
            if (spec.type === 'ImportDefaultSpecifier') {
              return spec.local.name;
            } else if (spec.type === 'ImportSpecifier') {
              return spec.imported.name;
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              return `* as ${spec.local.name}`;
            }
          }).filter(Boolean);
          
          metadata.imports.push({
            source,
            specifiers,
          });
        },

        // Exports
        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            if (path.node.declaration.id?.name) {
              metadata.exports.push(path.node.declaration.id.name);
            } else if (path.node.declaration.declarations) {
              path.node.declaration.declarations.forEach(decl => {
                if (decl.id?.name) {
                  metadata.exports.push(decl.id.name);
                }
              });
            }
          } else if (path.node.specifiers) {
            path.node.specifiers.forEach(spec => {
              metadata.exports.push(spec.exported.name);
            });
          }
        },

        ExportDefaultDeclaration(path) {
          metadata.exports.push('default');
        },

        // JSX detection
        JSXElement() {
          metadata.hasJSX = true;
        },

        // TypeScript detection
        TSTypeAnnotation() {
          metadata.hasTypeScript = true;
        },

        // Comments
        enter(path) {
          const comments = path.node.leadingComments || [];
          metadata.comments += comments.length;
        },

        // React hook calls
        CallExpression(path) {
          if (path.node.callee.type === 'Identifier' &&
              path.node.callee.name.startsWith('use') &&
              path.node.callee.name[3]?.match(/[A-Z]/)) {
            if (!metadata.hooks.includes(path.node.callee.name)) {
              metadata.hooks.push(path.node.callee.name);
            }
          }
        },
      });

      // Simplify imports to just module names
      metadata.imports = [...new Set(metadata.imports.map(imp => imp.source))];

      // Remove duplicates
      metadata.functions = [...new Set(metadata.functions)];
      metadata.classes = [...new Set(metadata.classes)];
      metadata.exports = [...new Set(metadata.exports)];
      metadata.variables = [...new Set(metadata.variables)];
      metadata.asyncFunctions = [...new Set(metadata.asyncFunctions)];
      metadata.hooks = [...new Set(metadata.hooks)];

    } catch (error) {
      // If parsing fails, return basic metadata
      metadata.parseError = error.message;
    }

    return metadata;
  }

  /**
   * Detect file type based on extension and content
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {string} Detected file type
   */
  detectFileType(filePath, content) {
    const ext = extname(filePath).toLowerCase();
    
    const typeMap = {
      '.js': 'javascript',
      '.jsx': 'javascript-react',
      '.ts': 'typescript',
      '.tsx': 'typescript-react',
      '.mjs': 'javascript-module',
      '.cjs': 'javascript-commonjs',
      '.json': 'json',
      '.md': 'markdown',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.html': 'html',
      '.xml': 'xml',
      '.py': 'python',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c-header',
      '.hpp': 'cpp-header',
      '.sh': 'shell',
      '.bash': 'bash',
      '.zsh': 'zsh',
      '.ps1': 'powershell',
      '.bat': 'batch',
      '.cmd': 'batch',
    };

    return typeMap[ext] || 'text';
  }

  /**
   * Estimate code complexity
   * @param {Object} metadata - Extracted metadata
   * @returns {string} Complexity level
   */
  estimateComplexity(metadata) {
    if (metadata.parseError || metadata.isEmpty) {
      return 'unknown';
    }

    let score = 0;

    // Line count factor
    if (metadata.lineCount > 500) score += 3;
    else if (metadata.lineCount > 200) score += 2;
    else if (metadata.lineCount > 100) score += 1;

    // Function count factor
    if (metadata.functions?.length > 20) score += 3;
    else if (metadata.functions?.length > 10) score += 2;
    else if (metadata.functions?.length > 5) score += 1;

    // Class count factor
    if (metadata.classes?.length > 5) score += 2;
    else if (metadata.classes?.length > 2) score += 1;

    // Async complexity
    if (metadata.asyncFunctions?.length > 5) score += 2;
    else if (metadata.asyncFunctions?.length > 2) score += 1;

    // Import complexity
    if (metadata.imports?.length > 20) score += 2;
    else if (metadata.imports?.length > 10) score += 1;

    // TypeScript adds complexity
    if (metadata.hasTypeScript) score += 1;

    // Determine level
    if (score >= 8) return 'very-high';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'low';
    return 'very-low';
  }

  /**
   * Generate a summary description
   * @param {Object} metadata - Extracted metadata
   * @param {string} fileType - File type
   * @returns {string} Summary description
   */
  generateSummary(metadata, fileType) {
    const parts = [];

    // Base file type
    if (fileType.includes('react')) {
      parts.push('React component');
    } else if (fileType.includes('typescript')) {
      parts.push('TypeScript module');
    } else if (fileType.includes('javascript')) {
      parts.push('JavaScript module');
    } else {
      parts.push(`${fileType} file`);
    }

    // Main content
    if (metadata.classes?.length > 0) {
      parts.push(`with ${metadata.classes.length} class${metadata.classes.length > 1 ? 'es' : ''}`);
    } else if (metadata.functions?.length > 0) {
      parts.push(`with ${metadata.functions.length} function${metadata.functions.length > 1 ? 's' : ''}`);
    }

    // React hooks
    if (metadata.hooks?.length > 0) {
      parts.push(`using ${metadata.hooks.join(', ')}`);
    }

    // Async presence
    if (metadata.asyncFunctions?.length > 0) {
      parts.push('(async)');
    }

    // Imports
    if (metadata.imports?.length > 0) {
      const mainImports = metadata.imports
        .filter(imp => !imp.startsWith('.'))
        .slice(0, 3);
      if (mainImports.length > 0) {
        parts.push(`importing ${mainImports.join(', ')}${metadata.imports.length > 3 ? '...' : ''}`);
      }
    }

    return parts.join(' ') || 'Empty file';
  }
}