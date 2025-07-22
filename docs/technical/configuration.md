# Configuration Guide

MOIDVK provides extensive configuration options to customize its behavior for your specific
development environment and requirements. This guide covers all configuration methods and options.

## 📋 Table of Contents

- [Configuration Methods](#configuration-methods)
- [Configuration File](#configuration-file)
- [Environment Variables](#environment-variables)
- [Command Line Options](#command-line-options)
- [MCP Server Configuration](#mcp-server-configuration)
- [Tool-Specific Configuration](#tool-specific-configuration)
- [Performance Configuration](#performance-configuration)
- [Security Configuration](#security-configuration)
- [Integration Configuration](#integration-configuration)
- [Advanced Configuration](#advanced-configuration)

## 🔧 Configuration Methods

MOIDVK supports multiple configuration methods with the following precedence (highest to lowest):

1. **Command line arguments** - Override all other settings
2. **Environment variables** - Override file-based configuration
3. **Project configuration file** - `.moidvk.json` in project root
4. **Global configuration file** - `~/.moidvk/config.json`
5. **Default values** - Built-in defaults

## 📄 Configuration File

### Project Configuration

Create `.moidvk.json` in your project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/moikas-code/moidvk/main/schemas/config.json",
  "version": "1.0.0",
  "extends": ["@moidvk/config-recommended"],

  "general": {
    "defaultSeverity": "warning",
    "outputFormat": "detailed",
    "maxConcurrent": 4,
    "timeout": 30000,
    "verbose": false
  },

  "caching": {
    "enabled": true,
    "ttl": 3600,
    "directory": ".moidvk-cache",
    "maxSize": "100MB"
  },

  "tools": {
    "check_code_practices": {
      "enabled": true,
      "production": true,
      "ruleCategory": "all",
      "severity": "warning"
    },
    "scan_security_vulnerabilities": {
      "enabled": true,
      "severity": "medium",
      "production": false
    },
    "format_code": {
      "enabled": true,
      "check": false
    }
  },

  "ignore": ["node_modules/", "dist/", "build/", "*.min.js", "*.d.ts", "coverage/"],

  "include": ["src/**/*.{js,ts,jsx,tsx}", "tests/**/*.{js,ts}", "*.{js,ts}"],

  "languages": {
    "javascript": {
      "enabled": true,
      "extensions": [".js", ".jsx", ".mjs"],
      "parser": "babel"
    },
    "typescript": {
      "enabled": true,
      "extensions": [".ts", ".tsx"],
      "parser": "typescript"
    },
    "python": {
      "enabled": true,
      "extensions": [".py"],
      "version": "3"
    },
    "rust": {
      "enabled": true,
      "extensions": [".rs"],
      "edition": "2021"
    }
  },

  "integrations": {
    "mcp": {
      "enabled": true,
      "port": 3000,
      "host": "localhost"
    },
    "git": {
      "enabled": true,
      "hooks": ["pre-commit", "pre-push"]
    },
    "ci": {
      "enabled": true,
      "provider": "github-actions"
    }
  }
}
```

### Global Configuration

Create `~/.moidvk/config.json` for user-wide settings:

```json
{
  "user": {
    "name": "Your Name",
    "email": "your.email@example.com",
    "preferences": {
      "colorOutput": true,
      "progressBars": true,
      "notifications": true
    }
  },

  "defaults": {
    "outputFormat": "detailed",
    "severity": "warning",
    "maxConcurrent": 4
  },

  "paths": {
    "cacheDirectory": "~/.moidvk/cache",
    "configDirectory": "~/.moidvk",
    "logDirectory": "~/.moidvk/logs"
  },

  "telemetry": {
    "enabled": false,
    "anonymous": true
  }
}
```

### Configuration Schema

MOIDVK provides JSON schema validation for configuration files:

```bash
# Validate configuration
moidvk config validate

# Generate schema
moidvk config schema > moidvk-schema.json

# Use in VS Code (add to settings.json)
{
  "json.schemas": [
    {
      "fileMatch": [".moidvk.json"],
      "url": "./moidvk-schema.json"
    }
  ]
}
```

## 🌍 Environment Variables

### Core Settings

```bash
# General configuration
export MOIDVK_CONFIG_PATH="/path/to/config.json"
export MOIDVK_CACHE_DIR="/path/to/cache"
export MOIDVK_LOG_LEVEL="info"  # debug, info, warn, error
export MOIDVK_LOG_FORMAT="json"  # json, text, structured

# Performance settings
export MOIDVK_MAX_CONCURRENT=5
export MOIDVK_TIMEOUT=30000
export MOIDVK_MEMORY_LIMIT="512MB"

# Feature flags
export MOIDVK_USE_RUST=true
export MOIDVK_ENABLE_CACHE=true
export MOIDVK_ENABLE_TELEMETRY=false
export MOIDVK_ENABLE_NOTIFICATIONS=true

# Security settings
export MOIDVK_SECURITY_LEVEL="DEVELOPMENT"  # STRICT, BALANCED, DEVELOPMENT, PERMISSIVE
export MOIDVK_ENABLE_LEARNING=true
export MOIDVK_KEEP_PRIVATE=true

# MCP server settings
export MOIDVK_MCP_PORT=3000
export MOIDVK_MCP_HOST="localhost"
export MOIDVK_MCP_ENABLED=true

# Tool-specific settings
export MOIDVK_JS_PARSER="babel"  # babel, typescript, espree
export MOIDVK_PYTHON_VERSION="3"
export MOIDVK_RUST_EDITION="2021"
```

### Development Environment

```bash
# Development mode
export NODE_ENV=development
export MOIDVK_DEV_MODE=true
export MOIDVK_DEBUG=true
export MOIDVK_VERBOSE=true

# Testing environment
export MOIDVK_TEST_MODE=true
export MOIDVK_MOCK_EXTERNAL=true
export MOIDVK_DISABLE_CACHE=true
```

### CI/CD Environment

```bash
# CI/CD specific settings
export CI=true
export MOIDVK_CI_MODE=true
export MOIDVK_NO_INTERACTIVE=true
export MOIDVK_OUTPUT_FORMAT="json"
export MOIDVK_EXIT_ON_ERROR=true

# GitHub Actions
export GITHUB_ACTIONS=true
export MOIDVK_GITHUB_TOKEN="$GITHUB_TOKEN"

# GitLab CI
export GITLAB_CI=true
export MOIDVK_GITLAB_TOKEN="$CI_JOB_TOKEN"
```

## ⚙️ Command Line Options

### Global Options

```bash
# Configuration
--config, -c <path>          # Configuration file path
--no-config                  # Disable configuration file loading
--config-override <json>     # Override specific config values

# Output control
--output, -o <file>          # Output file path
--format <format>            # Output format (json, text, detailed, summary)
--json                       # JSON output format
--quiet, -q                  # Suppress non-essential output
--verbose, -v                # Verbose output
--no-color                   # Disable colored output
--no-progress                # Disable progress bars

# Performance
--max-concurrent <num>       # Maximum concurrent operations
--timeout <ms>               # Operation timeout in milliseconds
--no-cache                   # Disable caching
--cache-dir <path>           # Cache directory path

# Debugging
--debug                      # Enable debug mode
--trace                      # Enable trace logging
--profile                    # Enable performance profiling
--dry-run                    # Show what would be done without executing
```

### Tool-Specific Options

```bash
# Code analysis
--severity <level>           # Minimum severity (error, warning, info)
--category <categories>      # Filter by categories
--production                 # Enable production mode
--strict                     # Enable strict mode

# File handling
--file, -f <path>           # Analyze specific file
--directory, -d <path>      # Analyze directory
--stdin                     # Read from stdin
--include <pattern>         # Include file patterns
--exclude <pattern>         # Exclude file patterns

# Filtering and pagination
--limit <num>               # Limit number of results
--offset <num>              # Result offset for pagination
--sort-by <field>           # Sort results by field
--sort-order <order>        # Sort order (asc, desc)
```

## 🖥️ MCP Server Configuration

### Server Settings

```json
{
  "mcp": {
    "server": {
      "port": 3000,
      "host": "localhost",
      "protocol": "stdio",
      "timeout": 30000,
      "maxConnections": 10
    },

    "security": {
      "enableAuth": false,
      "apiKey": null,
      "allowedOrigins": ["*"],
      "rateLimiting": {
        "enabled": true,
        "maxRequests": 100,
        "windowMs": 60000
      }
    },

    "logging": {
      "level": "info",
      "format": "json",
      "file": "mcp-server.log"
    },

    "tools": {
      "enableAll": true,
      "disabled": [],
      "rateLimit": {
        "perTool": 10,
        "windowMs": 60000
      }
    }
  }
}
```

### Client Configuration

For Claude Desktop (`~/.claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "node",
      "args": ["/path/to/moidvk/server.js"],
      "env": {
        "MOIDVK_CONFIG_PATH": "/path/to/.moidvk.json",
        "MOIDVK_LOG_LEVEL": "info"
      }
    }
  }
}
```

For Continue (`~/.continue/config.json`):

```json
{
  "mcpServers": [
    {
      "name": "moidvk",
      "command": "node",
      "args": ["/path/to/moidvk/server.js"],
      "env": {
        "MOIDVK_CONFIG_PATH": "/path/to/.moidvk.json"
      }
    }
  ]
}
```

## 🔧 Tool-Specific Configuration

### JavaScript/TypeScript Tools

```json
{
  "tools": {
    "check_code_practices": {
      "enabled": true,
      "production": false,
      "ruleCategory": "all",
      "severity": "warning",
      "limit": 50,
      "sortBy": "line",
      "customRules": {
        "no-console": "error",
        "no-debugger": "error"
      }
    },

    "format_code": {
      "enabled": true,
      "check": false,
      "prettier": {
        "printWidth": 80,
        "tabWidth": 2,
        "useTabs": false,
        "semi": true,
        "singleQuote": true,
        "trailingComma": "es5"
      }
    },

    "js_performance_analyzer": {
      "enabled": true,
      "category": "all",
      "focus": "general",
      "includeMetrics": true,
      "strictness": "standard"
    }
  }
}
```

### Python Tools

```json
{
  "tools": {
    "python_code_analyzer": {
      "enabled": true,
      "pythonVersion": "3",
      "select": ["E", "F", "W", "C90", "I", "N"],
      "ignore": ["E501", "W503"],
      "severity": "warning"
    },

    "python_formatter": {
      "enabled": true,
      "lineLength": 88,
      "skipStringNormalization": false,
      "skipMagicTrailingComma": false
    },

    "python_type_checker": {
      "enabled": true,
      "strict": false,
      "checkUntyped": true,
      "disallowUntyped": false,
      "followImports": "skip"
    }
  }
}
```

### Rust Tools

```json
{
  "tools": {
    "rust_code_practices": {
      "enabled": true,
      "edition": "2021",
      "level": "warn",
      "pedantic": false,
      "category": "all"
    },

    "rust_formatter": {
      "enabled": true,
      "maxWidth": 100,
      "tabSpaces": 4,
      "indentStyle": "Block",
      "useSmallHeuristics": "Default"
    },

    "rust_safety_checker": {
      "enabled": true,
      "strict": false
    }
  }
}
```

## ⚡ Performance Configuration

### Concurrency Settings

```json
{
  "performance": {
    "maxConcurrent": 4,
    "queueSize": 100,
    "timeout": 30000,
    "retries": 3,
    "backoff": {
      "initial": 1000,
      "multiplier": 2,
      "maximum": 10000
    }
  },

  "memory": {
    "limit": "512MB",
    "gcThreshold": "256MB",
    "enableGC": true
  },

  "caching": {
    "enabled": true,
    "strategy": "lru",
    "maxSize": "100MB",
    "ttl": 3600,
    "compression": true,
    "persistence": true
  }
}
```

### Rust Native Bindings

```json
{
  "rust": {
    "enabled": true,
    "fallbackToJS": true,
    "binaryPath": null,
    "features": {
      "fileSearch": true,
      "vectorOps": true,
      "parallelProcessing": true
    }
  }
}
```

### Resource Limits

```json
{
  "limits": {
    "maxFileSize": "10MB",
    "maxFiles": 10000,
    "maxDepth": 20,
    "maxLineLength": 10000,
    "timeout": {
      "file": 5000,
      "tool": 30000,
      "total": 300000
    }
  }
}
```

## 🔒 Security Configuration

### Security Levels

```json
{
  "security": {
    "level": "DEVELOPMENT",
    "features": {
      "enableLearning": true,
      "keepPrivate": true,
      "sanitizeOutput": true,
      "validateInputs": true
    },

    "commandExecution": {
      "allowList": ["npm", "node", "git", "cargo", "python"],
      "denyList": ["rm", "sudo", "chmod"],
      "timeout": 60000,
      "workingDirectory": ".",
      "environment": "restricted"
    },

    "fileAccess": {
      "allowedPaths": ["./src", "./tests", "./docs"],
      "deniedPaths": ["/etc", "/usr", "/var"],
      "maxFileSize": "10MB",
      "allowSymlinks": false
    }
  }
}
```

### Privacy Settings

```json
{
  "privacy": {
    "anonymizeData": true,
    "excludePatterns": ["password", "token", "secret", "key", "api_key"],
    "sanitizeFilenames": true,
    "sanitizeContent": true,
    "logLevel": "info"
  }
}
```

## 🔗 Integration Configuration

### Git Integration

```json
{
  "git": {
    "enabled": true,
    "hooks": {
      "preCommit": {
        "enabled": true,
        "tools": ["format_code", "check_code_practices"],
        "failOnError": true
      },
      "prePush": {
        "enabled": true,
        "tools": ["scan_security_vulnerabilities"],
        "failOnError": true
      }
    },

    "blame": {
      "ignoreWhitespace": true,
      "showEmail": false,
      "maxLines": 1000
    }
  }
}
```

### CI/CD Integration

```json
{
  "ci": {
    "enabled": true,
    "provider": "github-actions",
    "reportFormat": "json",
    "artifactPath": "reports/",

    "thresholds": {
      "codeQuality": 85,
      "security": 0,
      "performance": 5
    },

    "notifications": {
      "slack": {
        "enabled": false,
        "webhook": null,
        "channel": "#dev"
      },
      "email": {
        "enabled": false,
        "recipients": []
      }
    }
  }
}
```

### IDE Integration

```json
{
  "ide": {
    "vscode": {
      "enabled": true,
      "extensions": ["moidvk.vscode-extension"],
      "settings": {
        "formatOnSave": true,
        "lintOnSave": true,
        "showInlineErrors": true
      }
    },

    "languageServer": {
      "enabled": true,
      "port": 3001,
      "features": {
        "diagnostics": true,
        "codeActions": true,
        "formatting": true
      }
    }
  }
}
```

## 🚀 Advanced Configuration

### Custom Tool Configuration

```json
{
  "customTools": {
    "myCustomTool": {
      "command": "node",
      "args": ["./tools/my-tool.js"],
      "input": "file",
      "output": "json",
      "timeout": 10000,
      "enabled": true
    }
  }
}
```

### Plugin System

```json
{
  "plugins": {
    "enabled": true,
    "directory": "./plugins",
    "autoLoad": true,
    "plugins": [
      {
        "name": "custom-linter",
        "path": "./plugins/custom-linter.js",
        "enabled": true,
        "config": {
          "rules": ["custom-rule-1", "custom-rule-2"]
        }
      }
    ]
  }
}
```

### Workspace Configuration

```json
{
  "workspace": {
    "type": "monorepo",
    "packages": [
      {
        "name": "frontend",
        "path": "./packages/frontend",
        "config": {
          "tools": {
            "check_accessibility": {
              "enabled": true,
              "standard": "AA"
            }
          }
        }
      },
      {
        "name": "backend",
        "path": "./packages/backend",
        "config": {
          "tools": {
            "openapi_rest_validator": {
              "enabled": true,
              "specPath": "./api.yaml"
            }
          }
        }
      }
    ]
  }
}
```

### Environment-Specific Configuration

```json
{
  "environments": {
    "development": {
      "extends": "base",
      "tools": {
        "check_code_practices": {
          "severity": "warning"
        }
      },
      "caching": {
        "enabled": true
      }
    },

    "production": {
      "extends": "base",
      "tools": {
        "check_code_practices": {
          "production": true,
          "severity": "error"
        },
        "check_production_readiness": {
          "enabled": true,
          "strict": true
        }
      },
      "caching": {
        "enabled": false
      }
    },

    "ci": {
      "extends": "production",
      "outputFormat": "json",
      "verbose": false,
      "maxConcurrent": 8
    }
  }
}
```

## 📊 Configuration Management

### Configuration Commands

```bash
# View current configuration
moidvk config show

# View effective configuration (with all overrides)
moidvk config show --effective

# Validate configuration
moidvk config validate

# Generate default configuration
moidvk config init

# Update configuration
moidvk config set tools.check_code_practices.production true

# Reset configuration
moidvk config reset

# Export configuration
moidvk config export > my-config.json

# Import configuration
moidvk config import my-config.json
```

### Configuration Profiles

```bash
# Create profile
moidvk config profile create strict --from production

# Use profile
moidvk --profile strict check-code -d src/

# List profiles
moidvk config profile list

# Delete profile
moidvk config profile delete strict
```

### Configuration Inheritance

```json
{
  "extends": ["@moidvk/config-base", "@moidvk/config-typescript", "./shared-config.json"],

  "overrides": {
    "tools.check_code_practices.production": true
  }
}
```

## 🔧 Troubleshooting Configuration

### Common Issues

```bash
# Debug configuration loading
MOIDVK_DEBUG=true moidvk config show

# Validate configuration syntax
moidvk config validate --strict

# Check configuration conflicts
moidvk config check

# Reset to defaults
moidvk config reset --confirm

# Clear cache
moidvk cache clear
```

### Configuration Debugging

```json
{
  "debug": {
    "enabled": true,
    "logConfig": true,
    "logResolution": true,
    "logOverrides": true,
    "outputFile": "debug-config.log"
  }
}
```

## 📚 Configuration Examples

### Minimal Configuration

```json
{
  "tools": {
    "check_code_practices": { "enabled": true },
    "format_code": { "enabled": true },
    "scan_security_vulnerabilities": { "enabled": true }
  }
}
```

### Team Configuration

```json
{
  "extends": ["@moidvk/config-team"],
  "team": {
    "name": "Frontend Team",
    "standards": {
      "codeQuality": 85,
      "security": "medium",
      "accessibility": "AA"
    }
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "severity": "warning"
    },
    "check_accessibility": {
      "standard": "AA",
      "includeContrast": true
    }
  }
}
```

### Enterprise Configuration

```json
{
  "extends": ["@moidvk/config-enterprise"],
  "enterprise": {
    "compliance": ["SOX", "GDPR", "HIPAA"],
    "auditLogging": true,
    "encryptionRequired": true
  },
  "security": {
    "level": "STRICT",
    "enableLearning": false,
    "auditTrail": true
  },
  "tools": {
    "license_compliance_scanner": {
      "enabled": true,
      "strictness": "enterprise"
    },
    "container_security_scanner": {
      "enabled": true,
      "includeCompliance": true
    }
  }
}
```

## 📚 Additional Resources

- **[CLI Usage Guide](../user-guide/cli-usage.md)** - Command line interface
- **[Tool Reference](tool-reference.md)** - Complete tool documentation
- **[Security Guide](security.md)** - Security features and best practices
- **[Troubleshooting](../user-guide/troubleshooting.md)** - Common issues and solutions

---

**Need help?** Use `moidvk config --help` for configuration assistance or check our documentation
for more examples.
