import axe from 'axe-core';
import puppeteer from 'puppeteer';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout } from '../utils/timeout.js';
import { process_code_for_accessibility, create_dom } from '../utils/dom-processor.js';
import { get_accessibility_config, get_rule_set } from '../config/accessibility-config.js';

// Timeout for accessibility checks (30 seconds)
const ACCESSIBILITY_TIMEOUT_MS = 30000;

/**
 * Tool definition for check_accessibility
 */
export const accessibilityTool = {
  name: 'check_accessibility',
  description: 'Analyzes HTML, JSX/TSX, and CSS files for ADA compliance and accessibility issues using axe-core. Detects WCAG 2.2 Level AA violations including color contrast, ARIA, semantic HTML, and keyboard navigation.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The HTML, JSX/TSX, or CSS code to analyze for accessibility (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "component.jsx", "styles.css", "page.html")',
      },
      standard: {
        type: 'string',
        description: 'WCAG compliance level to test against',
        enum: ['A', 'AA', 'AAA'],
        default: 'AA',
      },
      environment: {
        type: 'string',
        description: 'Environment for testing (affects rule strictness)',
        enum: ['development', 'production'],
        default: 'production',
      },
      include_contrast: {
        type: 'boolean',
        description: 'Include color contrast checking (may be slow)',
        default: true,
      },
      rule_set: {
        type: 'string',
        description: 'Specific rule set to use for focused testing',
        enum: ['minimal', 'forms', 'content', 'navigation', 'full'],
        default: 'full',
      },
      rules: {
        type: 'array',
        description: 'Optional array of specific axe rules to run',
        items: {
          type: 'string',
        },
      },
    },
    required: ['code'],
  },
};

/**
 * Handles the check_accessibility tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.code - Code to analyze
 * @param {string} args.filename - Optional filename
 * @param {string} args.standard - WCAG standard level
 * @param {string} args.environment - Environment for testing
 * @param {boolean} args.include_contrast - Include color contrast checking
 * @param {string} args.rule_set - Rule set to use
 * @param {Array} args.rules - Specific rules to run
 * @returns {Object} MCP response
 */
