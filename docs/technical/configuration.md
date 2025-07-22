# Configuration Guide

This comprehensive guide covers all configuration options for MOIDVK, including environment variables, configuration files, and advanced settings.

## 🎯 Overview

MOIDVK provides flexible configuration options to adapt to different environments, security requirements, and use cases. This guide covers all configuration methods and options.

## 📋 Configuration Methods

### 1. Environment Variables
Quick configuration for development and deployment

### 2. Configuration Files
Persistent configuration for projects and environments

### 3. Command Line Options
Override settings for specific operations

### 4. MCP Client Configuration
Integration-specific settings

## 🔧 Environment Variables

### Core Environment Variables

```bash
# Basic Configuration
NODE_ENV=production                    # Environment (development, production)
DEBUG=false                           # Enable debug logging
LOG_LEVEL=info                        # Log level (debug, info, warn, error)

# Server Configuration
PORT=3000                             # Server port
HOST=0.0.0.0                          # Server host
TIMEOUT=30000                         # Request timeout (ms)
MAX_PAYLOAD=10mb                      # Maximum payload size

# Security Configuration
SECURITY_LEVEL=strict                 # Security level (permissive, balanced, strict)
EXPLICIT_CONSENT=true                 # Require explicit consent
ALLOWED_ORIGINS=https://your-domain.com # CORS origins (comma-separated)

# Filesystem Configuration
WORKSPACE_ROOT=/workspace             # Workspace root directory
MAX_FILE_SIZE=10485760                # Maximum file size (bytes)
EMBEDDING_CACHE_DIR=/cache/embeddings # Embedding cache directory
MODEL_CACHE_DIR=/cache/models         # Model cache directory

# Performance Configuration
MAX_CONCURRENT_REQUESTS=10            # Maximum concurrent requests
CACHE_ENABLED=true                    # Enable caching
CACHE_TTL=3600                        # Cache TTL (seconds)

# Monitoring Configuration
ENABLE_METRICS=true                   # Enable metrics collection
METRICS_PORT=9090                     # Metrics port
HEALTH_CHECK_PATH=/health             # Health check endpoint
```

### Tool-Specific Environment Variables

```bash
# Code Quality Tools
ESLINT_CONFIG_PATH=.eslintrc.json     # ESLint configuration path
PRETTIER_CONFIG_PATH=.prettierrc      # Prettier configuration path
PRODUCTION_MODE=false                 # Enable production mode for code checks

# Security Tools
NPM_REGISTRY=https://registry.npmjs.org/ # NPM registry URL
AUDIT_SEVERITY=low                    # Minimum audit severity
PRODUCTION_DEPS_ONLY=false            # Scan only production dependencies

# Accessibility Tools
PUPPETEER_EXECUTABLE_PATH=            # Custom Puppeteer executable path
ACCESSIBILITY_TIMEOUT=30000           # Accessibility test timeout
WCAG_STANDARD=AA                      # WCAG standard (A, AA, AAA)

# GraphQL Tools
GRAPHQL_MAX_DEPTH=7                   # Maximum query depth
GRAPHQL_MAX_COMPLEXITY=100            # Maximum query complexity
GRAPHQL_STRICT_MODE=false             # Enable strict GraphQL validation

# Redux Tools
REDUX_STRICT_MODE=false               # Enable strict Redux validation
REDUX_TOOLKIT_DETECTION=true          # Enable Redux Toolkit detection

# Filesystem Tools
EMBEDDING_MODEL=all-MiniLM-L6-v2      # Embedding model name
EMBEDDING_CACHE_SIZE=1GB              # Embedding cache size limit
SNIPPET_MAX_SIZE=200                  # Maximum snippet size (lines)
```

### Environment-Specific Variables

#### Development Environment
```bash
# Development settings
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
SECURITY_LEVEL=permissive
EXPLICIT_CONSENT=false
CACHE_ENABLED=false
```

#### Production Environment
```bash
# Production settings
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn
SECURITY_LEVEL=strict
EXPLICIT_CONSENT=true
CACHE_ENABLED=true
ENABLE_METRICS=true
```

