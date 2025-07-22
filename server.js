#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// Import existing JavaScript/TypeScript tools (from lib/tools/)
import { codePracticesTool, handleCodePractices } from './lib/tools/code-practices.js';
import { codeFormatterTool, handleCodeFormatter } from './lib/tools/code-formatter.js';
import { safetyCheckerTool, handleSafetyChecker } from './lib/tools/safety-checker.js';
import { securityScannerTool, handleSecurityScanner } from './lib/tools/security-scanner.js';
import {
  productionReadinessTool,
  handleProductionReadiness,
} from './lib/tools/production-readiness.js';
import {
  accessibilityTool,
  handleAccessibilityChecker,
} from './lib/tools/accessibility-checker.js';
import {
  graphqlSchemaCheckerTool,
  handleGraphqlSchemaCheck,
} from './lib/tools/graphql-schema-checker.js';
import {
  graphqlQueryCheckerTool,
  handleGraphqlQueryCheck,
} from './lib/tools/graphql-query-checker.js';
import {
  reduxPatternsCheckerTool,
  handleReduxPatternsCheck,
} from './lib/tools/redux-patterns-checker.js';
import {
  intelligentDevelopmentAnalysisTool,
  developmentSessionManagerTool,
  semanticDevelopmentSearchTool,
  handleIntelligentDevelopmentAnalysis,
  handleDevelopmentSessionManager,
  handleSemanticDevelopmentSearch,
} from './lib/tools/intelligent-tools.js';

// Import new critical tools
import { jsTestAnalyzerTool, handleJSTestAnalyzer } from './lib/tools/js-test-analyzer.js';
import { bundleAnalyzerTool, handleBundleAnalyzer } from './lib/tools/bundle-analyzer.js';
import { containerSecurityTool, handleContainerSecurity } from './lib/tools/container-security.js';
import {
  documentationAnalyzerTool,
  handleDocumentationAnalyzer,
} from './lib/tools/documentation-analyzer.js';
import { openApiValidatorTool, handleOpenApiValidator } from './lib/tools/openapi-validator.js';

// Import new medium-priority tools
import {
  jsPerformanceAnalyzerTool,
  handleJSPerformanceAnalyzer,
} from './lib/tools/js-performance-analyzer.js';
import {
  pythonPerformanceAnalyzerTool,
  handlePythonPerformanceAnalyzer,
} from './lib/python/python-performance-analyzer.js';
import { cicdAnalyzerTool, handleCICDAnalyzer } from './lib/tools/cicd-analyzer.js';
import {
  licenseComplianceScannerTool,
  handleLicenseComplianceScanner,
} from './lib/tools/license-scanner.js';
import {
  envConfigValidatorTool,
  handleEnvConfigValidator,
} from './lib/tools/env-config-validator.js';
import { eslintAutoFixerTool, runEslintAutoFixer } from './lib/tools/eslint-auto-fixer.js';
import {
  multiLanguageAutoFixerTool,
  runMultiLanguageAutoFixer,
} from './lib/tools/multi-language-auto-fixer.js';

// Import security tools
import { secureBashTool, handleSecureBash } from './lib/security/secure-bash.js';
import { initializeSecurity } from './lib/security/security-init.js';
// Import integration manager
import { getIntegrationManager } from './lib/integration/integration-manager.js';
// Import Rust tools (from lib/rust/)
import { rustCodePracticesTool, handleRustCodePractices } from './lib/rust/rust-code-practices.js';
import { rustFormatterTool, handleRustFormatter } from './lib/rust/rust-formatter.js';
import { rustSafetyCheckerTool, handleRustSafetyChecker } from './lib/rust/rust-safety-checker.js';
import {
  rustSecurityScannerTool,
  handleRustSecurityScanner,
} from './lib/rust/rust-security-scanner.js';
import {
  rustProductionReadinessTool,
  handleRustProductionReadiness,
} from './lib/rust/rust-production-readiness.js';
import {
  rustPerformanceAnalyzerTool,
  handleRustPerformanceAnalyzer,
} from './lib/rust/rust-performance-analyzer.js';
// Import Python tools (from lib/python/)
import {
  pythonCodeAnalyzerTool,
  handlePythonCodeAnalyzer,
} from './lib/python/python-code-analyzer.js';
import { pythonFormatterTool, handlePythonFormatter } from './lib/python/python-formatter.js';
import {
  pythonTypeCheckerTool,
  handlePythonTypeChecker,
} from './lib/python/python-type-checker.js';
import {
  pythonSecurityScannerTool,
  handlePythonSecurityScanner,
} from './lib/python/python-security-scanner.js';
import {
  pythonTestAnalyzerTool,
  handlePythonTestAnalyzer,
} from './lib/python/python-test-analyzer.js';
import {
  pythonDependencyScannerTool,
  handlePythonDependencyScanner,
} from './lib/python/python-dependency-scanner.js';
// Import Git tools (from lib/git/)
import { gitBlameAnalyzerTool, handleGitBlameAnalyzer } from './lib/git/git-blame-analyzer.js';
// Import Go tools (from lib/go/)
import {
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
} from './lib/go/index.js';
// Import Audit tools
import { auditCompletionTool, handleAuditCompletion } from './lib/tools/audit-completion.js';

