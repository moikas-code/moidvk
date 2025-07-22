#!/usr/bin/env node

/**
 * Comprehensive test suite for all Go language tools
 * Tests all 6 Go tools: analyzer, formatter, security scanner, performance analyzer, test analyzer, dependency scanner
 */

import { analyzeGoCode } from '../lib/go/go-code-analyzer.js';
import { formatGoCode } from '../lib/go/go-formatter.js';
import { scanGoSecurity } from '../lib/go/go-security-scanner.js';
import { analyzeGoPerformance } from '../lib/go/go-performance-analyzer.js';
import { analyzeGoTests } from '../lib/go/go-test-analyzer.js';
import { scanGoDependencies } from '../lib/go/go-dependency-scanner.js';

// Test data samples
const testData = {
  goodCode: `package main

import (
    "fmt"
    "log"
)

func main() {
    fmt.Println("Hello, World!")
}

func add(a, b int) int {
    return a + b
}`,

  problematicCode: `package main

import (
    "fmt"
    "unsafe"
    "crypto/md5"
)

func main() {
    // Unsafe operations
    var x int = 42
    ptr := unsafe.Pointer(&x)
    fmt.Printf("Pointer: %p\\n", ptr)
    
    // Weak crypto
    h := md5.New()
    h.Write([]byte("test"))
    
    // Performance issues
    var result string
    for i := 0; i < 1000; i++ {
        result = result + fmt.Sprintf("%d", i)
    }
    
    // Unused variable
    unused := "not used"
}`,

  testCode: `package main

import (
    "testing"
)

func TestAdd(t *testing.T) {
    result := add(2, 3)
    if result != 5 {
        t.Errorf("Expected 5, got %d", result)
    }
}

func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        add(2, 3)
    }
}

func ExampleAdd() {
    fmt.Println(add(2, 3))
    // Output: 5
}`,

  goMod: `module example.com/test

go 1.21

require (
    github.com/gorilla/mux v1.8.0
    github.com/lib/pq v1.10.7
    golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d // indirect
)

replace github.com/old/package => github.com/new/package v1.0.0`,

  goSum: `github.com/gorilla/mux v1.8.0 h1:i40aqfkR1h2SlN9hojwV5ZA91wcXFOvkdNIeFDP5koI=
github.com/gorilla/mux v1.8.0/go.mod h1:DVbg23sWSpFRCP0SfiEN6jmj59UnW/n46BH5rLB71So=
github.com/lib/pq v1.10.7 h1:p7ZhMD+KsSRozJr34udlUrhboJwWAgCg34+/ZZNvZZw=
github.com/lib/pq v1.10.7/go.mod h1:AlVN5x4E4T544tWzH6hKfbfQvm3HdbOxrmggDNAPY9o=`,
};

class ComprehensiveGoToolsTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.toolResults = {};
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async assert(condition, message, toolName = 'general') {
    if (!this.toolResults[toolName]) {
      this.toolResults[toolName] = { passed: 0, failed: 0 };
    }

    if (condition) {
      this.passed++;
      this.toolResults[toolName].passed++;
      this.log(`✅ PASS: ${message}`);
    } else {
      this.failed++;
      this.toolResults[toolName].failed++;
      this.log(`❌ FAIL: ${message}`);
    }
  }

  async testGoCodeAnalyzer() {
    this.log('\\n🔍 Testing Go Code Analyzer...');

    try {
      // Test with good code
      const goodResult = await analyzeGoCode({
        code: testData.goodCode,
        filename: 'main.go',
        tools: ['vet', 'staticcheck'],
        limit: 10,
      });

      await this.assert(
        goodResult.content && goodResult.content[0].text.includes('Go Code Analysis Results'),
        'Code analyzer returns proper structure',
        'analyzer',
      );

      // Test with problematic code
      const problemResult = await analyzeGoCode({
        code: testData.problematicCode,
        filename: 'main.go',
        tools: ['vet'],
        limit: 10,
      });

      await this.assert(
        problemResult.content && problemResult.summary,
        'Code analyzer processes problematic code',
        'analyzer',
      );

      // Test pagination
      const paginatedResult = await analyzeGoCode({
        code: testData.problematicCode,
        filename: 'main.go',
        tools: ['vet'],
        limit: 2,
        offset: 0,
      });

      await this.assert(
        paginatedResult.summary && paginatedResult.summary.issuesShown <= 2,
        'Code analyzer respects pagination limits',
        'analyzer',
      );
    } catch (error) {
      await this.assert(false, `Code analyzer test failed: ${error.message}`, 'analyzer');
    }
  }

  async testGoFormatter() {
    this.log('\\n🎨 Testing Go Formatter...');

    try {
      // Test formatting
      const formatResult = await formatGoCode({
        code: 'package main\\nimport"fmt"\\nfunc main(){fmt.Println("test")}',
        filename: 'main.go',
        tool: 'gofmt',
      });

      await this.assert(
        formatResult.content && formatResult.formatted,
        'Formatter returns formatted code',
        'formatter',
      );

      // Test check mode
      const checkResult = await formatGoCode({
        code: 'package main\\nimport"fmt"\\nfunc main(){fmt.Println("test")}',
        filename: 'main.go',
        tool: 'gofmt',
        check: true,
      });

      await this.assert(
        checkResult.hasOwnProperty('needsFormatting'),
        'Formatter check mode works',
        'formatter',
      );

      // Test different tools
      const goimportsResult = await formatGoCode({
        code: testData.goodCode,
        filename: 'main.go',
        tool: 'goimports',
      });

      await this.assert(
        goimportsResult.content && goimportsResult.tool === 'goimports',
        'Formatter supports goimports',
        'formatter',
      );
    } catch (error) {
      await this.assert(false, `Formatter test failed: ${error.message}`, 'formatter');
    }
  }

  async testGoSecurityScanner() {
    this.log('\\n🔒 Testing Go Security Scanner...');

    try {
      // Test security scanning
      const securityResult = await scanGoSecurity({
        code: testData.problematicCode,
        filename: 'main.go',
        tools: ['unsafe-analysis', 'staticcheck-security'],
        severity: 'all',
      });

      await this.assert(
        securityResult.content &&
          securityResult.content[0].text.includes('Go Security Scan Results'),
        'Security scanner returns proper structure',
        'security',
      );

      await this.assert(
        securityResult.summary && securityResult.summary.hasOwnProperty('totalFindings'),
        'Security scanner provides summary',
        'security',
      );

      // Test with go.mod for dependency scanning
      const depSecurityResult = await scanGoSecurity({
        code: testData.goodCode,
        filename: 'main.go',
        goMod: testData.goMod,
        tools: ['govulncheck'],
        severity: 'medium',
      });

      await this.assert(
        depSecurityResult.content,
        'Security scanner handles dependency scanning',
        'security',
      );
    } catch (error) {
      await this.assert(false, `Security scanner test failed: ${error.message}`, 'security');
    }
  }

  async testGoPerformanceAnalyzer() {
    this.log('\\n⚡ Testing Go Performance Analyzer...');

    try {
      // Test performance analysis
      const perfResult = await analyzeGoPerformance({
        code: testData.problematicCode,
        filename: 'main.go',
        focus: 'all',
        severity: 'all',
      });

      await this.assert(
        perfResult.content &&
          perfResult.content[0].text.includes('Go Performance Analysis Results'),
        'Performance analyzer returns proper structure',
        'performance',
      );

      await this.assert(
        perfResult.summary && perfResult.summary.hasOwnProperty('totalIssues'),
        'Performance analyzer provides summary',
        'performance',
      );

      // Test focused analysis
      const memoryFocusResult = await analyzeGoPerformance({
        code: testData.problematicCode,
        filename: 'main.go',
        focus: 'memory',
        category: 'allocation',
      });

      await this.assert(
        memoryFocusResult.summary && memoryFocusResult.summary.focus === 'memory',
        'Performance analyzer supports focused analysis',
        'performance',
      );
    } catch (error) {
      await this.assert(false, `Performance analyzer test failed: ${error.message}`, 'performance');
    }
  }

  async testGoTestAnalyzer() {
    this.log('\\n🧪 Testing Go Test Analyzer...');

    try {
      // Test test analysis
      const testResult = await analyzeGoTests({
        code: testData.testCode,
        filename: 'main_test.go',
        sourceCode: testData.goodCode,
        focus: 'all',
      });

      await this.assert(
        testResult.content && testResult.content[0].text.includes('Go Test Analysis Results'),
        'Test analyzer returns proper structure',
        'test',
      );

      await this.assert(
        testResult.metrics && testResult.metrics.hasOwnProperty('totalTests'),
        'Test analyzer provides metrics',
        'test',
      );

      // Test coverage analysis
      const coverageResult = await analyzeGoTests({
        code: testData.testCode,
        filename: 'main_test.go',
        sourceCode: testData.goodCode,
        focus: 'coverage',
      });

      await this.assert(
        coverageResult.summary && coverageResult.summary.focus === 'coverage',
        'Test analyzer supports coverage analysis',
        'test',
      );

      // Test with non-test file
      const nonTestResult = await analyzeGoTests({
        code: testData.goodCode,
        filename: 'main.go',
      });

      await this.assert(
        nonTestResult.content && nonTestResult.content[0].text.includes('Warning'),
        'Test analyzer detects non-test files',
        'test',
      );
    } catch (error) {
      await this.assert(false, `Test analyzer test failed: ${error.message}`, 'test');
    }
  }

  async testGoDependencyScanner() {
    this.log('\\n📦 Testing Go Dependency Scanner...');

    try {
      // Test dependency scanning
      const depResult = await scanGoDependencies({
        goMod: testData.goMod,
        goSum: testData.goSum,
        scanType: 'all',
        severity: 'all',
      });

      await this.assert(
        depResult.content && depResult.content[0].text.includes('Go Dependency Scan Results'),
        'Dependency scanner returns proper structure',
        'dependency',
      );

      await this.assert(
        depResult.module && depResult.module.hasOwnProperty('name'),
        'Dependency scanner provides module info',
        'dependency',
      );

      // Test specific scan types
      const vulnScanResult = await scanGoDependencies({
        goMod: testData.goMod,
        scanType: 'vulnerabilities',
        severity: 'high',
      });

      await this.assert(
        vulnScanResult.summary && vulnScanResult.summary.scanType === 'vulnerabilities',
        'Dependency scanner supports vulnerability-only scanning',
        'dependency',
      );

      // Test invalid go.mod
      const invalidResult = await scanGoDependencies({
        goMod: 'invalid go.mod content',
      });

      await this.assert(
        invalidResult.content && invalidResult.content[0].text.includes('Error'),
        'Dependency scanner validates go.mod format',
        'dependency',
      );
    } catch (error) {
      await this.assert(false, `Dependency scanner test failed: ${error.message}`, 'dependency');
    }
  }

  async testIntegration() {
    this.log('\\n🔗 Testing Tool Integration...');

    try {
      // Test that all tools can work with the same code
      const code = testData.problematicCode;

      const [analyzerResult, formatterResult, securityResult, perfResult] = await Promise.all([
        analyzeGoCode({ code, filename: 'test.go', tools: ['vet'], limit: 5 }),
        formatGoCode({ code, filename: 'test.go', tool: 'gofmt', check: true }),
        scanGoSecurity({ code, filename: 'test.go', tools: ['unsafe-analysis'], limit: 5 }),
        analyzeGoPerformance({ code, filename: 'test.go', focus: 'all', limit: 5 }),
      ]);

      await this.assert(
        analyzerResult.content &&
          formatterResult.content &&
          securityResult.content &&
          perfResult.content,
        'All tools can process the same code concurrently',
        'integration',
      );

      // Test tool consistency
      const allResults = [analyzerResult, formatterResult, securityResult, perfResult];
      const allHaveContent = allResults.every(
        (result) => result.content && Array.isArray(result.content) && result.content.length > 0,
      );

      await this.assert(
        allHaveContent,
        'All tools return consistent content structure',
        'integration',
      );
    } catch (error) {
      await this.assert(false, `Integration test failed: ${error.message}`, 'integration');
    }
  }

  async testErrorHandling() {
    this.log('\\n⚠️  Testing Error Handling...');

    try {
      // Test empty code
      const emptyCodeResult = await analyzeGoCode({
        code: '',
        filename: 'test.go',
      });

      await this.assert(
        emptyCodeResult.content && emptyCodeResult.content[0].text.includes('Error'),
        'Tools handle empty code gracefully',
        'error-handling',
      );

      // Test invalid parameters
      const invalidParamsResult = await analyzeGoPerformance({
        code: testData.goodCode,
        filename: 'test.go',
        limit: -1, // Invalid limit
      });

      await this.assert(
        invalidParamsResult.content,
        'Tools handle invalid parameters',
        'error-handling',
      );

      // Test very large code (should be rejected)
      const largeCode = 'package main\\n' + 'var x int\\n'.repeat(50000);
      const largeCodeResult = await formatGoCode({
        code: largeCode,
        filename: 'test.go',
      });

      await this.assert(
        largeCodeResult.content && largeCodeResult.content[0].text.includes('Error'),
        'Tools reject oversized code',
        'error-handling',
      );
    } catch (error) {
      await this.assert(false, `Error handling test failed: ${error.message}`, 'error-handling');
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Go Tools Test Suite...');

    await this.testGoCodeAnalyzer();
    await this.testGoFormatter();
    await this.testGoSecurityScanner();
    await this.testGoPerformanceAnalyzer();
    await this.testGoTestAnalyzer();
    await this.testGoDependencyScanner();
    await this.testIntegration();
    await this.testErrorHandling();

    this.log('\\n📊 Comprehensive Test Results Summary:');
    this.log(`✅ Total Passed: ${this.passed}`);
    this.log(`❌ Total Failed: ${this.failed}`);
    this.log(
      `📈 Overall Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`,
    );

    this.log('\\n📋 Results by Tool:');
    for (const [tool, results] of Object.entries(this.toolResults)) {
      const total = results.passed + results.failed;
      const rate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : '0.0';
      this.log(`  ${tool}: ${results.passed}/${total} (${rate}%)`);
    }

    if (this.failed === 0) {
      this.log('\\n🎉 All tests passed! Go tools are fully functional.');
      return true;
    } else {
      this.log('\\n⚠️  Some tests failed. Please review the implementation.');
      return false;
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ComprehensiveGoToolsTest();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

export { ComprehensiveGoToolsTest };
