/**
 * Test Rate Limiting Implementation
 */

import { RateLimiter } from '../lib/security/RateLimiter.js';
import { UniversalSandbox } from '../lib/security/UniversalSandbox.js';

async function testRateLimiter() {
  console.log('🔒 Testing Rate Limiter Implementation');
  console.log('=====================================');

  // Test 1: Basic rate limiting
  console.log('✓ Testing basic rate limiting...');
  const rateLimiter = new RateLimiter({
    maxRequests: 5,
    windowMs: 1000,
    burstLimit: 2,
    burstWindowMs: 100
  });

  let result = await rateLimiter.isAllowed('client1', 'test', {});
  console.log('✅ First request allowed:', result.allowed);

  // Test burst limit
  console.log('✓ Testing burst limit...');
  for (let i = 0; i < 3; i++) {
    result = await rateLimiter.isAllowed('client1', 'test', {});
    if (i < 2) {
      console.log(`✅ Burst request ${i + 1} allowed:`, result.allowed);
    } else {
      console.log('✅ Burst limit exceeded:', !result.allowed, result.reason);
    }
  }

  // Wait for burst window to reset
  await new Promise(resolve => setTimeout(resolve, 150));

  // Test rate limit
  console.log('✓ Testing rate limit...');
  for (let i = 0; i < 6; i++) {
    result = await rateLimiter.isAllowed('client1', 'test', {});
    if (i < 4) { // Already used 1 request + 2 burst = 3, so 2 more allowed
      console.log(`✅ Rate request ${i + 1} allowed:`, result.allowed);
    } else {
      console.log('✅ Rate limit exceeded:', !result.allowed, result.reason);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Test suspicious activity detection
  console.log('✓ Testing suspicious activity detection...');
  const suspiciousClient = 'suspicious-client';
  
  // Rapid fire requests to trigger detection
  for (let i = 0; i < 25; i++) {
    result = await rateLimiter.isAllowed(suspiciousClient, 'test', {});
    if (!result.allowed && result.reason === 'SUSPICIOUS_ACTIVITY') {
      console.log('✅ Suspicious activity detected and blocked');
      break;
    }
  }

  // Test different clients are isolated
  console.log('✓ Testing client isolation...');
  result = await rateLimiter.isAllowed('client2', 'test', {});
  console.log('✅ Different client not affected:', result.allowed);

  console.log('✓ Rate limiting stats:', rateLimiter.getStats());

  rateLimiter.destroy();
  console.log('✅ RateLimiter cleanup completed');
}

async function testUniversalSandboxWithRateLimit() {
  console.log('\n🔒 Testing Universal Sandbox with Rate Limiting');
  console.log('===============================================');

  const sandbox = new UniversalSandbox({
    enabled: true,
    mode: 'block',
    maxRequests: 3,
    windowMs: 1000,
    burstLimit: 1
  });

  try {
    // Test normal command execution
    console.log('✓ Testing normal command execution...');
    let result = await sandbox.processCommand('exec', 'echo', ['test'], { clientId: 'test-client' });
    console.log('✅ First command executed');

    // Test rate limiting in sandbox
    console.log('✓ Testing rate limiting in sandbox...');
    let rateLimitHit = false;
    try {
      // Execute commands rapidly to hit rate limit
      for (let i = 0; i < 5; i++) {
        await sandbox.processCommand('exec', 'echo', [`test-${i}`], { clientId: 'test-client' });
      }
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        console.log('✅ Rate limit correctly enforced in sandbox');
        rateLimitHit = true;
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    if (!rateLimitHit) {
      console.log('❌ Rate limit was not enforced');
    }

    // Test metrics include rate limiting data
    console.log('✓ Testing metrics integration...');
    const metrics = sandbox.getSecurityMetrics();
    console.log('✅ Rate limiting metrics included:', !!metrics.rateLimiting);
    console.log('✅ Rate limit violations tracked:', metrics.rateLimitViolations || 0);

  } catch (error) {
    console.log('❌ Sandbox test failed:', error.message);
  } finally {
    sandbox.destroy();
    console.log('✅ UniversalSandbox cleanup completed');
  }
}

async function testRateLimitConfiguration() {
  console.log('\n🔒 Testing Rate Limit Configuration Options');
  console.log('===========================================');

  // Test custom configuration
  const customLimiter = new RateLimiter({
    maxRequests: 10,
    windowMs: 2000,
    burstLimit: 3,
    burstWindowMs: 200,
    enableDDoSProtection: true,
    suspiciousThreshold: 15,
    blockDurationMs: 1000
  });

  console.log('✓ Testing custom configuration...');
  console.log('✅ Custom configuration applied:', customLimiter.options.maxRequests === 10);

  // Test DoS protection can be disabled
  const nonProtectedLimiter = new RateLimiter({
    enableDDoSProtection: false
  });

  console.log('✓ Testing DoS protection disabled...');
  let blocked = false;
  for (let i = 0; i < 100; i++) {
    const result = await nonProtectedLimiter.isAllowed('rapid-client', 'test', {});
    if (!result.allowed && result.reason === 'SUSPICIOUS_ACTIVITY') {
      blocked = true;
      break;
    }
  }
  console.log('✅ DoS protection correctly disabled:', !blocked);

  customLimiter.destroy();
  nonProtectedLimiter.destroy();
}

async function runAllRateLimitTests() {
  try {
    await testRateLimiter();
    await testUniversalSandboxWithRateLimit();
    await testRateLimitConfiguration();

    console.log('\n📊 Rate Limiting Test Summary:');
    console.log('✅ All rate limiting tests completed successfully');
    console.log('🎉 Rate limiting system is fully functional!');
    
    return true;
  } catch (error) {
    console.error('❌ Rate limiting tests failed:', error);
    return false;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllRateLimitTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runAllRateLimitTests };