import path from 'path';
import { access, stat } from 'fs/promises';
import { constants } from 'fs';
import { LIMITS } from './constants.js';

const { resolve, relative, join, dirname } = path;

// Store process reference at module level to avoid conflicts
const nodeProcess = process;

/**
 * Security validator for filesystem operations
 * Ensures all paths are safe and within allowed boundaries
 */
export class SecurityValidator {
  constructor(options = {}) {
    // Default to current working directory as root
    this.rootPath = resolve(options.rootPath || nodeProcess.cwd());
    this.maxFileSize = options.maxFileSize || LIMITS.MAX_FILE_SIZE;
    this.allowedExtensions = options.allowedExtensions || null; // null = all allowed
    this.blockedPatterns = [
      /^\./,           // Hidden files/directories
      /node_modules/,  // Dependencies
      /\.git/,         // Git directory
      /\.env/,         // Environment files
      /\.(key|pem|cert|crt)$/, // Certificates and keys
    ];
  }

  /**
   * Validates and resolves a path, ensuring it's within allowed boundaries
   * @param {string} inputPath - Path to validate
   * @returns {{valid: boolean, resolvedPath?: string, error?: string}}
   */
  validatePath(inputPath) {
    try {
      // Resolve the path relative to root
      const resolvedPath = resolve(this.rootPath, inputPath);
      
      // Check if path is within root directory
      const relativePath = relative(this.rootPath, resolvedPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return {
          valid: false,
          error: 'Path traversal detected - access denied',
        };
      }

      // Check against blocked patterns
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(relativePath)) {
          return {
            valid: false,
            error: `Access to ${pattern.toString()} is blocked`,
          };
        }
      }

      // Check file extension if restrictions are set
      if (this.allowedExtensions && this.allowedExtensions.length > 0) {
        const ext = path.extname(resolvedPath).toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
          return {
            valid: false,
            error: `File extension ${ext} is not allowed`,
          };
        }
      }

      return {
        valid: true,
        resolvedPath,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Path validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validates file size
   * @param {string} filePath - Path to file
   * @returns {Promise<{valid: boolean, size?: number, error?: string}>}
   */
  async validateFileSize(filePath) {
    try {
      const stats = await stat(filePath);
      const size = stats.size;
      
      if (size > this.maxFileSize) {
        return {
          valid: false,
          size,
          error: `File size ${size} bytes exceeds maximum allowed size of ${this.maxFileSize} bytes`,
        };
      }

      return {
        valid: true,
        size,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to check file size: ${error.message}`,
      };
    }
  }

  /**
   * Checks if path exists and is accessible
   * @param {string} filePath - Path to check
   * @param {number} mode - Access mode (default: read)
   * @returns {Promise<boolean>}
   */
  async pathExists(filePath, mode = constants.R_OK) {
    try {
      await access(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes a filename to prevent directory traversal
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    if (!filename) return 'file';
    
    // Remove any path separators and parent directory references
    return filename
      .replace(/[\/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\./, '_')
      .substring(0, 255); // Limit length
  }

  /**
   * Validates operation permissions
   * @param {string} operation - Operation type (create, read, update, delete)
   * @param {string} filePath - Target file path
   * @returns {Promise<{allowed: boolean, requiresConfirmation?: boolean, reason?: string}>}
   */
  async validateOperation(operation, filePath) {
    const pathValidation = this.validatePath(filePath);
    if (!pathValidation.valid) {
      return {
        allowed: false,
        reason: pathValidation.error,
      };
    }

    // Destructive operations require confirmation
    const destructiveOps = ['delete', 'update', 'move'];
    const requiresConfirmation = destructiveOps.includes(operation);

    // Check if file exists for operations that require it
    const requiresExistence = ['read', 'update', 'delete', 'move'];
    if (requiresExistence.includes(operation)) {
      const exists = await this.pathExists(pathValidation.resolvedPath);
      if (!exists) {
        return {
          allowed: false,
          reason: 'File or directory does not exist',
        };
      }
    }

    // Check if path already exists for create operations
    if (operation === 'create') {
      const exists = await this.pathExists(pathValidation.resolvedPath);
      if (exists) {
        return {
          allowed: false,
          reason: 'File or directory already exists',
        };
      }
    }

    return {
      allowed: true,
      requiresConfirmation,
      resolvedPath: pathValidation.resolvedPath,
    };
  }

  /**
   * Creates a safe backup path for a file
   * @param {string} filePath - Original file path
   * @returns {string} Backup file path
   */
  createBackupPath(filePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = dirname(filePath);
    const filename = path.basename(filePath);
    return join(dir, `.backup-${timestamp}-${filename}`);
  }
}

// Export a default instance
export const defaultValidator = new SecurityValidator();