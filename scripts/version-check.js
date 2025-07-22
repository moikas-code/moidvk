#!/usr/bin/env node
/**
 * Version Consistency Check Script
 * Ensures package.json, README, git tags, and server.js versions are synchronized
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const projectRoot = process.cwd();

function checkVersionConsistency() {
  console.log('🔍 Checking version consistency...\n');

  const results = {
    packageJson: null,
    readme: null,
    serverJs: null,
    gitTag: null,
    consistent: false,
    issues: [],
  };

  try {
    // 1. Check package.json
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      results.packageJson = packageJson.version;
      console.log(`📦 package.json: ${results.packageJson}`);
    } else {
      results.issues.push('❌ package.json not found');
    }

    // 2. Check README.md
    const readmePath = join(projectRoot, 'README.md');
    if (existsSync(readmePath)) {
      const readmeContent = readFileSync(readmePath, 'utf8');
      const versionMatch = readmeContent.match(/version-([^-]+)-/);
      results.readme = versionMatch ? versionMatch[1] : null;
      console.log(`📖 README.md: ${results.readme || 'Not found'}`);
    } else {
      results.issues.push('❌ README.md not found');
    }

    // 3. Check server.js
    const serverJsPath = join(projectRoot, 'server.js');
    if (existsSync(serverJsPath)) {
      const serverContent = readFileSync(serverJsPath, 'utf8');
      const versionMatch = serverContent.match(/version:\s*['"]([^'"]+)['"]/);
      results.serverJs = versionMatch ? versionMatch[1] : null;
      console.log(`🖥️  server.js: ${results.serverJs || 'Not found'}`);
    } else {
      results.issues.push('❌ server.js not found');
    }

    // 4. Check git tags
    try {
      const gitOutput = execSync('git tag --sort=-version:refname', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      const tags = gitOutput
        .trim()
        .split('\n')
        .filter((tag) => tag);
      results.gitTag = tags[0] || null;
      console.log(`🏷️  Latest git tag: ${results.gitTag || 'None'}`);
    } catch (error) {
      results.issues.push('❌ Failed to read git tags');
    }

    console.log('\n' + '─'.repeat(50));

    // 5. Check consistency
    const versions = [results.packageJson, results.readme, results.serverJs].filter(
      (v) => v !== null,
    );

    const gitTagVersion = results.gitTag ? results.gitTag.replace(/^v/, '') : null;

    if (versions.length === 0) {
      results.issues.push('❌ No versions found');
    } else {
      const uniqueVersions = [...new Set(versions)];

      if (uniqueVersions.length === 1) {
        console.log(`✅ All file versions are consistent: ${uniqueVersions[0]}`);

        if (gitTagVersion && gitTagVersion !== uniqueVersions[0]) {
          results.issues.push(
            `⚠️  Git tag (${results.gitTag}) doesn't match file versions (${uniqueVersions[0]})`,
          );
        } else if (gitTagVersion) {
          console.log('✅ Git tag matches file versions');
          results.consistent = true;
        } else {
          results.issues.push(`⚠️  No git tag found for version ${uniqueVersions[0]}`);
        }
      } else {
        results.issues.push('❌ Version mismatch found:');
        if (results.packageJson) results.issues.push(`   package.json: ${results.packageJson}`);
        if (results.readme) results.issues.push(`   README.md: ${results.readme}`);
        if (results.serverJs) results.issues.push(`   server.js: ${results.serverJs}`);
      }
    }

    // 6. Report results
    console.log('\n📋 Summary:');
    if (results.consistent) {
      console.log('🎉 All versions are consistent and properly tagged!');
      process.exit(0);
    } else {
      console.log('🔧 Issues found:');
      results.issues.forEach((issue) => console.log(`   ${issue}`));

      console.log('\n💡 To fix version consistency:');
      console.log('   1. Update all files to the same version');
      console.log('   2. Create a git tag: git tag v<version>');
      console.log('   3. Push the tag: git push origin v<version>');

      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Version check failed:', error.message);
    process.exit(1);
  }
}

// Run the check
checkVersionConsistency();