#### Testing Environment
```bash
# Testing settings
NODE_ENV=test
DEBUG=true
LOG_LEVEL=debug
SECURITY_LEVEL=permissive
EXPLICIT_CONSENT=false
CACHE_ENABLED=false
ENABLE_METRICS=false
```

## 📄 Configuration Files

### Global Configuration

Create `~/.moidvk/config.json`:

```json
{
  "defaults": {
    "security_level": "balanced",
    "explicit_consent": true,
    "max_file_size": 10485760,
    "timeout": 30000
  },
  "tools": {
    "check_code_practices": {
      "production": false,
      "strict": false,
      "limit": 50,
      "eslint_config": "~/.moidvk/.eslintrc.json"
    },
    "format_code": {
      "check_only": false,
      "prettier_config": "~/.moidvk/.prettierrc"
    },
    "scan_security_vulnerabilities": {
      "severity": "low",
      "production_only": false,
      "registry": "https://registry.npmjs.org/"
    },
    "check_production_readiness": {
      "strict": false,
      "categories": ["todos", "console-logs", "debugging"]
    },
    "check_accessibility": {
      "standard": "AA",
      "timeout": 30000,
      "include_contrast": true
    },
    "check_graphql_schema": {
      "strict": false,
      "max_issues": 50
    },
    "check_graphql_query": {
      "max_depth": 7,
      "max_complexity": 100
    },
    "check_redux_patterns": {
      "strict": false,
      "toolkit_detection": true
    }
  },
  "filesystem": {
    "workspace_root": "~/.moidvk/workspaces",
    "allowed_extensions": [".js", ".ts", ".jsx", ".tsx", ".json", ".md"],
    "blocked_patterns": ["**/node_modules/**", "**/.git/**", "**/*.env*"],
    "embedding_cache": {
      "enabled": true,
      "max_size": "1GB",
      "ttl": 86400
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics_port": 9090,
    "health_check_path": "/health",
    "audit_logging": true
  }
}
```

### Project Configuration

Create `.moidvk.json` in your project root:

```json
{
  "project": {
    "name": "my-project",
    "version": "1.0.0",
    "security_level": "strict",
    "explicit_consent": true
  },
  "tools": {
    "check_code_practices": {
      "production": true,
      "strict": true,
      "eslint_config": ".eslintrc.json"
    },
    "format_code": {
      "prettier_config": ".prettierrc"
    },
    "scan_security_vulnerabilities": {
      "severity": "moderate",
      "production_only": true
    },
    "check_production_readiness": {
      "strict": true,
      "categories": ["todos", "console-logs", "debugging", "documentation"]
    }
  },
  "filesystem": {
    "workspace_root": ".",
    "allowed_extensions": [".js", ".ts", ".jsx", ".tsx", ".json", ".md", ".html"],
    "blocked_patterns": [
      "**/node_modules/**",
      "**/.git/**",
      "**/*.env*",
      "**/dist/**",
      "**/build/**"
    ]
  },
  "ignore": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "coverage/**"
  ]
}
```

### Environment-Specific Configuration

#### Development Configuration
Create `.moidvk.dev.json`:

```json
{
  "environment": "development",
  "debug": true,
  "security_level": "permissive",
  "explicit_consent": false,
  "tools": {
    "check_code_practices": {
      "production": false,
      "strict": false
    }
  },
  "monitoring": {
    "enabled": false
  }
}
```

#### Production Configuration
Create `.moidvk.prod.json`:

```json
{
  "environment": "production",
  "debug": false,
  "security_level": "strict",
  "explicit_consent": true,
  "tools": {
    "check_code_practices": {
      "production": true,
      "strict": true
    }
  },
  "monitoring": {
    "enabled": true,
    "audit_logging": true
  }
}
```

