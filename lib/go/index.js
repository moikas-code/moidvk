/**
 * Go Language Tools Index
 * Exports all Go language analysis and formatting tools
 */

// Import and re-export Go tools
import { goCodeAnalyzerTool, analyzeGoCode } from './go-code-analyzer.js';
import { goFormatterTool, formatGoCode } from './go-formatter.js';
import { goSecurityScannerTool, scanGoSecurity } from './go-security-scanner.js';
import { goPerformanceAnalyzerTool, analyzeGoPerformance } from './go-performance-analyzer.js';
import { goTestAnalyzerTool, analyzeGoTests } from './go-test-analyzer.js';
import { goDependencyScannerTool, scanGoDependencies } from './go-dependency-scanner.js';

// Re-export everything
export {
  goCodeAnalyzerTool,
  goFormatterTool,
  goSecurityScannerTool,
  goPerformanceAnalyzerTool,
  goTestAnalyzerTool,
  goDependencyScannerTool,
  analyzeGoCode,
  formatGoCode,
  scanGoSecurity,
  analyzeGoPerformance,
  analyzeGoTests,
  scanGoDependencies,
};

// Tool definitions for MCP server registration
export const GO_TOOLS = [
  'go_code_analyzer',
  'go_formatter',
  'go_security_scanner',
  'go_performance_analyzer',
  'go_test_analyzer',
  'go_dependency_scanner',
];

// Tool handlers map
export const GO_TOOL_HANDLERS = {
  go_code_analyzer: analyzeGoCode,
  go_formatter: formatGoCode,
  go_security_scanner: scanGoSecurity,
  go_performance_analyzer: analyzeGoPerformance,
  go_test_analyzer: analyzeGoTests,
  go_dependency_scanner: scanGoDependencies,
};

// Tool definitions map
export const GO_TOOL_DEFINITIONS = {
  go_code_analyzer: goCodeAnalyzerTool,
  go_formatter: goFormatterTool,
  go_security_scanner: goSecurityScannerTool,
  go_performance_analyzer: goPerformanceAnalyzerTool,
  go_test_analyzer: goTestAnalyzerTool,
  go_dependency_scanner: goDependencyScannerTool,
};

/**
 * Get all Go tool definitions
 * @returns {Array} Array of tool definitions
 */
export function getAllGoToolDefinitions() {
  return Object.values(GO_TOOL_DEFINITIONS);
}

/**
 * Get Go tool handler by name
 * @param {string} toolName - Name of the tool
 * @returns {Function|null} Tool handler function
 */
export function getGoToolHandler(toolName) {
  return GO_TOOL_HANDLERS[toolName] || null;
}

/**
 * Check if a tool name is a Go tool
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if it's a Go tool
 */
export function isGoTool(toolName) {
  return GO_TOOLS.includes(toolName);
}
