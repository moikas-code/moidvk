#!/usr/bin/env node

/**
 * Basic test for Go language tools
 * Tests the Go code analyzer and formatter implementations
 */

import { analyzeGoCode } from '../lib/go/go-code-analyzer.js';
import { formatGoCode } from '../lib/go/go-formatter.js';

// Test Go code samples
const testCodes = {
  good: `package main

import (
    "fmt"
    "os"
)

func main() {
    fmt.Println("Hello, World!")
    if len(os.Args) > 1 {
        fmt.Printf("Arguments: %v\\n", os.Args[1:])
    }
}`,

  needsFormatting: `package main
import"fmt"
func main(){fmt.Println("Hello, World!")}`,

  withIssues: `package main

import (
    "fmt"
    "unsafe"
)

func main() {
    var x int = 42
    ptr := unsafe.Pointer(&x)
    fmt.Printf("Pointer: %p\\n", ptr)
    
    // Unused variable
    unused := "this is not used"
    
    // Inefficient assignment
    var slice []int
    for i := 0; i < 10; i++ {
        slice = append(slice, i)
    }
}`,
};

class GoToolsTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async assert(condition, message) {
    if (condition) {
      this.passed++;
      this.log(`✅ PASS: ${message}`);
    } else {
      this.failed++;
      this.log(`❌ FAIL: ${message}`);
    }
  }

  async testGoCodeAnalyzer() {
    this.log('\\n🧪 Testing Go Code Analyzer...');

    try {
      // Test with good code
      const goodResult = await analyzeGoCode({
        code: testCodes.good,
        filename: 'main.go',
        tools: ['vet'],
        limit: 10,
      });

      await this.assert(
        goodResult.content && goodResult.content[0].text.includes('Go Code Analysis Results'),
        'Go analyzer returns proper structure for good code',
      );

      // Test with problematic code
      const issuesResult = await analyzeGoCode({
        code: testCodes.withIssues,
        filename: 'main.go',
        tools: ['vet'],
        limit: 10,
      });

      await this.assert(
        issuesResult.content && issuesResult.content[0].text.includes('Issues Found'),
        'Go analyzer detects issues in problematic code',
      );

      // Test validation
      const invalidResult = await analyzeGoCode({
        code: '',
        filename: 'main.go',
      });

      await this.assert(
        invalidResult.content && invalidResult.content[0].text.includes('❌ Error'),
        'Go analyzer validates empty code',
      );
    } catch (error) {
      await this.assert(false, `Go analyzer test failed: ${error.message}`);
    }
  }

  async testGoFormatter() {
    this.log('\\n🎨 Testing Go Formatter...');

    try {
      // Test formatting unformatted code
      const formatResult = await formatGoCode({
        code: testCodes.needsFormatting,
        filename: 'main.go',
        tool: 'gofmt',
      });

      await this.assert(
        formatResult.content && formatResult.content[0].text.includes('Go Code Formatting Results'),
        'Go formatter returns proper structure',
      );

      await this.assert(
        formatResult.formatted && formatResult.formatted !== testCodes.needsFormatting,
        'Go formatter actually formats code',
      );

      // Test check mode
      const checkResult = await formatGoCode({
        code: testCodes.needsFormatting,
        filename: 'main.go',
        tool: 'gofmt',
        check: true,
      });

      await this.assert(
        checkResult.needsFormatting === true,
        'Go formatter check mode detects formatting needed',
      );

      // Test already formatted code
      const alreadyFormattedResult = await formatGoCode({
        code: testCodes.good,
        filename: 'main.go',
        tool: 'gofmt',
        check: true,
      });

      await this.assert(
        alreadyFormattedResult.needsFormatting === false,
        'Go formatter check mode detects no formatting needed for good code',
      );

      // Test validation
      const invalidFormatResult = await formatGoCode({
        code: '',
        filename: 'main.go',
      });

      await this.assert(
        invalidFormatResult.content && invalidFormatResult.content[0].text.includes('❌ Error'),
        'Go formatter validates empty code',
      );
    } catch (error) {
      await this.assert(false, `Go formatter test failed: ${error.message}`);
    }
  }

  async testGoValidation() {
    this.log('\\n🔍 Testing Go Validation Utilities...');

    try {
      // Import validation functions
      const {
        validateGoCode,
        sanitizeGoFilename,
        detectGoVersion,
        extractGoImports,
        hasCGO,
        hasUnsafeCode,
        getGoFileType,
      } = await import('../lib/utils/go-validation.js');

      // Test code validation
      const validCode = validateGoCode(testCodes.good);
      await this.assert(validCode.valid === true, 'Valid Go code passes validation');

      const invalidCode = validateGoCode('');
      await this.assert(invalidCode.valid === false, 'Empty code fails validation');

      // Test filename sanitization
      const sanitized = sanitizeGoFilename('test.txt');
      await this.assert(sanitized === 'test.txt.go', 'Filename sanitization adds .go extension');

      const alreadyGo = sanitizeGoFilename('main.go');
      await this.assert(alreadyGo === 'main.go', 'Go filename remains unchanged');

      // Test Go version detection
      const version = detectGoVersion('go 1.21\\n\\nmodule test');
      await this.assert(version === '1.21', 'Go version detection works');

      // Test import extraction
      const imports = extractGoImports(testCodes.good);
      await this.assert(
        imports.includes('fmt') && imports.includes('os'),
        'Import extraction finds fmt and os',
      );

      // Test CGO detection
      const cgoCode = 'import "C"\\n#include <stdio.h>';
      const hasCGOResult = hasCGO(cgoCode);
      await this.assert(hasCGOResult === true, 'CGO detection works');

      // Test unsafe code detection
      const unsafeResult = hasUnsafeCode(testCodes.withIssues);
      await this.assert(unsafeResult === true, 'Unsafe code detection works');

      // Test file type detection
      const fileType = getGoFileType('main.go', testCodes.good);
      await this.assert(fileType === 'main', 'File type detection identifies main package');
    } catch (error) {
      await this.assert(false, `Go validation test failed: ${error.message}`);
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Go Tools Test Suite...');

    await this.testGoValidation();
    await this.testGoFormatter();
    await this.testGoCodeAnalyzer();

    this.log('\\n📊 Test Results Summary:');
    this.log(`✅ Passed: ${this.passed}`);
    this.log(`❌ Failed: ${this.failed}`);
    this.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);

    if (this.failed === 0) {
      this.log('\\n🎉 All tests passed! Go tools are working correctly.');
      return true;
    } else {
      this.log('\\n⚠️  Some tests failed. Please check the implementation.');
      return false;
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new GoToolsTest();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

export { GoToolsTest };
