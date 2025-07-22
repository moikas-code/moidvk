# Workflow Examples

This guide provides real-world examples of how to integrate MOIDVK into your development workflows,
from simple code checks to comprehensive CI/CD pipelines.

## 📋 Table of Contents

- [Quick Start Workflows](#quick-start-workflows)
- [Development Workflows](#development-workflows)
- [CI/CD Integration](#cicd-integration)
- [Pre-Commit Hooks](#pre-commit-hooks)
- [Team Workflows](#team-workflows)
- [Language-Specific Workflows](#language-specific-workflows)
- [Production Workflows](#production-workflows)
- [Automation Scripts](#automation-scripts)

## 🚀 Quick Start Workflows

### Basic Code Check

```bash
# Quick check for a single file
moidvk check-code -f src/app.js

# Check entire project
moidvk check-code -d src/ --production

# Format and check in one go
moidvk format -d src/ && moidvk check-code -d src/
```

### Security Audit

```bash
# Quick security scan
moidvk scan-security --severity high

# Comprehensive security check
moidvk scan-security --format detailed > security-report.json
moidvk check-safety -d src/
moidvk python-security -d src/ --confidence high
```

### Performance Check

```bash
# JavaScript performance analysis
moidvk js-performance -d src/ --focus browser

# Bundle size analysis
moidvk bundle-size --entry src/index.js --budget 250

# Rust performance check
moidvk rust-performance -d src/ --category allocation
```

## 💻 Development Workflows

### Daily Development Routine

```bash
#!/bin/bash
# scripts/dev-check.sh

echo "🔍 Running daily development checks..."

# 1. Format code
echo "Formatting code..."
moidvk format -d src/ -d tests/

# 2. Code quality check
echo "Checking code quality..."
moidvk check-code -d src/ --severity warning

# 3. Security scan
echo "Security scan..."
moidvk scan-security --severity medium

# 4. Performance check
echo "Performance analysis..."
moidvk js-performance -d src/ --category memory,cpu

# 5. Production readiness
echo "Production readiness..."
moidvk check-production -d src/ --category console-logs,todos

echo "✅ Development checks complete!"
```

### Feature Development Workflow

```bash
#!/bin/bash
# scripts/feature-check.sh

FEATURE_BRANCH=$(git branch --show-current)
CHANGED_FILES=$(git diff --name-only main...HEAD | grep -E '\.(js|ts|jsx|tsx)$')

echo "🚀 Checking feature branch: $FEATURE_BRANCH"

# Check only changed files
for file in $CHANGED_FILES; do
    echo "Analyzing $file..."

    # Code quality
    moidvk check-code -f "$file" --production

    # Format check
    moidvk format -f "$file" --check

    # Performance impact
    moidvk js-performance -f "$file" --include-metrics
done

# Security scan for new dependencies
if git diff --name-only main...HEAD | grep -q package.json; then
    echo "Package.json changed, running security scan..."
    moidvk scan-security --severity medium
fi

echo "✅ Feature analysis complete!"
```

### Code Review Preparation

```bash
#!/bin/bash
# scripts/review-prep.sh

echo "📋 Preparing code for review..."

# 1. Comprehensive analysis
moidvk check-code -d src/ --production --json > reports/code-quality.json

# 2. Security analysis
moidvk scan-security --json > reports/security.json
moidvk check-safety -d src/ --json > reports/safety.json

# 3. Performance analysis
moidvk js-performance -d src/ --json > reports/performance.json

# 4. Production readiness
moidvk check-production -d src/ --strict --json > reports/production.json

# 5. Documentation check
moidvk doc-quality -d src/ --json > reports/documentation.json

# 6. Accessibility check (for frontend)
if [ -d "src/components" ]; then
    moidvk check-accessibility -d src/components/ --json > reports/accessibility.json
fi

# Generate summary
echo "📊 Analysis Summary:" > reports/summary.md
echo "- Code Quality: $(jq '.summary.totalIssues' reports/code-quality.json) issues" >> reports/summary.md
echo "- Security: $(jq '.vulnerabilities | length' reports/security.json) vulnerabilities" >> reports/summary.md
echo "- Performance: $(jq '.issues | length' reports/performance.json) issues" >> reports/summary.md

echo "✅ Review preparation complete! Check reports/ directory."
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/moidvk-analysis.yml
name: MOIDVK Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install MOIDVK
        run: npm install -g moidvk

      - name: Code Quality Analysis
        run: |
          moidvk check-code -d src/ --production --json > code-quality.json

      - name: Security Scan
        run: |
          moidvk scan-security --json > security.json
          moidvk check-safety -d src/ --json > safety.json

      - name: Performance Analysis
        run: |
          moidvk js-performance -d src/ --json > performance.json
          moidvk bundle-size --json > bundle-analysis.json

      - name: Production Readiness
        run: |
          moidvk check-production -d src/ --strict --json > production.json

      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: moidvk-reports
          path: |
            *.json

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const codeQuality = JSON.parse(fs.readFileSync('code-quality.json'));
            const security = JSON.parse(fs.readFileSync('security.json'));

            const comment = `## 🔍 MOIDVK Analysis Results

            **Code Quality:** ${codeQuality.summary.totalIssues} issues found
            **Security:** ${security.vulnerabilities.length} vulnerabilities found

            View detailed reports in the workflow artifacts.`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### GitLab CI Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - analyze
  - report

variables:
  NODE_VERSION: '18'

moidvk-analysis:
  stage: analyze
  image: node:${NODE_VERSION}

  before_script:
    - npm install -g moidvk
    - npm ci

  script:
    - mkdir -p reports

    # Code quality
    - moidvk check-code -d src/ --production --json > reports/code-quality.json

    # Security
    - moidvk scan-security --json > reports/security.json
    - moidvk check-safety -d src/ --json > reports/safety.json

    # Performance
    - moidvk js-performance -d src/ --json > reports/performance.json

    # Production readiness
    - moidvk check-production -d src/ --strict --json > reports/production.json

    # Generate summary
    - |
      cat > reports/summary.json << EOF
      {
        "timestamp": "$(date -Iseconds)",
        "commit": "$CI_COMMIT_SHA",
        "branch": "$CI_COMMIT_REF_NAME",
        "pipeline": "$CI_PIPELINE_ID"
      }
      EOF

  artifacts:
    reports:
      junit: reports/*.json
    paths:
      - reports/
    expire_in: 1 week

  only:
    - merge_requests
    - main
    - develop
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any

    tools {
        nodejs '18'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
                sh 'npm install -g moidvk'
            }
        }

        stage('Code Analysis') {
            parallel {
                stage('Code Quality') {
                    steps {
                        sh 'moidvk check-code -d src/ --production --json > code-quality.json'
                    }
                }

                stage('Security Scan') {
                    steps {
                        sh 'moidvk scan-security --json > security.json'
                        sh 'moidvk check-safety -d src/ --json > safety.json'
                    }
                }

                stage('Performance') {
                    steps {
                        sh 'moidvk js-performance -d src/ --json > performance.json'
                        sh 'moidvk bundle-size --json > bundle.json'
                    }
                }
            }
        }

        stage('Production Check') {
            steps {
                sh 'moidvk check-production -d src/ --strict --json > production.json'
            }
        }

        stage('Report') {
            steps {
                script {
                    def codeQuality = readJSON file: 'code-quality.json'
                    def security = readJSON file: 'security.json'

                    currentBuild.description = """
                    Code Issues: ${codeQuality.summary.totalIssues}
                    Security Issues: ${security.vulnerabilities.size()}
                    """
                }

                archiveArtifacts artifacts: '*.json', fingerprint: true
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: '*.json',
                    reportName: 'MOIDVK Analysis Report'
                ])
            }
        }
    }

    post {
        always {
            cleanWs()
        }

        failure {
            emailext (
                subject: "MOIDVK Analysis Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "The MOIDVK analysis pipeline failed. Check the console output for details.",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

## 🔗 Pre-Commit Hooks

### Simple Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 Running pre-commit checks..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$')

if [ -z "$STAGED_FILES" ]; then
    echo "No JavaScript/TypeScript files to check."
    exit 0
fi

# Format check
echo "Checking code formatting..."
for file in $STAGED_FILES; do
    if ! moidvk format -f "$file" --check; then
        echo "❌ Format check failed for $file"
        echo "Run: moidvk format -f $file"
        exit 1
    fi
done

# Code quality check
echo "Checking code quality..."
for file in $STAGED_FILES; do
    if ! moidvk check-code -f "$file" --severity error; then
        echo "❌ Code quality check failed for $file"
        exit 1
    fi
done

echo "✅ Pre-commit checks passed!"
```

### Advanced Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

set -e

echo "🚀 Running comprehensive pre-commit analysis..."

# Configuration
MAX_ISSUES=5
SEVERITY_THRESHOLD="warning"

# Get staged files
STAGED_JS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$' || true)
STAGED_PY_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)
STAGED_RS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.rs$' || true)

# Check if package.json changed
PACKAGE_CHANGED=$(git diff --cached --name-only | grep package.json || true)

# JavaScript/TypeScript checks
if [ -n "$STAGED_JS_FILES" ]; then
    echo "📝 Checking JavaScript/TypeScript files..."

    for file in $STAGED_JS_FILES; do
        # Format check
        if ! moidvk format -f "$file" --check; then
            echo "❌ Format issues in $file. Run: moidvk format -f $file"
            exit 1
        fi

        # Code quality
        ISSUES=$(moidvk check-code -f "$file" --severity "$SEVERITY_THRESHOLD" --json | jq '.issues | length')
        if [ "$ISSUES" -gt "$MAX_ISSUES" ]; then
            echo "❌ Too many code quality issues in $file ($ISSUES > $MAX_ISSUES)"
            exit 1
        fi

        # Production readiness
        if ! moidvk check-production -f "$file" --category console-logs,todos; then
            echo "❌ Production readiness issues in $file"
            exit 1
        fi
    done
fi

# Python checks
if [ -n "$STAGED_PY_FILES" ]; then
    echo "🐍 Checking Python files..."

    for file in $STAGED_PY_FILES; do
        # Format check
        if ! moidvk python-format -f "$file" --check; then
            echo "❌ Python format issues in $file"
            exit 1
        fi

        # Code analysis
        if ! moidvk python-analyze -f "$file" --severity error; then
            echo "❌ Python code issues in $file"
            exit 1
        fi

        # Security check
        if ! moidvk python-security -f "$file" --confidence high; then
            echo "❌ Python security issues in $file"
            exit 1
        fi
    done
fi

# Rust checks
if [ -n "$STAGED_RS_FILES" ]; then
    echo "🦀 Checking Rust files..."

    for file in $STAGED_RS_FILES; do
        # Format check
        if ! moidvk rust-format -f "$file" --check; then
            echo "❌ Rust format issues in $file"
            exit 1
        fi

        # Code practices
        if ! moidvk rust-practices -f "$file" --level warn; then
            echo "❌ Rust code issues in $file"
            exit 1
        fi

        # Safety check
        if ! moidvk rust-safety -f "$file"; then
            echo "❌ Rust safety issues in $file"
            exit 1
        fi
    done
fi

# Security scan if dependencies changed
if [ -n "$PACKAGE_CHANGED" ]; then
    echo "🔒 Dependencies changed, running security scan..."
    if ! moidvk scan-security --severity high; then
        echo "❌ Security vulnerabilities found in dependencies"
        exit 1
    fi
fi

echo "✅ All pre-commit checks passed!"
```

### Pre-Commit with Husky

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && npm run moidvk:check"
    }
  },
  "lint-staged": {
    "*.{js,ts,jsx,tsx}": ["moidvk format", "moidvk check-code --severity warning", "git add"],
    "*.py": ["moidvk python-format", "moidvk python-analyze --severity error"],
    "*.rs": ["moidvk rust-format", "moidvk rust-practices --level warn"]
  },
  "scripts": {
    "moidvk:check": "moidvk scan-security --severity medium"
  }
}
```

## 👥 Team Workflows

### Team Code Standards

```bash
#!/bin/bash
# scripts/team-standards.sh

echo "📏 Enforcing team code standards..."

# Configuration
TEAM_CONFIG=".moidvk-team.json"

# Create team configuration if it doesn't exist
if [ ! -f "$TEAM_CONFIG" ]; then
    cat > "$TEAM_CONFIG" << EOF
{
  "codeQuality": {
    "maxIssuesPerFile": 3,
    "severityThreshold": "warning",
    "productionMode": true
  },
  "security": {
    "minimumSeverity": "medium",
    "blockOnVulnerabilities": true
  },
  "performance": {
    "bundleSizeLimit": 250,
    "performanceThreshold": "medium"
  },
  "accessibility": {
    "wcagLevel": "AA",
    "enforceContrast": true
  }
}
EOF
    echo "Created team configuration: $TEAM_CONFIG"
fi

# Load configuration
MAX_ISSUES=$(jq -r '.codeQuality.maxIssuesPerFile' "$TEAM_CONFIG")
SEVERITY=$(jq -r '.codeQuality.severityThreshold' "$TEAM_CONFIG")
SECURITY_LEVEL=$(jq -r '.security.minimumSeverity' "$TEAM_CONFIG")
BUNDLE_LIMIT=$(jq -r '.performance.bundleSizeLimit' "$TEAM_CONFIG")

# Run team checks
echo "Running team standard checks..."

# Code quality
echo "📝 Code quality (max $MAX_ISSUES issues per file, severity: $SEVERITY)"
moidvk check-code -d src/ --production --severity "$SEVERITY" --limit "$MAX_ISSUES"

# Security
echo "🔒 Security scan (minimum severity: $SECURITY_LEVEL)"
moidvk scan-security --severity "$SECURITY_LEVEL"

# Performance
echo "⚡ Performance check"
moidvk js-performance -d src/ --category memory,cpu
moidvk bundle-size --budget "$BUNDLE_LIMIT"

# Accessibility
echo "♿ Accessibility check"
moidvk check-accessibility -d src/ --standard AA

echo "✅ Team standards check complete!"
```

### Code Review Checklist

```bash
#!/bin/bash
# scripts/review-checklist.sh

PR_NUMBER=$1
BASE_BRANCH=${2:-main}

echo "📋 Generating code review checklist for PR #$PR_NUMBER"

# Get changed files
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD)

# Create reports directory
mkdir -p "reports/pr-$PR_NUMBER"
REPORT_DIR="reports/pr-$PR_NUMBER"

# Analyze changed files
echo "Analyzing changed files..."
for file in $CHANGED_FILES; do
    if [[ $file =~ \.(js|ts|jsx|tsx)$ ]]; then
        echo "  📄 $file"

        # Code quality
        moidvk check-code -f "$file" --production --json > "$REPORT_DIR/$(basename $file)-quality.json"

        # Performance
        moidvk js-performance -f "$file" --json > "$REPORT_DIR/$(basename $file)-performance.json"

        # Production readiness
        moidvk check-production -f "$file" --json > "$REPORT_DIR/$(basename $file)-production.json"
    fi
done

# Generate checklist
cat > "$REPORT_DIR/checklist.md" << EOF
# Code Review Checklist - PR #$PR_NUMBER

## 📊 Automated Analysis Results

### Code Quality
$(find "$REPORT_DIR" -name "*-quality.json" -exec jq -r '.summary.totalIssues' {} \; | awk '{sum+=$1} END {print "Total issues: " sum}')

### Performance
$(find "$REPORT_DIR" -name "*-performance.json" -exec jq -r '.issues | length' {} \; | awk '{sum+=$1} END {print "Performance issues: " sum}')

### Production Readiness
$(find "$REPORT_DIR" -name "*-production.json" -exec jq -r '.issues | length' {} \; | awk '{sum+=$1} END {print "Production issues: " sum}')

## ✅ Manual Review Checklist

- [ ] Code follows team conventions
- [ ] Tests are included and comprehensive
- [ ] Documentation is updated
- [ ] No sensitive data exposed
- [ ] Performance impact considered
- [ ] Accessibility requirements met
- [ ] Security implications reviewed
- [ ] Breaking changes documented

## 📁 Detailed Reports

Check the \`$REPORT_DIR\` directory for detailed analysis reports.
EOF

echo "✅ Review checklist generated: $REPORT_DIR/checklist.md"
```

## 🎯 Language-Specific Workflows

### React/TypeScript Project

```bash
#!/bin/bash
# scripts/react-workflow.sh

echo "⚛️ React/TypeScript project analysis..."

# 1. TypeScript compilation check
echo "🔧 TypeScript compilation..."
npx tsc --noEmit

# 2. Code quality
echo "📝 Code quality analysis..."
moidvk check-code -d src/ --production --severity warning

# 3. React-specific checks
echo "⚛️ React component analysis..."
moidvk check-accessibility -d src/components/ --standard AA
moidvk redux-patterns -d src/store/ --strict

# 4. Performance analysis
echo "⚡ Performance analysis..."
moidvk js-performance -d src/ --focus react --include-metrics
moidvk bundle-size --entry src/index.tsx --budget 300

# 5. Production readiness
echo "🚀 Production readiness..."
moidvk check-production -d src/ --strict --category console-logs,todos,debugging

# 6. Security scan
echo "🔒 Security analysis..."
moidvk scan-security --severity medium

echo "✅ React/TypeScript analysis complete!"
```

### Node.js API Project

```bash
#!/bin/bash
# scripts/nodejs-api-workflow.sh

echo "🟢 Node.js API project analysis..."

# 1. Code quality
echo "📝 Code quality analysis..."
moidvk check-code -d src/ -d routes/ --production

# 2. Security analysis
echo "🔒 Security analysis..."
moidvk scan-security --severity medium
moidvk check-safety -d src/ -d routes/

# 3. Performance analysis
echo "⚡ Performance analysis..."
moidvk js-performance -d src/ --focus node --category memory,io

# 4. API validation
echo "📡 API validation..."
if [ -f "openapi.yaml" ]; then
    moidvk openapi-validate -f openapi.yaml --strict
fi

# 5. Environment validation
echo "🌍 Environment validation..."
moidvk env-validate --environment production

# 6. Container security (if using Docker)
if [ -f "Dockerfile" ]; then
    echo "🐳 Container security..."
    moidvk container-security --scan-type all
fi

echo "✅ Node.js API analysis complete!"
```

### Python Data Science Project

```bash
#!/bin/bash
# scripts/python-ds-workflow.sh

echo "🐍 Python Data Science project analysis..."

# 1. Code quality
echo "📝 Code quality analysis..."
moidvk python-analyze -d src/ --severity warning

# 2. Type checking
echo "🔍 Type checking..."
moidvk python-type-checker -d src/ --strict

# 3. Security analysis
echo "🔒 Security analysis..."
moidvk python-security -d src/ --confidence medium
moidvk python-dependency-scanner --check-security

# 4. Performance analysis
echo "⚡ Performance analysis..."
moidvk python-performance -d src/ --focus data_science --include-complexity

# 5. Test analysis
echo "🧪 Test analysis..."
moidvk python-test -d tests/ --include-metrics

# 6. Documentation check
echo "📚 Documentation analysis..."
moidvk doc-quality -d src/ --doc-type code --standard auto

echo "✅ Python Data Science analysis complete!"
```

### Rust Systems Project

```bash
#!/bin/bash
# scripts/rust-systems-workflow.sh

echo "🦀 Rust systems project analysis..."

# 1. Code practices
echo "📝 Code practices analysis..."
moidvk rust-practices -d src/ --pedantic --level warn

# 2. Safety analysis
echo "🛡️ Safety analysis..."
moidvk rust-safety -d src/ --strict

# 3. Performance analysis
echo "⚡ Performance analysis..."
moidvk rust-performance -d src/ --focus memory --category allocation,cloning

# 4. Security scan
echo "🔒 Security analysis..."
moidvk rust-security-scanner --severity medium

# 5. Production readiness
echo "🚀 Production readiness..."
moidvk rust-production -d src/ --strict

# 6. Documentation check
echo "📚 Documentation analysis..."
moidvk doc-quality -d src/ --standard auto --strictness strict

echo "✅ Rust systems analysis complete!"
```

## 🏭 Production Workflows

### Pre-Deployment Checklist

```bash
#!/bin/bash
# scripts/pre-deployment.sh

ENVIRONMENT=${1:-production}
VERSION=${2:-$(git describe --tags --always)}

echo "🚀 Pre-deployment analysis for $ENVIRONMENT (version: $VERSION)"

# Create deployment report
REPORT_FILE="deployment-report-$VERSION.json"

# 1. Comprehensive code analysis
echo "📝 Code quality analysis..."
moidvk check-code -d src/ --production --json > code-quality.json

# 2. Security analysis
echo "🔒 Security analysis..."
moidvk scan-security --severity medium --json > security.json
moidvk check-safety -d src/ --json > safety.json

# 3. Performance analysis
echo "⚡ Performance analysis..."
moidvk js-performance -d src/ --json > performance.json
moidvk bundle-size --json > bundle.json

# 4. Production readiness
echo "🏭 Production readiness..."
moidvk check-production -d src/ --strict --json > production.json

# 5. Accessibility check
echo "♿ Accessibility analysis..."
moidvk check-accessibility -d src/ --standard AA --json > accessibility.json

# 6. Documentation check
echo "📚 Documentation analysis..."
moidvk doc-quality -d src/ --json > documentation.json

# 7. Environment validation
echo "🌍 Environment validation..."
moidvk env-validate --environment "$ENVIRONMENT" --json > environment.json

# 8. License compliance
echo "⚖️ License compliance..."
moidvk license-scan --json > licenses.json

# Combine reports
jq -s '{
  timestamp: now | strftime("%Y-%m-%d %H:%M:%S"),
  version: "'$VERSION'",
  environment: "'$ENVIRONMENT'",
  codeQuality: .[0],
  security: .[1],
  safety: .[2],
  performance: .[3],
  bundle: .[4],
  production: .[5],
  accessibility: .[6],
  documentation: .[7],
  environment: .[8],
  licenses: .[9]
}' code-quality.json security.json safety.json performance.json bundle.json production.json accessibility.json documentation.json environment.json licenses.json > "$REPORT_FILE"

# Generate summary
TOTAL_ISSUES=$(jq '.codeQuality.summary.totalIssues + .security.vulnerabilities | length + .production.issues | length' "$REPORT_FILE")
CRITICAL_ISSUES=$(jq '[.security.vulnerabilities[] | select(.severity == "critical")] | length' "$REPORT_FILE")

echo "📊 Deployment Summary:"
echo "  Total Issues: $TOTAL_ISSUES"
echo "  Critical Issues: $CRITICAL_ISSUES"

# Check deployment readiness
if [ "$CRITICAL_ISSUES" -gt 0 ]; then
    echo "❌ Deployment blocked: Critical issues found"
    exit 1
elif [ "$TOTAL_ISSUES" -gt 10 ]; then
    echo "⚠️ Deployment warning: High number of issues ($TOTAL_ISSUES)"
    echo "Consider reviewing before deployment"
else
    echo "✅ Deployment approved: Ready for $ENVIRONMENT"
fi

echo "📄 Full report: $REPORT_FILE"
```

### Production Monitoring

```bash
#!/bin/bash
# scripts/production-monitor.sh

echo "📊 Production code monitoring..."

# Daily production health check
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="monitoring/reports/$TIMESTAMP"
mkdir -p "$REPORT_DIR"

# 1. Security monitoring
echo "🔒 Security monitoring..."
moidvk scan-security --severity low --json > "$REPORT_DIR/security.json"

# 2. Performance monitoring
echo "⚡ Performance monitoring..."
moidvk js-performance -d src/ --json > "$REPORT_DIR/performance.json"

# 3. Bundle size monitoring
echo "📦 Bundle monitoring..."
moidvk bundle-size --json > "$REPORT_DIR/bundle.json"

# 4. Production issues check
echo "🏭 Production issues..."
moidvk check-production -d src/ --json > "$REPORT_DIR/production.json"

# Generate trend analysis
if [ -d "monitoring/reports" ]; then
    echo "📈 Generating trends..."

    # Security trend
    find monitoring/reports -name "security.json" -mtime -7 | \
    xargs jq -r '.vulnerabilities | length' | \
    awk '{sum+=$1; count++} END {print "Security trend (7 days): " sum/count " avg vulnerabilities"}' > "$REPORT_DIR/trends.txt"

    # Performance trend
    find monitoring/reports -name "performance.json" -mtime -7 | \
    xargs jq -r '.issues | length' | \
    awk '{sum+=$1; count++} END {print "Performance trend (7 days): " sum/count " avg issues"}' >> "$REPORT_DIR/trends.txt"
fi

echo "✅ Production monitoring complete: $REPORT_DIR"
```

## 🤖 Automation Scripts

### Automated Code Maintenance

```bash
#!/bin/bash
# scripts/auto-maintenance.sh

echo "🔧 Automated code maintenance..."

# 1. Format all code
echo "🎨 Auto-formatting code..."
moidvk format -d src/ -d tests/
moidvk python-format -d src/ -d tests/
moidvk rust-format -d src/

# 2. Fix auto-fixable issues
echo "🔧 Auto-fixing issues..."

# Get fixable JavaScript issues
FIXABLE_JS=$(moidvk check-code -d src/ --json | jq -r '.issues[] | select(.fixable == true) | .file + ":" + (.line | tostring)')

for issue in $FIXABLE_JS; do
    echo "Fixing: $issue"
    # Apply fixes (this would need custom implementation)
done

# 3. Update dependencies
echo "📦 Checking dependencies..."
if moidvk scan-security --severity high | grep -q "vulnerabilities found"; then
    echo "⚠️ Security vulnerabilities found in dependencies"
    echo "Consider running: npm audit fix"
fi

# 4. Generate maintenance report
cat > maintenance-report.md << EOF
# Automated Maintenance Report
Generated: $(date)

## Actions Taken
- ✅ Code formatted
- ✅ Auto-fixable issues resolved
- ✅ Dependencies checked

## Manual Actions Needed
$(moidvk check-production -d src/ --category todos | grep -E "TODO|FIXME" || echo "None")

## Security Alerts
$(moidvk scan-security --severity high | head -10)
EOF

echo "✅ Automated maintenance complete!"
```

### Continuous Quality Monitoring

```bash
#!/bin/bash
# scripts/quality-monitor.sh

# Configuration
QUALITY_THRESHOLD=85
SECURITY_THRESHOLD=0
PERFORMANCE_THRESHOLD=5

echo "📊 Continuous quality monitoring..."

# Run analysis
moidvk check-code -d src/ --production --json > current-quality.json
moidvk scan-security --json > current-security.json
moidvk js-performance -d src/ --json > current-performance.json

# Calculate scores
QUALITY_SCORE=$(jq -r '.summary.score // 0' current-quality.json)
SECURITY_ISSUES=$(jq -r '.vulnerabilities | length' current-security.json)
PERFORMANCE_ISSUES=$(jq -r '.issues | length' current-performance.json)

echo "Current Scores:"
echo "  Quality: $QUALITY_SCORE%"
echo "  Security Issues: $SECURITY_ISSUES"
echo "  Performance Issues: $PERFORMANCE_ISSUES"

# Check thresholds
ALERTS=()

if [ "$QUALITY_SCORE" -lt "$QUALITY_THRESHOLD" ]; then
    ALERTS+=("Quality score below threshold: $QUALITY_SCORE% < $QUALITY_THRESHOLD%")
fi

if [ "$SECURITY_ISSUES" -gt "$SECURITY_THRESHOLD" ]; then
    ALERTS+=("Security issues found: $SECURITY_ISSUES")
fi

if [ "$PERFORMANCE_ISSUES" -gt "$PERFORMANCE_THRESHOLD" ]; then
    ALERTS+=("Performance issues above threshold: $PERFORMANCE_ISSUES > $PERFORMANCE_THRESHOLD")
fi

# Send alerts if needed
if [ ${#ALERTS[@]} -gt 0 ]; then
    echo "🚨 Quality alerts:"
    for alert in "${ALERTS[@]}"; do
        echo "  - $alert"
    done

    # Send notification (customize as needed)
    # slack-notify "Quality Alert: ${ALERTS[0]}"
    # email-alert "quality-team@company.com" "Quality Alert" "${ALERTS[*]}"
else
    echo "✅ All quality metrics within thresholds"
fi

# Store historical data
HISTORY_DIR="quality-history/$(date +%Y/%m)"
mkdir -p "$HISTORY_DIR"
cp current-*.json "$HISTORY_DIR/$(date +%d-%H%M%S)/"

echo "📈 Quality monitoring complete"
```

## 📚 Additional Resources

- **[CLI Usage Guide](cli-usage.md)** - Complete CLI command reference
- **[Configuration Guide](../technical/configuration.md)** - Advanced configuration options
- **[Tool Reference](../technical/tool-reference.md)** - Detailed tool documentation
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

---

**Need help?** Join our community or check the documentation for more workflow examples and best
practices.