export async function handleAccessibilityChecker(args) {
  const {
    code,
    filename = 'file.html',
    standard = 'AA',
    environment = 'production',
    include_contrast = true,
    rule_set = 'full',
    rules = null,
  } = args;

  // Validate input
  const validation = validateCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safe_filename = sanitizeFilename(filename);
  const file_extension = safe_filename.split('.').pop()?.toLowerCase() || 'html';

  try {
    // Process code to HTML for accessibility testing
    const html_content = process_code_for_accessibility(code, safe_filename);

    // Configure axe-core with simpler configuration
    const config = {
      tags: ['wcag2a', 'wcag2aa'],
      rules: {},
      runOptions: {
        timeout: 30000,
        performanceTimer: false,
      },
    };

    // Apply WCAG standard
    if (standard === 'A') {
      config.tags = ['wcag2a'];
    } else if (standard === 'AAA') {
      config.tags = ['wcag2a', 'wcag2aa', 'wcag2aaa'];
    }

    // Configure color contrast
    if (!include_contrast) {
      config.rules['color-contrast'] = { enabled: false };
    }

    // Apply specific rules if provided
    if (rules && Array.isArray(rules)) {
      const enabled_rules = {};
      rules.forEach(rule => {
        enabled_rules[rule] = { enabled: true };
      });
      config.rules = enabled_rules;
    }

    // Run axe-core accessibility check using puppeteer
    const axe_promise = run_axe_check_puppeteer(html_content, config);
    const results = await withTimeout(axe_promise, ACCESSIBILITY_TIMEOUT_MS, 'Accessibility check');

    // Process results
    const processed_results = process_accessibility_results(results, safe_filename, file_extension);

    return {
      content: [{
        type: 'text',
        text: processed_results,
      }],
    };

  } catch (error) {
    let error_message = 'An error occurred while checking accessibility.';
    
    if (error.message === 'Accessibility check timeout exceeded') {
      error_message = 'Accessibility check timed out. The code might be too complex or the DOM too large.';
    } else if (error.message.includes('Parse error')) {
      error_message = 'The code contains syntax errors and cannot be analyzed.';
    } else if (error.message.includes('axe-core')) {
      error_message = 'Error running accessibility tests. Please check the code structure.';
    } else if (error.message.includes('puppeteer') || error.message.includes('browser')) {
      error_message = 'Browser automation failed. This may be due to system limitations or invalid HTML structure.';
    } else if (error.message.includes('DOM') || error.message.includes('JSDOM')) {
      error_message = `Error processing ${file_extension.toUpperCase()} content. Please verify your code structure and syntax.`;
    }

    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${error_message}\n\nPlease ensure the code is valid ${file_extension.toUpperCase()} and try again.`,
      }],
    };
  }
}

/**
 * Run axe-core accessibility check using puppeteer
 * @param {string} html_content - HTML content to test
 * @param {Object} config - axe-core configuration
 * @returns {Promise} axe-core results
 */
async function run_axe_check_puppeteer(html_content, config) {
  let browser;
  let page;
  
  try {
    // Launch puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    page = await browser.newPage();
    
    // Set HTML content
    await page.setContent(html_content, { waitUntil: 'networkidle0' });
    
    // Inject axe-core
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    
    // Run axe-core accessibility check
    const results = await page.evaluate(async (config) => {
      return new Promise((resolve, reject) => {
        const run_options = {
          ...config.runOptions,
          rules: config.rules || {},
          tags: config.tags || ['wcag2a', 'wcag2aa'],
          locale: config.locale || 'en',
          resultTypes: config.resultTypes || ['violations', 'incomplete', 'passes', 'inapplicable'],
        };

        window.axe.run(document, run_options, (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        });
      });
    }, config);
    
    return results;
    
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Process axe-core results into formatted output
 * @param {Object} results - axe-core results
 * @param {string} filename - Original filename
 * @param {string} file_extension - File extension
 * @returns {string} Formatted results
 */
function process_accessibility_results(results, filename, file_extension) {
  const { violations, passes, incomplete, inapplicable, testEngine } = results;

  let output = `🔍 Accessibility Analysis Results for ${filename}\n`;
  output += `📊 Engine: ${testEngine.name} v${testEngine.version}\n`;
  output += '🎯 Standard: WCAG 2.2 Level AA (ADA Compliance)\n';
  output += `📁 File Type: ${file_extension.toUpperCase()}\n\n`;

  // Summary
  const total_tests = violations.length + passes.length + incomplete.length + inapplicable.length;
  const violation_count = violations.length;
  const incomplete_count = incomplete.length;
  const pass_count = passes.length;
  
  output += '📋 Summary:\n';
  output += `  ❌ Violations: ${violation_count}\n`;
  output += `  ⚠️  Incomplete: ${incomplete_count}\n`;
  output += `  ✅ Passed: ${pass_count}\n`;
  output += `  ➖ Not Applicable: ${inapplicable.length}\n`;
  output += `  📏 Total Tests: ${total_tests}\n\n`;

  // Accessibility Score
  const score = total_tests > 0 ? Math.round(((pass_count) / (violation_count + pass_count + incomplete_count)) * 100) : 0;
  const score_emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
  output += `${score_emoji} Accessibility Score: ${score}%\n\n`;

  // Violations (Critical Issues)
  if (violation_count > 0) {
    output += '❌ VIOLATIONS (Must Fix for ADA Compliance):\n';
    output += `${'='.repeat(50)}\n`;
    
    violations.forEach((violation, index) => {
      output += `\n${index + 1}. ${violation.help}\n`;
      output += `   Impact: ${violation.impact?.toUpperCase() || 'UNKNOWN'}\n`;
      output += `   Rule: ${violation.id}\n`;
      output += `   WCAG: ${violation.tags.filter(tag => tag.includes('wcag')).join(', ')}\n`;
      output += `   Description: ${violation.description}\n`;
      
      if (violation.helpUrl) {
        output += `   Learn More: ${violation.helpUrl}\n`;
      }
      
      // Show affected elements
      if (violation.nodes && violation.nodes.length > 0) {
        output += `   Affected Elements (${violation.nodes.length}):\n`;
        violation.nodes.slice(0, 3).forEach(node => {
          output += `     • ${node.html}\n`;
          if (node.failureSummary) {
            output += `       Fix: ${node.failureSummary}\n`;
          }
        });
        
        if (violation.nodes.length > 3) {
          output += `     ... and ${violation.nodes.length - 3} more elements\n`;
        }
      }
    });
  }

  // Incomplete Issues (Need Manual Review)
  if (incomplete_count > 0) {
    output += '\n⚠️  INCOMPLETE (Manual Review Required):\n';
    output += `${'='.repeat(50)}\n`;
    
    incomplete.forEach((item, index) => {
      output += `\n${index + 1}. ${item.help}\n`;
      output += `   Rule: ${item.id}\n`;
      output += '   Reason: Requires manual verification\n';
      output += `   Elements: ${item.nodes.length}\n`;
    });
  }

  // Success Summary
  if (pass_count > 0) {
    output += '\n✅ PASSED TESTS:\n';
    output += `${'='.repeat(30)}\n`;
    
    // Group passes by category
    const passed_categories = {};
    passes.forEach(pass => {
      const category = categorize_rule(pass.id);
      if (!passed_categories[category]) {
        passed_categories[category] = [];
      }
      passed_categories[category].push(pass);
    });
    
    Object.keys(passed_categories).forEach(category => {
      output += `\n📂 ${category}: ${passed_categories[category].length} tests passed\n`;
      passed_categories[category].slice(0, 5).forEach(pass => {
        output += `   ✓ ${pass.help}\n`;
      });
      if (passed_categories[category].length > 5) {
        output += `   ... and ${passed_categories[category].length - 5} more\n`;
      }
    });
  }

  // Recommendations
  output += '\n💡 RECOMMENDATIONS:\n';
  output += `${'='.repeat(30)}\n`;
  
  if (violation_count === 0 && incomplete_count === 0) {
    output += '🎉 Excellent! Your code meets WCAG 2.2 Level AA standards.\n';
    output += '   • All automated accessibility tests passed\n';
    output += '   • Your code is ADA compliant based on automated checks\n';
    output += '   • Consider manual testing with screen readers for complete validation\n';
  } else {
    output += '🔧 Priority Actions:\n';
    if (violation_count > 0) {
      output += `   1. Fix all ${violation_count} violations - these are ADA compliance blockers\n`;
    }
    if (incomplete_count > 0) {
      output += `   2. Manually review ${incomplete_count} incomplete items\n`;
    }
    output += '   3. Test with screen readers (NVDA, JAWS, VoiceOver)\n';
    output += '   4. Validate with real users who have disabilities\n';
  }
  
  // File-specific recommendations
  if (file_extension === 'jsx' || file_extension === 'tsx') {
    output += '\n🔗 React/JSX Specific:\n';
    output += '   • Use semantic HTML elements instead of generic divs\n';
    output += '   • Implement proper ARIA attributes for custom components\n';
    output += '   • Test components in isolation and as part of larger pages\n';
  }
  
  if (file_extension === 'css') {
    output += '\n🎨 CSS Specific:\n';
    output += '   • Ensure sufficient color contrast ratios\n';
    output += '   • Test with Windows High Contrast Mode\n';
    output += '   • Verify focus indicators are visible and prominent\n';
  }
  
  output += '\n📚 Additional Resources:\n';
  output += '   • WCAG 2.2 Guidelines: https://www.w3.org/WAI/WCAG22/quickref/\n';
  output += '   • ADA Compliance: https://www.ada.gov/resources/web-guidance/\n';
  output += '   • WebAIM Resources: https://webaim.org/resources/\n';

  return output;
}

/**
 * Categorize accessibility rule by type
 * @param {string} rule_id - Rule identifier
 * @returns {string} Category name
 */
function categorize_rule(rule_id) {
  const categories = {
    'Color & Contrast': ['color-contrast', 'color-contrast-enhanced', 'link-in-text-block'],
    'Images & Media': ['image-alt', 'image-redundant-alt', 'object-alt', 'input-image-alt', 'area-alt', 'video-caption', 'audio-caption'],
    'Forms & Inputs': ['label', 'form-field-multiple-labels', 'button-name', 'input-image-alt', 'duplicate-id-active'],
    'Headings & Structure': ['heading-order', 'page-has-heading-one', 'landmark-one-main', 'landmark-unique', 'bypass'],
    'ARIA & Semantics': ['aria-valid-attr', 'aria-valid-attr-value', 'aria-required-attr', 'aria-required-children', 'aria-required-parent', 'aria-roles', 'aria-allowed-attr', 'aria-hidden-focus', 'aria-hidden-body'],
    'Navigation & Focus': ['focus-order-semantics', 'focusable-content', 'tabindex', 'skip-link', 'link-name'],
    'Document Structure': ['document-title', 'html-has-lang', 'html-lang-valid', 'valid-lang', 'region'],
    'Lists & Tables': ['list', 'listitem', 'definition-list', 'dlitem', 'table-fake-caption', 'td-headers-attr', 'th-has-data-cells'],
  };
  
  for (const [category, rules] of Object.entries(categories)) {
    if (rules.includes(rule_id)) {
      return category;
    }
  }
  
  return 'Other';
}