## 🔧 MCP Client Configuration

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "false",
        "SECURITY_LEVEL": "balanced",
        "EXPLICIT_CONSENT": "true"
      },
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Cursor Configuration

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve", "--config", ".moidvk.json"],
      "env": {
        "NODE_ENV": "development",
        "WORKSPACE_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

### VS Code Configuration

```json
{
  "mcp.servers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "false"
      }
    }
  },
  "mcp.settings": {
    "moidvk.security_level": "balanced",
    "moidvk.explicit_consent": true
  }
}
```

## ⚙️ Advanced Configuration

### Security Configuration

#### Strict Security Mode
```json
{
  "security": {
    "level": "strict",
    "explicit_consent": true,
    "allowed_origins": ["https://your-domain.com"],
    "rate_limit": {
      "enabled": true,
      "window_ms": 900000,
      "max_requests": 100
    },
    "file_access": {
      "max_size": 5242880,
      "allowed_extensions": [".js", ".ts", ".json"],
      "blocked_patterns": ["**/node_modules/**", "**/.git/**", "**/*.env*"]
    },
    "privacy": {
      "local_processing": true,
      "sensitive_data_detection": true,
      "automatic_cleanup": true
    }
  }
}
```

#### Permissive Security Mode
```json
{
  "security": {
    "level": "permissive",
    "explicit_consent": false,
    "allowed_origins": ["*"],
    "rate_limit": {
      "enabled": false
    },
    "file_access": {
      "max_size": 52428800,
      "allowed_extensions": ["*"],
      "blocked_patterns": []
    }
  }
}
```

### Performance Configuration

#### High Performance Mode
```json
{
  "performance": {
    "max_concurrent_requests": 20,
    "cache": {
      "enabled": true,
      "ttl": 7200,
      "max_size": "2GB"
    },
    "embedding": {
      "cache_enabled": true,
      "cache_size": "2GB",
      "model": "all-MiniLM-L6-v2"
    },
    "timeout": 60000
  }
}
```

#### Development Mode
```json
{
  "performance": {
    "max_concurrent_requests": 5,
    "cache": {
      "enabled": false
    },
    "embedding": {
      "cache_enabled": false
    },
    "timeout": 30000
  }
}
```

### Tool-Specific Configuration

#### ESLint Configuration
```json
{
  "tools": {
    "check_code_practices": {
      "eslint_config": {
        "extends": [
          "eslint:recommended",
          "@typescript-eslint/recommended"
        ],
        "rules": {
          "no-console": "warn",
          "prefer-const": "error",
          "eqeqeq": "error"
        },
        "env": {
          "browser": true,
          "es2021": true
        }
      }
    }
  }
}
```

#### Prettier Configuration
```json
{
  "tools": {
    "format_code": {
      "prettier_config": {
        "semi": true,
        "trailingComma": "es5",
        "singleQuote": true,
        "printWidth": 80,
        "tabWidth": 2
      }
    }
  }
}
```

#### Accessibility Configuration
```json
{
  "tools": {
    "check_accessibility": {
      "standard": "AA",
      "environment": "production",
      "include_contrast": true,
      "rule_set": "full",
      "timeout": 30000,
      "puppeteer_options": {
        "headless": true,
        "args": ["--no-sandbox", "--disable-setuid-sandbox"]
      }
    }
  }
}
```

## 🔍 Configuration Validation

### Validate Configuration

```bash
# Validate global configuration
moidvk config --validate

# Validate project configuration
moidvk config --validate --config .moidvk.json

# Check configuration syntax
moidvk config --check-syntax

# Test configuration
moidvk config --test
```

### Configuration Commands

```bash
# Show current configuration
moidvk config --show

# Show specific section
moidvk config --show security

# Set configuration value
moidvk config --set security.level strict

# Get configuration value
moidvk config --get security.level

# Export configuration
moidvk config --export > config-backup.json

# Import configuration
moidvk config --import config-backup.json
```

## 🔄 Configuration Management

### Environment-Specific Configuration

#### Development Environment
```bash
# Load development configuration
export MOIDVK_CONFIG=.moidvk.dev.json
moidvk serve

# Or use environment variable
NODE_ENV=development moidvk serve
```

#### Production Environment
```bash
# Load production configuration
export MOIDVK_CONFIG=.moidvk.prod.json
moidvk serve

# Or use environment variable
NODE_ENV=production moidvk serve
```

### Configuration Inheritance

Configuration follows this hierarchy (highest to lowest priority):

1. **Command line options**
2. **Environment variables**
3. **Project configuration** (`.moidvk.json`)
4. **Environment-specific configuration** (`.moidvk.{env}.json`)
5. **Global configuration** (`~/.moidvk/config.json`)
6. **Default configuration**

### Configuration Templates

#### Basic Template
```json
{
  "project": {
    "name": "{{PROJECT_NAME}}",
    "security_level": "balanced"
  },
  "tools": {
    "check_code_practices": {
      "production": false
    }
  }
}
```

#### Advanced Template
```json
{
  "project": {
    "name": "{{PROJECT_NAME}}",
    "version": "{{PROJECT_VERSION}}",
    "security_level": "{{SECURITY_LEVEL}}"
  },
  "tools": {
    "check_code_practices": {
      "production": "{{PRODUCTION_MODE}}",
      "strict": "{{STRICT_MODE}}"
    }
  },
  "filesystem": {
    "workspace_root": "{{WORKSPACE_ROOT}}"
  }
}
```

## 🚨 Troubleshooting Configuration

### Common Configuration Issues

#### "Configuration file not found"
```bash
# Check file path
ls -la .moidvk.json

# Create default configuration
moidvk config --init

# Use absolute path
moidvk serve --config /absolute/path/to/config.json
```

#### "Invalid configuration syntax"
```bash
# Validate JSON syntax
cat .moidvk.json | jq .

# Check for syntax errors
moidvk config --check-syntax

# Use JSON validator
python -m json.tool .moidvk.json
```

#### "Configuration not applied"
```bash
# Check configuration loading
moidvk config --show

# Check environment variables
env | grep MOIDVK

# Restart service after configuration change
sudo systemctl restart moidvk
```

### Configuration Debugging

```bash
# Enable configuration debugging
DEBUG=moidvk:config moidvk serve

# Show configuration source
moidvk config --show --verbose

# Test configuration
moidvk config --test --verbose
```

## 📚 Best Practices

### Configuration Best Practices

1. **Use Environment Variables**: For sensitive data and deployment-specific settings
2. **Use Configuration Files**: For project-specific settings
3. **Validate Configuration**: Always validate before deployment
4. **Version Control**: Include configuration files in version control
5. **Documentation**: Document configuration options and their effects
6. **Testing**: Test configuration in different environments
7. **Backup**: Keep backups of important configurations

### Security Best Practices

1. **Environment Variables**: Store secrets in environment variables
2. **File Permissions**: Set appropriate file permissions for configuration files
3. **Validation**: Validate all configuration inputs
4. **Principle of Least Privilege**: Use minimal required permissions
5. **Audit**: Regularly audit configuration settings

### Performance Best Practices

1. **Caching**: Enable caching for frequently accessed data
2. **Resource Limits**: Set appropriate resource limits
3. **Monitoring**: Enable monitoring for performance tracking
4. **Optimization**: Optimize configuration for your use case
5. **Testing**: Test performance with different configurations

## 📞 Configuration Support

### Getting Help

1. **Documentation**: Check this guide and other documentation
2. **Validation**: Use configuration validation tools
3. **Examples**: Review configuration examples
4. **Community**: Check community discussions
5. **Support**: Contact support for complex issues

### Configuration Examples

- **Basic Setup**: [Basic Configuration Example](examples/basic-config.json)
- **Production Setup**: [Production Configuration Example](examples/production-config.json)
- **Development Setup**: [Development Configuration Example](examples/development-config.json)
- **Security Setup**: [Security Configuration Example](examples/security-config.json)

---

**Configuration Complete!** ⚙️ You now have comprehensive knowledge of MOIDVK configuration options. Use these settings to customize MOIDVK for your specific needs and environment.