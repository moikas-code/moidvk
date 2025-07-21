import { readFile, writeFile, unlink, rename, copyFile, mkdir, rmdir, readdir, stat } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { pipeline } from 'stream/promises';
import { SecurityValidator } from './security-validator.js';

/**
 * Main filesystem toolsuite for MCP server
 * Provides privacy-first file operations with optional embedding support
 */
export class FilesystemToolsuite {
  constructor(options = {}) {
    this.validator = new SecurityValidator(options);
    this.embeddingManager = null; // Will be lazy-loaded
    this.metadataExtractor = null; // Will be lazy-loaded
    this.snippetManager = null; // Will be lazy-loaded
    this.tools = [];
    this.initializeTools();
  }

  /**
   * Initialize all filesystem tools
   */
  initializeTools() {
    // Core file operations
    this.tools.push({
      name: 'create_file',
      description: 'Create a new file with content. Requires explicit path within workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to create (relative to workspace)',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
          },
        },
        required: ['filePath', 'content'],
      },
      handler: this.createFile.bind(this),
    });

    this.tools.push({
      name: 'read_file',
      description: 'Read a file with optional embedding generation for AI context. When forAI is true, returns embeddings instead of content.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to read (relative to workspace)',
          },
          forAI: {
            type: 'boolean',
            description: 'If true, return embeddings and metadata instead of raw content',
            default: false,
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
          },
        },
        required: ['filePath'],
      },
      handler: this.readFile.bind(this),
    });

    this.tools.push({
      name: 'update_file',
      description: 'Update an existing file with automatic backup creation.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to update (relative to workspace)',
          },
          content: {
            type: 'string',
            description: 'New content for the file',
          },
          createBackup: {
            type: 'boolean',
            description: 'Create a backup before updating (default: true)',
            default: true,
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
          },
        },
        required: ['filePath', 'content'],
      },
      handler: this.updateFile.bind(this),
    });

    this.tools.push({
      name: 'delete_file',
      description: 'Delete a file with confirmation required.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to delete (relative to workspace)',
          },
          confirmed: {
            type: 'boolean',
            description: 'Explicit confirmation required to delete',
            default: false,
          },
        },
        required: ['filePath'],
      },
      handler: this.deleteFile.bind(this),
    });

    this.tools.push({
      name: 'move_file',
      description: 'Move or rename a file.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: {
            type: 'string',
            description: 'Current path of the file (relative to workspace)',
          },
          destinationPath: {
            type: 'string',
            description: 'New path for the file (relative to workspace)',
          },
          overwrite: {
            type: 'boolean',
            description: 'Overwrite destination if it exists (default: false)',
            default: false,
          },
        },
        required: ['sourcePath', 'destinationPath'],
      },
      handler: this.moveFile.bind(this),
    });

    this.tools.push({
      name: 'copy_file',
      description: 'Copy a file to a new location.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: {
            type: 'string',
            description: 'Path of the file to copy (relative to workspace)',
          },
          destinationPath: {
            type: 'string',
            description: 'Destination path for the copy (relative to workspace)',
          },
          overwrite: {
            type: 'boolean',
            description: 'Overwrite destination if it exists (default: false)',
            default: false,
          },
        },
        required: ['sourcePath', 'destinationPath'],
      },
      handler: this.copyFile.bind(this),
    });

    // Directory operations
    this.tools.push({
      name: 'list_directory',
      description: 'List directory contents with metadata, pagination, and filtering.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory (relative to workspace)',
            default: '.',
          },
          includeHidden: {
            type: 'boolean',
            description: 'Include hidden files (default: false)',
            default: false,
          },
          recursive: {
            type: 'boolean',
            description: 'List recursively (default: false)',
            default: false,
          },
          // Pagination parameters
          limit: {
            type: 'number',
            description: 'Maximum number of entries to return (default: 100, max: 1000)',
            default: 100,
            minimum: 1,
            maximum: 1000,
          },
          offset: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
            default: 0,
            minimum: 0,
          },
          // Sorting parameters
          sortBy: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['name', 'size', 'lastModified', 'type'],
            default: 'name',
          },
          sortOrder: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
            default: 'asc',
          },
          // Filtering parameters
          minSize: {
            type: 'number',
            description: 'Minimum file size in bytes',
            minimum: 0,
          },
          maxSize: {
            type: 'number',
            description: 'Maximum file size in bytes',
            minimum: 0,
          },
          modifiedAfter: {
            type: 'string',
            description: 'Filter entries modified after this date (ISO 8601 format)',
          },
          modifiedBefore: {
            type: 'string',
            description: 'Filter entries modified before this date (ISO 8601 format)',
          },
          type: {
            type: 'string',
            description: 'Filter by entry type',
            enum: ['file', 'directory'],
          },
          fileExtensions: {
            type: 'array',
            description: 'Filter by file extensions (e.g., [".js", ".ts"])',
            items: {
              type: 'string',
            },
          },
        },
        required: [],
      },
      handler: this.listDirectory.bind(this),
    });

    this.tools.push({
      name: 'create_directory',
      description: 'Create a new directory with parent creation support.',
      inputSchema: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'Path to the directory to create (relative to workspace)',
          },
          recursive: {
            type: 'boolean',
            description: 'Create parent directories if needed (default: true)',
            default: true,
          },
        },
        required: ['directoryPath'],
      },
      handler: this.createDirectory.bind(this),
    });

    this.tools.push({
      name: 'delete_directory',
      description: 'Delete a directory with confirmation required.',
      inputSchema: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'Path to the directory to delete (relative to workspace)',
          },
          recursive: {
            type: 'boolean',
            description: 'Delete recursively (default: false)',
            default: false,
          },
          confirmed: {
            type: 'boolean',
            description: 'Explicit confirmation required to delete',
            default: false,
          },
        },
        required: ['directoryPath'],
      },
      handler: this.deleteDirectory.bind(this),
    });

    this.tools.push({
      name: 'move_directory',
      description: 'Move an entire directory to a new location.',
      inputSchema: {
        type: 'object',
        properties: {
          sourcePath: {
            type: 'string',
            description: 'Current path of the directory (relative to workspace)',
          },
          destinationPath: {
            type: 'string',
            description: 'New path for the directory (relative to workspace)',
          },
          overwrite: {
            type: 'boolean',
            description: 'Overwrite destination if it exists (default: false)',
            default: false,
          },
        },
        required: ['sourcePath', 'destinationPath'],
      },
      handler: this.moveDirectory.bind(this),
    });

    // Search and analysis tools
    this.tools.push({
      name: 'search_files',
      description: 'Search for files by name pattern in directories.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern (supports wildcards * and ?)',
          },
          directoryPath: {
            type: 'string',
            description: 'Directory to search in (default: workspace root)',
            default: '.',
          },
          recursive: {
            type: 'boolean',
            description: 'Search recursively in subdirectories (default: true)',
            default: true,
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Case sensitive search (default: false)',
            default: false,
          },
          // Pagination parameters
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 100, max: 1000)',
            default: 100,
            minimum: 1,
            maximum: 1000,
          },
          offset: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
            default: 0,
            minimum: 0,
          },
          // Sorting parameters
          sortBy: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['path', 'name', 'size', 'lastModified'],
            default: 'path',
          },
          sortOrder: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
            default: 'asc',
          },
          // Filtering parameters
          minSize: {
            type: 'number',
            description: 'Minimum file size in bytes',
            minimum: 0,
          },
          maxSize: {
            type: 'number',
            description: 'Maximum file size in bytes',
            minimum: 0,
          },
          modifiedAfter: {
            type: 'string',
            description: 'Filter files modified after this date (ISO 8601 format)',
          },
          modifiedBefore: {
            type: 'string',
            description: 'Filter files modified before this date (ISO 8601 format)',
          },
          excludePatterns: {
            type: 'array',
            description: 'Patterns to exclude from results',
            items: {
              type: 'string',
            },
          },
        },
        required: ['pattern'],
      },
      handler: this.searchFiles.bind(this),
    });

    this.tools.push({
      name: 'search_in_files',
      description: 'Search for text content within files with pagination and filtering.',
      inputSchema: {
        type: 'object',
        properties: {
          searchText: {
            type: 'string',
            description: 'Text to search for',
          },
          directoryPath: {
            type: 'string',
            description: 'Directory to search in (default: workspace root)',
            default: '.',
          },
          filePattern: {
            type: 'string',
            description: 'File pattern to search in (e.g., "*.js")',
            default: '*',
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Case sensitive search (default: false)',
            default: false,
          },
          // Pagination parameters
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 100, max: 1000)',
            default: 100,
            minimum: 1,
            maximum: 1000,
          },
          offset: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
            default: 0,
            minimum: 0,
          },
          // Sorting parameters
          sortBy: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['relevance', 'filePath', 'lineNumber', 'occurrences'],
            default: 'relevance',
          },
          sortOrder: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
          // Filtering parameters
          modifiedAfter: {
            type: 'string',
            description: 'Only search in files modified after this date (ISO 8601 format)',
          },
          modifiedBefore: {
            type: 'string',
            description: 'Only search in files modified before this date (ISO 8601 format)',
          },
          minFileSize: {
            type: 'number',
            description: 'Minimum file size in bytes',
            minimum: 0,
          },
          maxFileSize: {
            type: 'number',
            description: 'Maximum file size in bytes',
            minimum: 0,
          },
          includeLineNumbers: {
            type: 'boolean',
            description: 'Include line numbers in results (default: true)',
            default: true,
          },
          contextLines: {
            type: 'number',
            description: 'Number of context lines before/after matches (default: 0)',
            default: 0,
            minimum: 0,
            maximum: 5,
          },
        },
        required: ['searchText'],
      },
      handler: this.searchInFiles.bind(this),
    });

    this.tools.push({
      name: 'analyze_project',
      description: 'Generate project structure overview with optional embeddings.',
      inputSchema: {
        type: 'object',
        properties: {
          rootPath: {
            type: 'string',
            description: 'Root directory to analyze (default: workspace root)',
            default: '.',
          },
          includeEmbeddings: {
            type: 'boolean',
            description: 'Generate embeddings for code files (default: false)',
            default: false,
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum directory depth to analyze (default: 5)',
            default: 5,
          },
          filePattern: {
            type: 'string',
            description: 'File pattern to include (default: all files)',
            default: '*',
          },
          offset: {
            type: 'number',
            description: 'Offset for pagination (default: 0)',
            default: 0,
          },
          limit: {
            type: 'number',
            description: 'Limit for pagination (default: 50)',
            default: 50,
          },
          sortBy: {
            type: 'string',
            description: 'Field to sort by',
            enum: ['name', 'size', 'lastModified', 'type', 'depth'],
            default: 'name',
          },
          sortOrder: {
            type: 'string',
            description: 'Sort order',
            enum: ['asc', 'desc'],
            default: 'asc',
          },
          includeHidden: {
            type: 'boolean',
            description: 'Include hidden files and directories (default: false)',
            default: false,
          },
          minSize: {
            type: 'number',
            description: 'Minimum file size in bytes',
            minimum: 0,
          },
          maxSize: {
            type: 'number',
            description: 'Maximum file size in bytes',
            minimum: 0,
          },
        },
        required: [],
      },
      handler: this.analyzeProject.bind(this),
    });

    this.tools.push({
      name: 'find_similar_files',
      description: 'Find semantically similar files using embeddings.',
      inputSchema: {
        type: 'object',
        properties: {
          referencePath: {
            type: 'string',
            description: 'Reference file to find similar files for',
          },
          searchPath: {
            type: 'string',
            description: 'Directory to search in (default: workspace root)',
            default: '.',
          },
          topK: {
            type: 'number',
            description: 'Number of similar files to return (default: 10)',
            default: 10,
          },
          threshold: {
            type: 'number',
            description: 'Similarity threshold 0-1 (default: 0.7)',
            default: 0.7,
          },
        },
        required: ['referencePath'],
      },
      handler: this.findSimilarFiles.bind(this),
    });

    // Snippet sharing tools
    this.tools.push({
      name: 'extract_snippet',
      description: 'Extract a code snippet from a file with safety checks and consent requirement.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to extract from',
          },
          startLine: {
            type: 'number',
            description: 'Starting line number (1-based)',
          },
          endLine: {
            type: 'number',
            description: 'Ending line number (inclusive)',
          },
          purpose: {
            type: 'string',
            description: 'Purpose of the snippet extraction',
          },
          sharingLevel: {
            type: 'string',
            description: 'Sharing level: micro (10 lines), function (50 lines), component (200 lines)',
            enum: ['micro', 'function', 'component'],
            default: 'micro',
          },
          autoDetectBoundaries: {
            type: 'boolean',
            description: 'Auto-detect code boundaries (functions, classes)',
            default: true,
          },
          sanitize: {
            type: 'boolean',
            description: 'Sanitize sensitive data like API keys',
            default: true,
          },
          confirmed: {
            type: 'boolean',
            description: 'Explicit confirmation required for sharing',
            default: false,
          },
        },
        required: ['filePath', 'startLine', 'endLine', 'purpose'],
      },
      handler: this.extractSnippet.bind(this),
    });

    this.tools.push({
      name: 'request_editing_help',
      description: 'Request help for a coding task with smart escalation from embeddings to snippets.',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Description of the task needing help',
          },
          filePath: {
            type: 'string',
            description: 'Path to the file needing help',
          },
          sharingLevel: {
            type: 'string',
            description: 'Maximum sharing level allowed',
            enum: ['micro', 'function', 'component'],
            default: 'function',
          },
          preferEmbeddings: {
            type: 'boolean',
            description: 'Try embeddings first before snippets',
            default: true,
          },
        },
        required: ['task', 'filePath'],
      },
      handler: this.requestEditingHelp.bind(this),
    });
  }

  /**
   * Core file operation handlers
   */

  async createFile(args) {
    const { filePath, content, encoding = 'utf8' } = args;

    try {
      const validation = await this.validator.validateOperation('create', filePath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot create file: ${validation.reason}`,
          }],
        };
      }

      // Ensure parent directory exists
      const dir = dirname(validation.resolvedPath);
      await mkdir(dir, { recursive: true });

      // Write the file
      await writeFile(validation.resolvedPath, content, encoding);

      return {
        content: [{
          type: 'text',
          text: `✅ File created successfully: ${filePath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error creating file: ${error.message}`,
        }],
      };
    }
  }

  async readFile(args) {
    const { filePath, forAI = false, encoding = 'utf8' } = args;

    try {
      const validation = await this.validator.validateOperation('read', filePath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot read file: ${validation.reason}`,
          }],
        };
      }

      // Check file size
      const sizeCheck = await this.validator.validateFileSize(validation.resolvedPath);
      if (!sizeCheck.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ ${sizeCheck.error}`,
          }],
        };
      }

      // If AI mode is requested, return embeddings and metadata
      if (forAI) {
        // Lazy load embedding manager
        if (!this.embeddingManager) {
          const { LocalEmbeddingManager } = await import('./embedding-manager.js');
          this.embeddingManager = new LocalEmbeddingManager();
          await this.embeddingManager.initialize();
        }

        // Lazy load metadata extractor
        if (!this.metadataExtractor) {
          const { FileMetadataExtractor } = await import('./metadata-extractor.js');
          this.metadataExtractor = new FileMetadataExtractor();
        }

        const content = await readFile(validation.resolvedPath, encoding);
        const embedding = await this.embeddingManager.generateEmbedding(content, validation.resolvedPath);
        const metadata = await this.metadataExtractor.extractMetadata(content, filePath);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              embedding: embedding.vector,
              metadata,
              fileInfo: {
                path: filePath,
                size: sizeCheck.size,
                lastModified: (await stat(validation.resolvedPath)).mtime.toISOString(),
              },
            }, null, 2),
          }],
        };
      }

      // Regular read - return file content
      const content = await readFile(validation.resolvedPath, encoding);
      return {
        content: [{
          type: 'text',
          text: content,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error reading file: ${error.message}`,
        }],
      };
    }
  }

  async updateFile(args) {
    const { filePath, content, createBackup = true, encoding = 'utf8' } = args;

    try {
      const validation = await this.validator.validateOperation('update', filePath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot update file: ${validation.reason}`,
          }],
        };
      }

      // Create backup if requested
      let backupPath = null;
      if (createBackup) {
        backupPath = this.validator.createBackupPath(validation.resolvedPath);
        await copyFile(validation.resolvedPath, backupPath);
      }

      // Update the file
      await writeFile(validation.resolvedPath, content, encoding);

      return {
        content: [{
          type: 'text',
          text: `✅ File updated successfully: ${filePath}${backupPath ? `\n📋 Backup created: ${basename(backupPath)}` : ''}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error updating file: ${error.message}`,
        }],
      };
    }
  }

  async deleteFile(args) {
    const { filePath, confirmed = false } = args;

    try {
      const validation = await this.validator.validateOperation('delete', filePath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot delete file: ${validation.reason}`,
          }],
        };
      }

      if (!confirmed) {
        const stats = await stat(validation.resolvedPath);
        return {
          content: [{
            type: 'text',
            text: `⚠️  Confirmation required to delete file:\n📄 ${filePath}\n📊 Size: ${stats.size} bytes\n\nSet "confirmed": true to proceed with deletion.`,
          }],
        };
      }

      await unlink(validation.resolvedPath);

      return {
        content: [{
          type: 'text',
          text: `✅ File deleted successfully: ${filePath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error deleting file: ${error.message}`,
        }],
      };
    }
  }

  async moveFile(args) {
    const { sourcePath, destinationPath, overwrite = false } = args;

    try {
      const sourceValidation = await this.validator.validateOperation('move', sourcePath);
      if (!sourceValidation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot move source file: ${sourceValidation.reason}`,
          }],
        };
      }

      const destValidation = await this.validator.validatePath(destinationPath);
      if (!destValidation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid destination path: ${destValidation.error}`,
          }],
        };
      }

      // Check if destination exists
      const destExists = await this.validator.pathExists(destValidation.resolvedPath);
      if (destExists && !overwrite) {
        return {
          content: [{
            type: 'text',
            text: `❌ Destination already exists. Set "overwrite": true to replace.`,
          }],
        };
      }

      // Ensure destination directory exists
      const destDir = dirname(destValidation.resolvedPath);
      await mkdir(destDir, { recursive: true });

      await rename(sourceValidation.resolvedPath, destValidation.resolvedPath);

      return {
        content: [{
          type: 'text',
          text: `✅ File moved successfully:\n📤 From: ${sourcePath}\n📥 To: ${destinationPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error moving file: ${error.message}`,
        }],
      };
    }
  }

  async copyFile(args) {
    const { sourcePath, destinationPath, overwrite = false } = args;

    try {
      const sourceValidation = await this.validator.validateOperation('read', sourcePath);
      if (!sourceValidation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot read source file: ${sourceValidation.reason}`,
          }],
        };
      }

      const destValidation = await this.validator.validatePath(destinationPath);
      if (!destValidation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid destination path: ${destValidation.error}`,
          }],
        };
      }

      // Check if destination exists
      const destExists = await this.validator.pathExists(destValidation.resolvedPath);
      if (destExists && !overwrite) {
        return {
          content: [{
            type: 'text',
            text: `❌ Destination already exists. Set "overwrite": true to replace.`,
          }],
        };
      }

      // Ensure destination directory exists
      const destDir = dirname(destValidation.resolvedPath);
      await mkdir(destDir, { recursive: true });

      // Check file size for streaming decision
      const sizeCheck = await this.validator.validateFileSize(sourceValidation.resolvedPath);
      if (!sizeCheck.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ ${sizeCheck.error}`,
          }],
        };
      }

      // Use streaming for larger files
      if (sizeCheck.size > 1024 * 1024) { // 1MB
        const readStream = createReadStream(sourceValidation.resolvedPath);
        const writeStream = createWriteStream(destValidation.resolvedPath);
        await pipeline(readStream, writeStream);
      } else {
        await copyFile(sourceValidation.resolvedPath, destValidation.resolvedPath);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ File copied successfully:\n📤 From: ${sourcePath}\n📥 To: ${destinationPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error copying file: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Directory operation handlers
   */

  async listDirectory(args) {
    const { 
      path = '.', 
      includeHidden = false, 
      recursive = false,
      limit = 100,
      offset = 0,
      sortBy = 'name',
      sortOrder = 'asc',
      minSize,
      maxSize,
      modifiedAfter,
      modifiedBefore,
      type,
      fileExtensions
    } = args;

    try {
      const validation = await this.validator.validatePath(path);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid directory path: ${validation.error}`,
          }],
        };
      }

      // Get all entries
      const allEntries = await this.listDirectoryRecursive(
        validation.resolvedPath,
        includeHidden,
        recursive,
        path
      );

      // Flatten entries for filtering and sorting
      const flatEntries = this.flattenDirectoryEntries(allEntries);

      // Apply filters
      let filteredEntries = this.filterDirectoryEntries(flatEntries, {
        minSize,
        maxSize,
        modifiedAfter,
        modifiedBefore,
        type,
        fileExtensions
      });

      // Sort entries
      filteredEntries = this.sortDirectoryEntries(filteredEntries, sortBy, sortOrder);

      // Apply pagination
      const totalMatches = filteredEntries.length;
      const paginatedEntries = filteredEntries.slice(offset, offset + limit);
      const hasMore = offset + limit < totalMatches;

      const response = {
        entries: paginatedEntries,
        metadata: {
          totalMatches,
          returnedMatches: paginatedEntries.length,
          limit,
          offset,
          hasMore,
          sortBy,
          sortOrder,
        }
      };

      if (hasMore) {
        response.metadata.nextOffset = offset + limit;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error listing directory: ${error.message}`,
        }],
      };
    }
  }

  async listDirectoryRecursive(dirPath, includeHidden, recursive, relativeTo) {
    const entries = [];
    const items = await readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (!includeHidden && item.name.startsWith('.')) {
        continue;
      }

      const fullPath = join(dirPath, item.name);
      const stats = await stat(fullPath);
      const relativePath = join(relativeTo, item.name);

      const entry = {
        name: item.name,
        path: relativePath,
        type: item.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      };

      if (item.isFile()) {
        entry.extension = extname(item.name);
      }

      entries.push(entry);

      if (recursive && item.isDirectory()) {
        entry.children = await this.listDirectoryRecursive(
          fullPath,
          includeHidden,
          recursive,
          relativePath
        );
      }
    }

    return entries;
  }

  async createDirectory(args) {
    const { directoryPath, recursive = true } = args;

    try {
      const validation = await this.validator.validatePath(directoryPath);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid directory path: ${validation.error}`,
          }],
        };
      }

      await mkdir(validation.resolvedPath, { recursive });

      return {
        content: [{
          type: 'text',
          text: `✅ Directory created successfully: ${directoryPath}`,
        }],
      };
    } catch (error) {
      if (error.code === 'EEXIST') {
        return {
          content: [{
            type: 'text',
            text: `⚠️  Directory already exists: ${directoryPath}`,
          }],
        };
      }
      return {
        content: [{
          type: 'text',
          text: `❌ Error creating directory: ${error.message}`,
        }],
      };
    }
  }

  async deleteDirectory(args) {
    const { directoryPath, recursive = false, confirmed = false } = args;

    try {
      const validation = await this.validator.validateOperation('delete', directoryPath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot delete directory: ${validation.reason}`,
          }],
        };
      }

      if (!confirmed) {
        const entries = await readdir(validation.resolvedPath);
        return {
          content: [{
            type: 'text',
            text: `⚠️  Confirmation required to delete directory:\n📁 ${directoryPath}\n📊 Contains ${entries.length} items\n\nSet "confirmed": true to proceed with deletion.`,
          }],
        };
      }

      if (recursive) {
        // Recursive delete using fs promises
        await rmdir(validation.resolvedPath, { recursive: true });
      } else {
        await rmdir(validation.resolvedPath);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Directory deleted successfully: ${directoryPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error deleting directory: ${error.message}`,
        }],
      };
    }
  }

  async moveDirectory(args) {
    const { sourcePath, destinationPath, overwrite = false } = args;

    try {
      const sourceValidation = await this.validator.validateOperation('move', sourcePath);
      if (!sourceValidation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot move source directory: ${sourceValidation.reason}`,
          }],
        };
      }

      const destValidation = await this.validator.validatePath(destinationPath);
      if (!destValidation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid destination path: ${destValidation.error}`,
          }],
        };
      }

      // Check if destination exists
      const destExists = await this.validator.pathExists(destValidation.resolvedPath);
      if (destExists && !overwrite) {
        return {
          content: [{
            type: 'text',
            text: `❌ Destination already exists. Set "overwrite": true to replace.`,
          }],
        };
      }

      // Ensure destination parent directory exists
      const destDir = dirname(destValidation.resolvedPath);
      await mkdir(destDir, { recursive: true });

      await rename(sourceValidation.resolvedPath, destValidation.resolvedPath);

      return {
        content: [{
          type: 'text',
          text: `✅ Directory moved successfully:\n📤 From: ${sourcePath}\n📥 To: ${destinationPath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error moving directory: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Search tool implementations
   */

  async searchFiles(args) {
    const { 
      pattern, 
      directoryPath = '.', 
      recursive = true, 
      caseSensitive = false,
      // Pagination
      limit = 100,
      offset = 0,
      // Sorting
      sortBy = 'path',
      sortOrder = 'asc',
      // Filtering
      minSize,
      maxSize,
      modifiedAfter,
      modifiedBefore,
      excludePatterns = []
    } = args;

    try {
      const validation = await this.validator.validatePath(directoryPath);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid directory path: ${validation.error}`,
          }],
        };
      }

      // Validate limit
      const finalLimit = Math.min(Math.max(1, limit), 1000);
      const finalOffset = Math.max(0, offset);

      // Collect all results first
      const allResults = await this.searchFilesRecursive(
        validation.resolvedPath,
        pattern,
        recursive,
        caseSensitive,
        directoryPath,
        {
          minSize,
          maxSize,
          modifiedAfter: modifiedAfter ? new Date(modifiedAfter) : null,
          modifiedBefore: modifiedBefore ? new Date(modifiedBefore) : null,
          excludePatterns
        }
      );

      // Sort results
      const sortedResults = this.sortFileResults(allResults, sortBy, sortOrder);

      // Apply pagination
      const totalMatches = sortedResults.length;
      const paginatedResults = sortedResults.slice(finalOffset, finalOffset + finalLimit);
      const hasMore = (finalOffset + finalLimit) < totalMatches;
      const nextOffset = hasMore ? finalOffset + finalLimit : null;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            pattern,
            searchPath: directoryPath,
            totalMatches,
            returnedMatches: paginatedResults.length,
            offset: finalOffset,
            limit: finalLimit,
            hasMore,
            nextOffset,
            sortBy,
            sortOrder,
            matches: paginatedResults,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error searching files: ${error.message}`,
        }],
      };
    }
  }

  async searchFilesRecursive(dirPath, pattern, recursive, caseSensitive, baseDir, filters = {}) {
    const results = [];
    const MAX_RESULTS = 10000; // Stop after finding 10k files to prevent memory issues
    
    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      
      // Convert pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(regexPattern, caseSensitive ? '' : 'i');

      // Convert exclude patterns to regexes
      const excludeRegexes = (filters.excludePatterns || []).map(excludePattern => {
        const excludeRegexPattern = excludePattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(excludeRegexPattern, 'i');
      });

      for (const item of items) {
        const fullPath = join(dirPath, item.name);
        const relativePath = join(baseDir, item.name);

        // Check if path matches any exclude pattern
        const isExcluded = excludeRegexes.some(excludeRegex => excludeRegex.test(relativePath));
        if (isExcluded) continue;

        if (item.isFile() && regex.test(item.name)) {
          const stats = await stat(fullPath);
          
          // Apply filters
          if (filters.minSize !== undefined && stats.size < filters.minSize) continue;
          if (filters.maxSize !== undefined && stats.size > filters.maxSize) continue;
          if (filters.modifiedAfter && stats.mtime < filters.modifiedAfter) continue;
          if (filters.modifiedBefore && stats.mtime > filters.modifiedBefore) continue;

          results.push({
            path: relativePath,
            name: item.name,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
          });

          // Stop if we've found too many results
          if (results.length >= MAX_RESULTS) {
            return results;
          }
        }

        if (recursive && item.isDirectory() && !item.name.startsWith('.')) {
          const subResults = await this.searchFilesRecursive(
            fullPath,
            pattern,
            recursive,
            caseSensitive,
            relativePath,
            filters
          );
          results.push(...subResults);
          
          // Stop if we've found too many results
          if (results.length >= MAX_RESULTS) {
            return results.slice(0, MAX_RESULTS);
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return results;
  }

  sortFileResults(results, sortBy, sortOrder) {
    const sorted = [...results];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'path':
          aValue = a.path.toLowerCase();
          bValue = b.path.toLowerCase();
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'lastModified':
          aValue = new Date(a.lastModified);
          bValue = new Date(b.lastModified);
          break;
        default:
          aValue = a.path.toLowerCase();
          bValue = b.path.toLowerCase();
      }
      
      if (sortBy === 'size' || sortBy === 'lastModified') {
        // Numeric/date comparison
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      } else {
        // String comparison
        if (sortOrder === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
    });
    
    return sorted;
  }

  /**
   * Directory listing helper methods
   */
  flattenDirectoryEntries(entries, parentPath = '') {
    const flattened = [];
    
    for (const entry of entries) {
      const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      const flatEntry = {
        ...entry,
        fullPath,
      };
      
      flattened.push(flatEntry);
      
      if (entry.children && entry.children.length > 0) {
        flattened.push(...this.flattenDirectoryEntries(entry.children, entry.path));
      }
    }
    
    return flattened;
  }

  filterDirectoryEntries(entries, filters) {
    return entries.filter(entry => {
      // Type filter
      if (filters.type && entry.type !== filters.type) {
        return false;
      }
      
      // Size filters (only for files)
      if (entry.type === 'file') {
        if (filters.minSize !== undefined && entry.size < filters.minSize) {
          return false;
        }
        if (filters.maxSize !== undefined && entry.size > filters.maxSize) {
          return false;
        }
      }
      
      // Date filters
      if (filters.modifiedAfter) {
        const modifiedDate = new Date(entry.lastModified);
        const afterDate = new Date(filters.modifiedAfter);
        if (modifiedDate < afterDate) {
          return false;
        }
      }
      
      if (filters.modifiedBefore) {
        const modifiedDate = new Date(entry.lastModified);
        const beforeDate = new Date(filters.modifiedBefore);
        if (modifiedDate > beforeDate) {
          return false;
        }
      }
      
      // File extension filter
      if (filters.fileExtensions && filters.fileExtensions.length > 0 && entry.type === 'file') {
        const hasValidExtension = filters.fileExtensions.some(ext => {
          const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
          return entry.extension === normalizedExt;
        });
        if (!hasValidExtension) {
          return false;
        }
      }
      
      return true;
    });
  }

  sortDirectoryEntries(entries, sortBy, sortOrder) {
    const sorted = [...entries];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'lastModified':
          aValue = new Date(a.lastModified);
          bValue = new Date(b.lastModified);
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortBy === 'size' || sortBy === 'lastModified') {
        // Numeric/date comparison
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      } else {
        // String comparison
        if (sortOrder === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
    });
    
    return sorted;
  }

  sortSearchResults(results, sortBy, sortOrder) {
    const sorted = [...results];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'relevance':
          // Sort by total occurrences (most relevant = most occurrences)
          aValue = a.totalOccurrences;
          bValue = b.totalOccurrences;
          break;
        case 'filePath':
          aValue = a.filePath.toLowerCase();
          bValue = b.filePath.toLowerCase();
          break;
        case 'lineNumber':
          // Sort by first match line number
          aValue = a.matches[0]?.lineNumber || 0;
          bValue = b.matches[0]?.lineNumber || 0;
          break;
        case 'occurrences':
          aValue = a.totalOccurrences;
          bValue = b.totalOccurrences;
          break;
        default:
          aValue = a.totalOccurrences;
          bValue = b.totalOccurrences;
      }
      
      if (sortBy === 'relevance' || sortBy === 'occurrences' || sortBy === 'lineNumber') {
        // Numeric comparison
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      } else {
        // String comparison
        if (sortOrder === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
    });
    
    return sorted;
  }

  async searchInFiles(args) {
    const { 
      searchText, 
      directoryPath = '.', 
      filePattern = '*',
      caseSensitive = false,
      limit = 100,
      offset = 0,
      sortBy = 'relevance',
      sortOrder = 'desc',
      modifiedAfter,
      modifiedBefore,
      minFileSize,
      maxFileSize,
      includeLineNumbers = true,
      contextLines = 0
    } = args;

    try {
      const validation = await this.validator.validatePath(directoryPath);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid directory path: ${validation.error}`,
          }],
        };
      }

      // First, find all matching files with filters
      const filters = {
        minSize: minFileSize,
        maxSize: maxFileSize,
        modifiedAfter,
        modifiedBefore
      };
      
      const files = await this.searchFilesRecursive(
        validation.resolvedPath,
        filePattern,
        true,
        false,
        directoryPath,
        filters
      );

      const allResults = [];
      const searchRegex = new RegExp(
        searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        caseSensitive ? 'g' : 'gi'
      );

      // Search in each file
      for (const file of files) {
        try {
          const filePath = join(validation.resolvedPath, file.path.replace(directoryPath + '/', ''));
          const content = await readFile(filePath, 'utf8');
          const lines = content.split('\n');
          
          const fileMatches = [];
          lines.forEach((line, index) => {
            const lineMatches = [...line.matchAll(searchRegex)];
            if (lineMatches.length > 0) {
              const match = {
                lineNumber: index + 1,
                lineContent: line.trim(),
                occurrences: lineMatches.length,
              };
              
              // Add context lines if requested
              if (contextLines > 0) {
                match.context = {
                  before: [],
                  after: []
                };
                
                // Get lines before
                for (let i = Math.max(0, index - contextLines); i < index; i++) {
                  match.context.before.push({
                    lineNumber: i + 1,
                    content: lines[i]
                  });
                }
                
                // Get lines after
                for (let i = index + 1; i < Math.min(lines.length, index + 1 + contextLines); i++) {
                  match.context.after.push({
                    lineNumber: i + 1,
                    content: lines[i]
                  });
                }
              }
              
              fileMatches.push(match);
            }
          });

          if (fileMatches.length > 0) {
            allResults.push({
              filePath: file.path,
              fileSize: file.size,
              lastModified: file.lastModified,
              totalOccurrences: fileMatches.reduce((sum, m) => sum + m.occurrences, 0),
              matchCount: fileMatches.length,
              matches: includeLineNumbers ? fileMatches : fileMatches.map(m => ({
                lineContent: m.lineContent,
                occurrences: m.occurrences,
                context: m.context
              }))
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      // Sort results
      const sortedResults = this.sortSearchResults(allResults, sortBy, sortOrder);
      
      // Apply pagination
      const totalMatches = sortedResults.length;
      const paginatedResults = sortedResults.slice(offset, offset + limit);
      const hasMore = offset + limit < totalMatches;

      const response = {
        searchText,
        searchPath: directoryPath,
        filePattern,
        totalFiles: totalMatches,
        returnedFiles: paginatedResults.length,
        totalOccurrences: allResults.reduce((sum, r) => sum + r.totalOccurrences, 0),
        limit,
        offset,
        hasMore,
        sortBy,
        sortOrder,
        results: paginatedResults
      };

      if (hasMore) {
        response.nextOffset = offset + limit;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error searching in files: ${error.message}`,
        }],
      };
    }
  }

  async analyzeProject(args) {
    const { 
      rootPath = '.',
      includeEmbeddings = false,
      maxDepth = 5,
      filePattern = '*',
      offset = 0,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc',
      includeHidden = false,
      minSize,
      maxSize
    } = args;

    try {
      const validation = await this.validator.validatePath(rootPath);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid root path: ${validation.error}`,
          }],
        };
      }

      // Lazy load metadata extractor
      if (!this.metadataExtractor) {
        const { FileMetadataExtractor } = await import('./metadata-extractor.js');
        this.metadataExtractor = new FileMetadataExtractor();
      }

      const structure = await this.analyzeDirectoryStructure(
        validation.resolvedPath,
        rootPath,
        0,
        maxDepth,
        filePattern,
        includeEmbeddings,
        {
          offset,
          limit,
          sortBy,
          sortOrder,
          includeHidden,
          minSize,
          maxSize
        }
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            rootPath,
            timestamp: new Date().toISOString(),
            queryOptions: {
              sortBy,
              sortOrder,
              includeHidden,
              filePattern,
              maxDepth,
              minSize,
              maxSize
            },
            pagination: {
              offset,
              limit,
              totalItems: structure.pagination?.totalChildren || 0,
              hasMore: structure.pagination?.hasMore || false,
              nextOffset: structure.pagination?.nextOffset
            },
            structure,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error analyzing project: ${error.message}`,
        }],
      };
    }
  }

  async analyzeDirectoryStructure(dirPath, relativePath, currentDepth, maxDepth, filePattern, includeEmbeddings, options = {}) {
    const {
      offset = 0,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc',
      includeHidden = false,
      minSize,
      maxSize
    } = options;
    if (currentDepth > maxDepth) {
      return { truncated: true };
    }

    const structure = {
      name: basename(relativePath),
      path: relativePath,
      type: 'directory',
      children: [],
      stats: {
        fileCount: 0,
        directoryCount: 0,
        totalSize: 0,
      },
      pagination: {
        offset,
        limit,
        totalChildren: 0,
        hasMore: false,
      },
    };

    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      const allChildren = [];
      
      // First pass: collect all items with stats
      for (const item of items) {
        // Skip hidden files unless requested
        if (!includeHidden && item.name.startsWith('.')) continue;

        const fullPath = join(dirPath, item.name);
        const itemRelativePath = join(relativePath, item.name);

        if (item.isDirectory()) {
          structure.stats.directoryCount++;
          const subStructure = await this.analyzeDirectoryStructure(
            fullPath,
            itemRelativePath,
            currentDepth + 1,
            maxDepth,
            filePattern,
            includeEmbeddings,
            options
          );
          
          const directoryItem = {
            ...subStructure,
            depth: currentDepth + 1,
            lastModified: (await stat(fullPath)).mtime,
            sortKey: this.getSortKey(subStructure, sortBy)
          };
          
          allChildren.push(directoryItem);
          structure.stats.fileCount += subStructure.stats?.fileCount || 0;
          structure.stats.totalSize += subStructure.stats?.totalSize || 0;
          
        } else if (item.isFile()) {
          // Check if file matches pattern
          const regexPattern = '^' + filePattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.') + '$';
          const regex = new RegExp(regexPattern, 'i');

          if (regex.test(item.name)) {
            const stats = await stat(fullPath);
            
            // Apply size filters
            if (minSize !== undefined && stats.size < minSize) continue;
            if (maxSize !== undefined && stats.size > maxSize) continue;
            
            structure.stats.fileCount++;
            structure.stats.totalSize += stats.size;

            const fileInfo = {
              name: item.name,
              path: itemRelativePath,
              type: 'file',
              size: stats.size,
              lastModified: stats.mtime,
              lastModifiedISO: stats.mtime.toISOString(),
              extension: extname(item.name),
              depth: currentDepth + 1,
            };

            // Add metadata for code files
            if (this.metadataExtractor.supportedExtensions.includes(fileInfo.extension)) {
              try {
                const content = await readFile(fullPath, 'utf8');
                fileInfo.metadata = await this.metadataExtractor.extractMetadata(content, itemRelativePath);

                // Add embeddings if requested
                if (includeEmbeddings) {
                  if (!this.embeddingManager) {
                    const { LocalEmbeddingManager } = await import('./embedding-manager.js');
                    this.embeddingManager = new LocalEmbeddingManager();
                    await this.embeddingManager.initialize();
                  }
                  const embedding = await this.embeddingManager.generateEmbedding(content, itemRelativePath);
                  fileInfo.embedding = embedding.vector;
                }
              } catch (error) {
                fileInfo.metadataError = error.message;
              }
            }

            // Add sort key for this file
            fileInfo.sortKey = this.getSortKey(fileInfo, sortBy);
            allChildren.push(fileInfo);
          }
        }
      }
      
      // Sort all children
      this.sortItems(allChildren, sortBy, sortOrder);
      
      // Apply pagination
      structure.pagination.totalChildren = allChildren.length;
      structure.pagination.hasMore = offset + limit < allChildren.length;
      structure.pagination.nextOffset = structure.pagination.hasMore ? offset + limit : null;
      
      // Clean up sort keys and lastModified objects before return
      const children = allChildren.slice(offset, offset + limit).map(child => {
        const cleanChild = { ...child };
        delete cleanChild.sortKey;
        if (cleanChild.lastModified && cleanChild.lastModifiedISO) {
          cleanChild.lastModified = cleanChild.lastModifiedISO;
          delete cleanChild.lastModifiedISO;
        }
        return cleanChild;
      });
      
      structure.children = children;
    } catch (error) {
      structure.error = error.message;
    }

    return structure;
  }

  /**
   * Get sort key for an item based on sort field
   */
  getSortKey(item, sortBy) {
    switch (sortBy) {
      case 'name':
        return item.name ? item.name.toLowerCase() : '';
      case 'size':
        return item.size || 0;
      case 'lastModified':
        return item.lastModified ? new Date(item.lastModified).getTime() : 0;
      case 'type':
        return item.type === 'directory' ? 0 : 1; // Directories first
      case 'depth':
        return item.depth || 0;
      default:
        return item.name ? item.name.toLowerCase() : '';
    }
  }

  /**
   * Sort items array in place
   */
  sortItems(items, sortBy, sortOrder) {
    const multiplier = sortOrder === 'desc' ? -1 : 1;
    
    items.sort((a, b) => {
      const aKey = a.sortKey;
      const bKey = b.sortKey;
      
      if (typeof aKey === 'string' && typeof bKey === 'string') {
        return aKey.localeCompare(bKey) * multiplier;
      }
      
      if (aKey < bKey) return -1 * multiplier;
      if (aKey > bKey) return 1 * multiplier;
      return 0;
    });
  }

  async findSimilarFiles(args) {
    const { referencePath, searchPath = '.', topK = 10, threshold = 0.7 } = args;

    try {
      // Validate reference file
      const refValidation = await this.validator.validateOperation('read', referencePath);
      if (!refValidation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot read reference file: ${refValidation.reason}`,
          }],
        };
      }

      // Validate search path
      const searchValidation = await this.validator.validatePath(searchPath);
      if (!searchValidation.valid) {
        return {
          content: [{
            type: 'text',
            text: `❌ Invalid search path: ${searchValidation.error}`,
          }],
        };
      }

      // Initialize embedding manager
      if (!this.embeddingManager) {
        const { LocalEmbeddingManager } = await import('./embedding-manager.js');
        this.embeddingManager = new LocalEmbeddingManager();
        await this.embeddingManager.initialize();
      }

      // Generate embedding for reference file
      const refContent = await readFile(refValidation.resolvedPath, 'utf8');
      const refEmbedding = await this.embeddingManager.generateEmbedding(refContent, referencePath);

      // Find all code files in search path
      const files = await this.searchFilesRecursive(
        searchValidation.resolvedPath,
        '*',
        true,
        false,
        searchPath
      );

      // Filter to supported file types
      const codeFiles = files.filter(file => {
        const ext = extname(file.name);
        return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
      });

      // Generate embeddings for all files
      const fileEmbeddings = [];
      for (const file of codeFiles) {
        if (file.path === referencePath) continue; // Skip reference file

        try {
          const filePath = join(searchValidation.resolvedPath, file.path.replace(searchPath + '/', ''));
          const content = await readFile(filePath, 'utf8');
          const embedding = await this.embeddingManager.generateEmbedding(content, file.path);
          
          fileEmbeddings.push({
            path: file.path,
            vector: embedding.vector,
          });
        } catch (error) {
          // Skip files that can't be read
        }
      }

      // Find similar files using high-performance vector operations
      const similarFiles = await this.embeddingManager.findSimilar(
        refEmbedding.vector,
        fileEmbeddings,
        topK,
        threshold
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            referenceFile: referencePath,
            searchPath,
            similarityThreshold: threshold,
            foundCount: similarFiles.length,
            similarFiles,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error finding similar files: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Extract snippet with safety checks
   */
  async extractSnippet(args) {
    try {
      // Validate file path
      const validation = await this.validator.validateOperation('read', args.filePath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot read file: ${validation.reason}`,
          }],
        };
      }

      // Lazy load snippet manager
      if (!this.snippetManager) {
        const { SnippetManager } = await import('./snippet-manager.js');
        this.snippetManager = new SnippetManager();
      }

      // Extract snippet
      const result = await this.snippetManager.extractSnippet({
        ...args,
        filePath: validation.resolvedPath,
      });

      // Format response
      if (result.requiresConfirmation) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            snippet: result.snippet,
            metadata: result.metadata,
            safetyCheck: result.safetyCheck,
            auditInfo: {
              sharedAt: new Date().toISOString(),
              sharingLevel: args.sharingLevel,
              confirmed: true,
            },
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error extracting snippet: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Request editing help with smart escalation
   */
  async requestEditingHelp(args) {
    try {
      // Validate file path
      const validation = await this.validator.validateOperation('read', args.filePath);
      if (!validation.allowed) {
        return {
          content: [{
            type: 'text',
            text: `❌ Cannot read file: ${validation.reason}`,
          }],
        };
      }

      // Lazy load snippet manager
      if (!this.snippetManager) {
        const { SnippetManager } = await import('./snippet-manager.js');
        this.snippetManager = new SnippetManager();
      }

      // Request help
      const result = await this.snippetManager.requestEditingHelp({
        ...args,
        filePath: validation.resolvedPath,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error requesting help: ${error.message}`,
        }],
      };
    }
  }

  /**
   * Register all tools with the MCP server
   * @param {Object} server - MCP server instance
   */
  registerWithServer(server) {
    // This will be called from server.js to register all tools
    return this.tools;
  }

  /**
   * Get all tool definitions
   * @returns {Array} Array of tool definitions
   */
  getTools() {
    return this.tools;
  }

  /**
   * Handle tool call
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool response
   */
  async handleToolCall(toolName, args) {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    return await tool.handler(args);
  }
}