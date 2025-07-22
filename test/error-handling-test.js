#!/usr/bin/env node

/**
 * Comprehensive Error Handling Test Suite
 * Tests the ErrorHandler integration with UniversalSandbox
 */

import { UniversalSandbox } from '../lib/security/UniversalSandbox.js';
import { ErrorHandler } from '../lib/security/ErrorHandler.js';

console.log('🧪 Testing Comprehensive Error Handling');
console.log('=======================================');

async function testErrorHandling() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error.message}`);
    }
  }

  // Test 1: ErrorHandler can be instantiated
  await test('ErrorHandler can be instantiated', async () => {
    const handler = new ErrorHandler();
    return handler && typeof handler.handleError === 'function';
  });

  // Test 2: Basic error handling functionality
  await test('Basic error handling works', async () => {
    const handler = new ErrorHandler({ logErrorDetails: false });
    try {
      await handler.handleError(new Error('Test error'), { operation: 'test' });
      return false; // Should not reach here
    } catch (error) {
      return error.message.includes('Test error');
    }
  });

  // Test 3: Error categorization
  await test('Error categorization works correctly', async () => {
    const handler = new ErrorHandler({ logErrorDetails: false });
    const category1 = handler.categorizeError('SECURITY_VIOLATION');
    const category2 = handler.categorizeError('NETWORK_ERROR');
    const category3 = handler.categorizeError('INVALID_COMMAND');
    
    return category1 === 'CRITICAL' && 
           category2 === 'RECOVERABLE' && 
           category3 === 'INPUT_ERROR';
  });

  // Test 4: Retry mechanism for recoverable errors
  await test('Retry mechanism works for recoverable errors', async () => {
    const handler = new ErrorHandler({ 
      maxRetryAttempts: 2, 
      retryDelayMs: 10,
      logErrorDetails: false 
    });
    
    const error = new Error('TIMEOUT: Operation timed out');
    error.type = 'TIMEOUT';
    
    const result = await handler.handleError(error, { operation: 'testRetry' });
    return result && result.shouldRetry === true && result.retryAttempt === 1;
  });

  // Test 5: Circuit breaker functionality
  await test('Circuit breaker prevents cascading failures', async () => {
    const handler = new ErrorHandler({ 
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 2,
      logErrorDetails: false 
    });
    
    // Trigger failures to open circuit breaker
    handler.updateCircuitBreaker('testOperation', false);
    handler.updateCircuitBreaker('testOperation', false);
    
    const isOpen = handler.isCircuitBreakerOpen('testOperation');
    return isOpen === true;
  });

  // Test 6: Input error handling returns structured response
  await test('Input errors return structured response', async () => {
    const handler = new ErrorHandler({ logErrorDetails: false });
    const error = new Error('INVALID_COMMAND: Command not allowed');
    error.type = 'INVALID_COMMAND';
    
    const result = await handler.handleError(error, { operation: 'testInput' });
    return result && !result.success && result.error && result.errorInfo;
  });

  // Test 7: Error sanitization removes sensitive data
  await test('Error sanitization removes sensitive data', async () => {
    const handler = new ErrorHandler({ sanitizeErrors: true, logErrorDetails: false });
    const error = new Error('Database error: password=secret123 api_key=abc123');
    
    const errorInfo = handler.analyzeError(error, { operation: 'test' });
    return errorInfo.message.includes('[REDACTED]') && errorInfo.sanitized === true;
  });

  // Test 8: UniversalSandbox has ErrorHandler integrated
  await test('UniversalSandbox has ErrorHandler integrated', async () => {
    const sandbox = new UniversalSandbox({ enabled: false });
    return sandbox.errorHandler && typeof sandbox.errorHandler.handleError === 'function';
  });

  // Test 9: Security metrics include error handling data
  await test('Security metrics include error handling data', async () => {
    const sandbox = new UniversalSandbox({ enabled: false });
    const metrics = sandbox.getSecurityMetrics();
    return metrics.errorHandling && 
           typeof metrics.errorHandling.totalErrors === 'number';
  });

  // Test 10: Critical error callback is triggered
  await test('Critical error callback is triggered', async () => {
    let callbackTriggered = false;
    const handler = new ErrorHandler({ 
      criticalErrorCallback: async (errorInfo) => {
        callbackTriggered = true;
        return { handled: true };
      },
      logErrorDetails: false 
    });
    
    const error = new Error('SECURITY_VIOLATION: Injection detected');
    error.type = 'SECURITY_VIOLATION';
    
    try {
      await handler.handleError(error, { operation: 'testCritical' });
    } catch (e) {
      // Expected to throw
    }
    
    return callbackTriggered === true;
  });

  // Test 11: Enhanced error context in SecureCommandExecutor
  await test('Enhanced error context in SecureCommandExecutor', async () => {
    const sandbox = new UniversalSandbox({ enabled: false, mode: 'monitor' });
    
    try {
      // This should fail with enhanced error context
      await sandbox.processCommand('exec', 'invalidcommand12345', []);
      return false;
    } catch (error) {
      return error.message.includes('Universal Sandbox Error') || 
             error.message.includes('Input validation failed');
    }
  });

  // Test 12: Error metrics tracking
  await test('Error metrics are tracked correctly', async () => {
    const handler = new ErrorHandler({ logErrorDetails: false });
    
    // Generate some errors
    try { await handler.handleError(new Error('Test error 1'), { operation: 'test1' }); } catch {}
    try { await handler.handleError(new Error('Test error 2'), { operation: 'test2' }); } catch {}
    
    const metrics = handler.getErrorMetrics();
    return metrics.totalErrors >= 2 && Object.keys(metrics.errorsByType).length > 0;
  });

  console.log('\n📊 Error Handling Test Summary:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`📈 Success Rate: ${Math.round((passed/total) * 100)}%`);

  if (passed === total) {
    console.log('\n🎉 All error handling tests passed!');
    console.log('✅ Comprehensive error handling implemented');
    console.log('✅ Retry mechanisms and circuit breakers working');
    console.log('✅ Error categorization and sanitization functional');
    console.log('✅ UniversalSandbox integration successful');
    return true;
  } else {
    console.log('\n⚠️ Some error handling tests failed');
    return false;
  }
}

testErrorHandling().catch(console.error);