#!/usr/bin/env bun

/**
 * Test the integrated security system
 */

import { UniversalSandbox } from '../lib/security/UniversalSandbox.js';
import { SecureCommandExecutor } from '../lib/security/SecureCommandExecutor.js';

async function testSecurityIntegration() {
  console.log('Testing security integration...\n');

  // Create policy manager
  const policyManager = new UniversalSandbox({
    mode: 'block',
    performanceOptimization: true
  });

  // Test 1: Check allowed command
  console.log('Test 1: Allowed command (ls)');
  const executor1 = new SecureCommandExecutor('.', {
    securityLevel: 'BALANCED',
    policyManager
  });
  
  try {
    const result1 = await executor1.execute('ls', ['-la']);
    console.log('✅ ls command executed successfully');
    console.log(`   Files listed: ${result1.output.split('\n').length} lines`);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  // Test 2: Check command requiring consent (rm)
  console.log('\nTest 2: Command requiring consent (rm)');
  const executor2 = new SecureCommandExecutor('.', {
    securityLevel: 'BALANCED',
    policyManager
  });
  
  try {
    const result2 = await executor2.execute('rm', ['test.txt']);
    if (result2.requiresConsent) {
      console.log('✅ rm command requires consent as expected');
      console.log(`   Message: ${result2.message}`);
    } else if (result2.success === false) {
      console.log('❌ rm command was blocked instead of requiring consent');
      console.log(`   Reason: ${result2.error}`);
    } else {
      console.log('❌ rm command was executed without consent!');
    }
  } catch (error) {
    console.log('❌ rm command threw error instead of requiring consent');
    console.log(`   Reason: ${error.message}`);
  }

  // Test 3: Check command requiring consent (curl)
  console.log('\nTest 3: Command requiring consent (curl)');
  const executor3 = new SecureCommandExecutor('.', {
    securityLevel: 'BALANCED',
    policyManager
  });
  
  try {
    const result3 = await executor3.execute('curl', ['https://example.com']);
    if (result3.requiresConsent) {
      console.log('✅ curl command requires consent as expected');
      console.log(`   Message: ${result3.message}`);
    } else if (result3.success === false) {
      console.log('❌ curl command was blocked instead of requiring consent');
      console.log(`   Reason: ${result3.error}`);
    } else {
      console.log('❌ curl command was executed without consent!');
    }
  } catch (error) {
    console.log('❌ curl command threw error instead of requiring consent');
    console.log(`   Reason: ${error.message}`);
  }

  // Test 4: Test policy manager directly
  console.log('\nTest 4: Direct policy checks');
  
  const policy1 = policyManager.checkCommandPolicy('ls', ['-la']);
  console.log(`   ls policy: ${policy1.action} - ${policy1.reason || 'OK'}`);
  
  const policy2 = policyManager.checkCommandPolicy('rm', ['-rf', '/']);
  console.log(`   rm policy: ${policy2.action} - ${policy2.reason}`);
  
  const policy3 = policyManager.checkCommandPolicy('curl', ['https://example.com']);
  console.log(`   curl policy: ${policy3.action} - ${policy3.reason}`);
  
  const policy4 = policyManager.checkCommandPolicy('sudo', ['rm', '-rf', '/']);
  console.log(`   sudo policy: ${policy4.action} - ${policy4.reason}`);

  // Test 5: Test rm with safe usage requires consent
  console.log('\nTest 5: Safe rm usage');
  const policy5 = policyManager.checkCommandPolicy('rm', ['test.txt']);
  console.log(`   rm test.txt: ${policy5.action} - ${policy5.reason}`);
  
  // Test 6: Test with user consent
  console.log('\nTest 6: Execute rm with user consent');
  const executor6 = new SecureCommandExecutor('.', {
    securityLevel: 'BALANCED',
    policyManager
  });
  
  // Create a test file first
  try {
    await Bun.write('test-file-to-delete.txt', 'This is a test file');
    console.log('   Created test file');
    
    // Try to delete with consent (would work in real scenario with user confirmation)
    const result6 = await executor6.execute('rm', ['test-file-to-delete.txt']);
    if (result6.requiresConsent) {
      console.log('✅ rm requires consent for safe file deletion');
      console.log('   Would delete: test-file-to-delete.txt (with user confirmation)');
    }
    
    // Clean up
    await Bun.write('test-file-to-delete.txt', '').then(() => {
      require('fs').unlinkSync('test-file-to-delete.txt');
    });
  } catch (error) {
    console.log('   Test file handling:', error.message);
  }

  console.log('\n✅ Security integration test completed');
}

// Run the test
testSecurityIntegration().catch(console.error);