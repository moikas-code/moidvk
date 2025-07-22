/**
 * Accessibility configuration for axe-core
 * Based on WCAG 2.2 Level AA compliance requirements
 */

export const accessibilityConfig = {
  // WCAG 2.2 Level AA rules for ADA compliance
  rules: {
    // Color and contrast
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: false }, // AAA level

    // Images and media
    'image-alt': { enabled: true },
    'image-redundant-alt': { enabled: true },
    'object-alt': { enabled: true },
    'input-image-alt': { enabled: true },
    'area-alt': { enabled: true },

    // Forms
    label: { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'duplicate-id-active': { enabled: true },
    'duplicate-id-aria': { enabled: true },

    // Headings and structure
    'heading-order': { enabled: true },
    'page-has-heading-one': { enabled: true },
    bypass: { enabled: true },

    // ARIA
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-hidden-focus': { enabled: true },
    'aria-hidden-body': { enabled: true },

    // Keyboard navigation
    tabindex: { enabled: true },

    // Interactive elements
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'link-in-text-block': { enabled: true },

    // Language
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'valid-lang': { enabled: true },

    // Tables
    'table-fake-caption': { enabled: true },
    'td-headers-attr': { enabled: true },
    'th-has-data-cells': { enabled: true },

    // Lists
    list: { enabled: true },
    listitem: { enabled: true },
    'definition-list': { enabled: true },
    dlitem: { enabled: true },

    // Document structure
    'document-title': { enabled: true },
    'html-xml-lang-mismatch': { enabled: true },
    'landmark-banner-is-top-level': { enabled: true },
    'landmark-contentinfo-is-top-level': { enabled: true },
    'landmark-main-is-top-level': { enabled: true },
    'landmark-no-duplicate-banner': { enabled: true },
    'landmark-no-duplicate-contentinfo': { enabled: true },
    'landmark-no-duplicate-main': { enabled: true },
    'landmark-one-main': { enabled: true },
    'landmark-unique': { enabled: true },
    region: { enabled: true },

    // Skip links
    'skip-link': { enabled: true },

    // Video and audio
    'video-caption': { enabled: true },
    'audio-caption': { enabled: true },

    // Custom disabled rules that are too strict for development
    'landmark-complementary-is-top-level': { enabled: false },
    'nested-interactive': { enabled: false }, // Can be too strict for components
  },

  // Tags to include in testing
  tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],

  // Reporter configuration
  reporter: 'v2',

  // Run options
  runOptions: {
    // Include hidden elements in testing
    includeHidden: false,

    // Timeout for individual rule execution
    timeout: 30000,

    // Performance timing
    performanceTimer: true,

    // Element selector options
    selectors: true,

    // Ancestry information
    ancestry: true,

    // XPath selectors
    xpath: false,

    // Absolute paths
    absolutePaths: false,
  },

  // Locale for internationalization
  locale: 'en',

  // Disable specific rules for development environments
  disableOtherRules: false,

  // Result types to include
  resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable'],

  // Environment-specific configurations
  environments: {
    development: {
      rules: {
        // More lenient rules for development
        'color-contrast': { enabled: false }, // Disable in dev for design iteration
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
      },
    },
    production: {
      rules: {
        // All rules enabled for production
        'color-contrast': { enabled: true },
        'landmark-one-main': { enabled: true },
        'page-has-heading-one': { enabled: true },
      },
    },
  },
};

/**
 * Get configuration for specific environment
 * @param {string} environment - 'development' or 'production'
 * @returns {object} Combined configuration
 */
export function get_accessibility_config(environment = 'production') {
  const base_config = { ...accessibilityConfig };

  if (environment === 'development' && base_config.environments.development) {
    // Merge development overrides
    base_config.rules = {
      ...base_config.rules,
      ...base_config.environments.development.rules,
    };
  }

  return base_config;
}

/**
 * Custom rule configurations for specific use cases
 */
export const custom_rule_sets = {
  // Minimal set for quick checks
  minimal: {
    rules: {
      'color-contrast': { enabled: true },
      'image-alt': { enabled: true },
      label: { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'document-title': { enabled: true },
      'html-has-lang': { enabled: true },
    },
  },

  // Form-specific rules
  forms: {
    rules: {
      label: { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'duplicate-id-active': { enabled: true },
      'duplicate-id-aria': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'button-name': { enabled: true },
      'focusable-content': { enabled: true },
      tabindex: { enabled: true },
    },
  },

  // Content-specific rules
  content: {
    rules: {
      'heading-order': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'image-alt': { enabled: true },
      'image-redundant-alt': { enabled: true },
      'link-name': { enabled: true },
      'link-in-text-block': { enabled: true },
      list: { enabled: true },
      listitem: { enabled: true },
      'color-contrast': { enabled: true },
      'document-title': { enabled: true },
      'html-has-lang': { enabled: true },
      'valid-lang': { enabled: true },
    },
  },

  // Navigation-specific rules
  navigation: {
    rules: {
      bypass: { enabled: true },
      'skip-link': { enabled: true },
      'landmark-banner-is-top-level': { enabled: true },
      'landmark-contentinfo-is-top-level': { enabled: true },
      'landmark-main-is-top-level': { enabled: true },
      'landmark-no-duplicate-banner': { enabled: true },
      'landmark-no-duplicate-contentinfo': { enabled: true },
      'landmark-no-duplicate-main': { enabled: true },
      'landmark-one-main': { enabled: true },
      'landmark-unique': { enabled: true },
      region: { enabled: true },
    },
  },
};

/**
 * Get a specific rule set configuration
 * @param {string} rule_set - Name of the rule set
 * @returns {object} Rule set configuration
 */
export function get_rule_set(rule_set = 'minimal') {
  if (custom_rule_sets[rule_set]) {
    return {
      ...accessibilityConfig,
      ...custom_rule_sets[rule_set],
    };
  }
  return accessibilityConfig;
}