class MOIDVKServer {
  constructor() {
    this.server = new Server(
      {
        name: 'moidvk',
        version: '2.1.4',
        description:
          'Intelligent Development and Deployment MCP Server - Comprehensive code analysis, formatting, and security tools for JavaScript/TypeScript, Rust, Python, and Go projects.',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Initialize security sandbox
    try {
      this.securitySandbox = initializeSecurity({
        mode: process.env.MCP_SECURITY_MODE || 'block',
        bypassTrustedTools: true,
      });
    } catch (error) {
      console.error('[MOIDVK] Security initialization failed:', error.message);
      this.securitySandbox = null;
    }

    // Initialize integration manager (will be initialized in run() method)
    this.integrationManager = null;

    // Map of tool names to their handlers
    this.toolHandlers = new Map([
      // JavaScript/TypeScript tools
      ['check_code_practices', handleCodePractices],
      ['format_code', handleCodeFormatter],
      ['eslint_auto_fixer', runEslintAutoFixer],
      ['multi_language_auto_fixer', runMultiLanguageAutoFixer],
      ['check_safety_rules', handleSafetyChecker],
      ['scan_security_vulnerabilities', handleSecurityScanner],
      ['check_production_readiness', handleProductionReadiness],
      ['check_accessibility', handleAccessibilityChecker],
      ['check_graphql_schema', handleGraphqlSchemaCheck],
      ['check_graphql_query', handleGraphqlQueryCheck],
      ['check_redux_patterns', handleReduxPatternsCheck],
      ['intelligent_development_analysis', handleIntelligentDevelopmentAnalysis],
      ['development_session_manager', handleDevelopmentSessionManager],
      ['semantic_development_search', handleSemanticDevelopmentSearch],
      ['secure_bash', handleSecureBash],

      // New critical tools
      ['js_test_analyzer', handleJSTestAnalyzer],
      ['bundle_size_analyzer', handleBundleAnalyzer],
      ['container_security_scanner', handleContainerSecurity],
      ['documentation_quality_checker', handleDocumentationAnalyzer],
      ['openapi_rest_validator', handleOpenApiValidator],

      // New medium-priority tools
      ['js_performance_analyzer', handleJSPerformanceAnalyzer],
      ['python_performance_analyzer', handlePythonPerformanceAnalyzer],
      ['cicd_configuration_analyzer', handleCICDAnalyzer],
      ['license_compliance_scanner', handleLicenseComplianceScanner],
      ['environment_config_validator', handleEnvConfigValidator],

      // Rust tools
      ['rust_code_practices', handleRustCodePractices],
      ['rust_formatter', handleRustFormatter],
      ['rust_safety_checker', handleRustSafetyChecker],
      ['rust_security_scanner', handleRustSecurityScanner],
      ['rust_production_readiness', handleRustProductionReadiness],
      ['rust_performance_analyzer', handleRustPerformanceAnalyzer],

      // Python tools
      ['python_code_analyzer', handlePythonCodeAnalyzer],
      ['python_formatter', handlePythonFormatter],
      ['python_type_checker', handlePythonTypeChecker],
      ['python_security_scanner', handlePythonSecurityScanner],
      ['python_test_analyzer', handlePythonTestAnalyzer],
      ['python_dependency_scanner', handlePythonDependencyScanner],

      // Git tools
      ['git_blame_analyzer', handleGitBlameAnalyzer],

      // Go tools
      ['go_code_analyzer', analyzeGoCode],
      ['go_formatter', formatGoCode],
      ['go_security_scanner', scanGoSecurity],
      ['go_performance_analyzer', analyzeGoPerformance],
      ['go_test_analyzer', analyzeGoTests],
      ['go_dependency_scanner', scanGoDependencies],

      // Audit tools
      ['audit_completion', handleAuditCompletion],
    ]);

    this.setupHandlers();
  }

  getTools() {
    const tools = [
      // JavaScript/TypeScript tools
      codePracticesTool,
      codeFormatterTool,
      eslintAutoFixerTool,
      multiLanguageAutoFixerTool,
      safetyCheckerTool,
      securityScannerTool,
      productionReadinessTool,
      accessibilityTool,
      graphqlSchemaCheckerTool,
      graphqlQueryCheckerTool,
      reduxPatternsCheckerTool,
      intelligentDevelopmentAnalysisTool,
      developmentSessionManagerTool,
      semanticDevelopmentSearchTool,
      secureBashTool,

      // New critical tools
      jsTestAnalyzerTool,
      bundleAnalyzerTool,
      containerSecurityTool,
      documentationAnalyzerTool,
      openApiValidatorTool,

      // New medium-priority tools
      jsPerformanceAnalyzerTool,
      pythonPerformanceAnalyzerTool,
      cicdAnalyzerTool,
      licenseComplianceScannerTool,
      envConfigValidatorTool,

      // Rust tools
      rustCodePracticesTool,
      rustFormatterTool,
      rustSafetyCheckerTool,
      rustSecurityScannerTool,
      rustProductionReadinessTool,
      rustPerformanceAnalyzerTool,

      // Python tools
      pythonCodeAnalyzerTool,
      pythonFormatterTool,
      pythonTypeCheckerTool,
      pythonSecurityScannerTool,
      pythonTestAnalyzerTool,
      pythonDependencyScannerTool,

      // Git tools
      gitBlameAnalyzerTool,

      // Go tools
      goCodeAnalyzerTool,
      goFormatterTool,
      goSecurityScannerTool,
      goPerformanceAnalyzerTool,
      goTestAnalyzerTool,
      goDependencyScannerTool,

      // Audit tools
      auditCompletionTool,
    ];
    return tools;
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        return {
          tools: this.getTools().map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };
      } catch (error) {
        console.error('[MOIDVK] Error listing tools:', error.message);
        return { tools: [] };
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      console.error(`[MOIDVK] Tool called: ${name}`);

      // Check regular tool handlers
      const handler = this.toolHandlers.get(name);
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await handler(args || {});
        console.error(`[MOIDVK] Tool ${name} completed successfully`);
        return result;
      } catch (error) {
        console.error(`[MOIDVK] Error in tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Tool execution failed: ${error.message}`,
                  tool: name,
                  timestamp: new Date().toISOString(),
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    });
  }

  async run() {
    try {
      const transport = new StdioServerTransport();

      // Set up error handlers
      process.on('uncaughtException', (error) => {
        console.error('[MOIDVK] Uncaught exception:', error.message);
        process.exit(1);
      });

      process.on('unhandledRejection', (reason) => {
        console.error('[MOIDVK] Unhandled rejection:', reason);
        process.exit(1);
      });

      // Initialize integration manager with KB-MCP if available
      try {
        this.integrationManager = getIntegrationManager();
        await this.integrationManager.initialize();
        console.error('[MOIDVK] Integration manager initialized');
      } catch (error) {
        console.error('[MOIDVK] Integration manager initialization failed:', error.message);
        // Continue without integration manager
      }

      await this.server.connect(transport);
      console.error('[MOIDVK] Server running with 38 tools available');
    } catch (error) {
      console.error('[MOIDVK] Failed to start server:', error.message);
      process.exit(1);
    }
  }
}

const server = new MOIDVKServer();
server.run().catch(console.error);
