import { UniversalSandbox } from './UniversalSandbox.js';
import { promises as fs, writeFileSync } from 'fs';

/**
 * Security Initialization Module
 * Sets up the Universal Sandbox and security policies for the MCP server
 */

let globalSandbox = null;

/**
 * Initialize security systems for the MCP server
 */
export function initializeSecurity(options = {}) {
  const config = {
    // Security mode: monitor, warn, or block
    mode: process.env.MCP_SECURITY_MODE || 'block',
    
    // Enable/disable the universal sandbox
    enabled: process.env.MCP_SECURITY_ENABLED !== 'false',
    
    // Performance optimizations
    performanceOptimization: true,
    
    // Bypass trusted tools during transition
    bypassTrustedTools: process.env.MCP_BYPASS_TRUSTED !== 'false',
    
    // Custom security policies
    customPolicies: {},
    
    ...options,
  };

  // Security framework initialization - logged through security events

  if (config.enabled) {
    globalSandbox = new UniversalSandbox(config);
    
    // Set up security event handlers
    setupSecurityEventHandlers();
    
    // Set up graceful shutdown
    setupGracefulShutdown();
    
    // Security framework initialized - logged through security events
  } else {
    // Security framework disabled - no logging needed for disabled state
  }

  return globalSandbox;
}

/**
 * Get the global security sandbox instance
 */
export function getSecuritySandbox() {
  return globalSandbox;
}

/**
 * Setup security event handlers
 */
function setupSecurityEventHandlers() {
  // Handle uncaught exceptions that might be security related
  process.on('uncaughtException', (error) => {
    if (globalSandbox && error.message.includes('Universal Sandbox')) {
      // Log to security audit only - no console output in production
      globalSandbox.logSecurityEvent('UNCAUGHT_EXCEPTION', 'unknown', [], error.message);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    if (globalSandbox && reason && reason.toString().includes('security')) {
      // Log to security audit only - no console output in production
      globalSandbox.logSecurityEvent('UNHANDLED_REJECTION', 'unknown', [], reason.toString());
    }
  });
}

/**
 * Setup graceful shutdown procedures
 */
function setupGracefulShutdown() {
  const shutdown = (signal) => {
    if (globalSandbox) {
      globalSandbox.logSecurityEvent('SHUTDOWN', 'system', [], `Received ${signal}, shutting down security framework`);
      
      // Export audit log before shutdown
      const metrics = globalSandbox.getSecurityMetrics();
      globalSandbox.logSecurityEvent('METRICS', 'system', [], `Final metrics: ${JSON.stringify(metrics)}`);
      
      // Optionally export audit log
      if (process.env.MCP_EXPORT_AUDIT_ON_EXIT === 'true') {
        try {
          const MAX_AUDIT_ENTRIES = 1000;
          const auditLog = globalSandbox.getAuditLog(MAX_AUDIT_ENTRIES);
          writeFileSync(
            `./security-audit-${Date.now()}.json`,
            JSON.stringify(auditLog, null, 2),
          );
          globalSandbox.logSecurityEvent('EXPORT', 'system', [], 'Security audit log exported');
        } catch (error) {
          globalSandbox.logSecurityEvent('ERROR', 'system', [], `Failed to export audit log: ${error.message}`);
        }
      }
      
      // Disable sandbox
      globalSandbox.disable();
    }
    
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Security middleware for MCP tools
 * Provides additional security context for tool execution
 */
export function createSecurityMiddleware(toolName) {
  return (originalHandler) => {
    return async (args) => {
      const startTime = Date.now();
      
      try {
        // Add security context to the execution
        const ARGS_TRUNCATE_LENGTH = 200;
        const securityContext = {
          tool: toolName,
          timestamp: new Date().toISOString(),
          args: JSON.stringify(args).substring(0, ARGS_TRUNCATE_LENGTH), // Truncate for logging
          sandbox: globalSandbox ? 'enabled' : 'disabled',
        };

        // Log tool execution start with security context
        if (globalSandbox) {
          globalSandbox.logSecurityEvent('TOOL_START', toolName, [securityContext.args], `Tool execution started at ${securityContext.timestamp}`);
        }

        // Execute the original handler
        const result = await originalHandler(args);

        // Log successful completion
        if (globalSandbox) {
          const duration = Date.now() - startTime;
          globalSandbox.logSecurityEvent('TOOL_SUCCESS', toolName, [], `Tool completed in ${duration}ms`);
        }

        return result;

      } catch (error) {
        // Log tool execution failure
        if (globalSandbox) {
          const duration = Date.now() - startTime;
          globalSandbox.logSecurityEvent('TOOL_ERROR', toolName, [], `Tool failed in ${duration}ms: ${error.message}`);
        }

        throw error;
      }
    };
  };
}

/**
 * Security configuration validation
 */
export function validateSecurityConfig(config) {
  const validModes = ['monitor', 'warn', 'block'];
  
  if (config.mode && !validModes.includes(config.mode)) {
    throw new Error(`Invalid security mode: ${config.mode}. Must be one of: ${validModes.join(', ')}`);
  }

  // Note: Security configuration validation completed

  return true;
}

/**
 * Get security status for monitoring/debugging
 */
export function getSecurityStatus() {
  if (!globalSandbox) {
    return {
      enabled: false,
      message: 'Security framework not initialized'
    };
  }

  const metrics = globalSandbox.getSecurityMetrics();
  const RECENT_EVENTS_LIMIT = 10;
  const recentEvents = globalSandbox.getAuditLog(RECENT_EVENTS_LIMIT);

  return {
    enabled: true,
    mode: globalSandbox.options.mode,
    metrics,
    recentEvents,
    uptime: process.uptime()
  };
}

/**
 * Emergency security disable (for debugging only)
 */
export function emergencyDisableSecurity() {
  if (globalSandbox) {
    globalSandbox.logSecurityEvent('EMERGENCY_DISABLE', 'system', [], 'Emergency security disable triggered');
    globalSandbox.disable();
  }
  
  return 'Security framework disabled';
}

/**
 * Export current audit log
 */
export async function exportAuditLog(filePath) {
  if (!globalSandbox) {
    throw new Error('Security framework not initialized');
  }

  const auditData = {
    exported: new Date().toISOString(),
    metrics: globalSandbox.getSecurityMetrics(),
    auditLog: globalSandbox.getAuditLog(),
  };

  await fs.writeFile(filePath, JSON.stringify(auditData, null, 2));
  
  return `Audit log exported to ${filePath}`;
}

export default {
  initializeSecurity,
  getSecuritySandbox,
  createSecurityMiddleware,
  validateSecurityConfig,
  getSecurityStatus,
  emergencyDisableSecurity,
  exportAuditLog
};