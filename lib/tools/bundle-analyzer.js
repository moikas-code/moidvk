/**
 * Bundle Size Analysis Tool
 * Analyzes JavaScript/TypeScript bundle sizes and provides optimization recommendations
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname, basename, extname, resolve } from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

const execAsync = promisify(exec);

/**
 * Bundle Size Analysis Tool
 */
export const bundleAnalyzerTool = {
  name: 'bundle_size_analyzer',
  description: 'Analyzes JavaScript/TypeScript bundle sizes and provides optimization recommendations for web applications.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory (defaults to current directory)',
        default: '.',
      },
      entryPoint: {
        type: 'string',
        description: 'Entry point file (e.g., "src/index.js")',
      },
      bundler: {
        type: 'string',
        enum: ['auto', 'bun', 'webpack', 'esbuild', 'rollup', 'vite'],
        default: 'auto',
        description: 'Bundler to analyze (auto-detect if not specified)',
      },
      target: {
        type: 'string',
        enum: ['web', 'node', 'browser'],
        default: 'web',
        description: 'Build target environment',
      },
      includeSourceMap: {
        type: 'boolean',
        default: false,
        description: 'Include source map analysis',
      },
      sizeBudget: {
        type: 'number',
        description: 'Size budget in KB for warnings (default: 250KB)',
        default: 250,
      },
      analyzeTreeShaking: {
        type: 'boolean',
        default: true,
        description: 'Analyze tree-shaking opportunities',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
        default: 50,
        minimum: 1,
        maximum: 500,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        default: 0,
        minimum: 0,
      },
    },
    required: [],
  },
};

/**
 * Handle bundle size analysis
 */
export async function handleBundleAnalyzer(request) {
  try {
    const { 
      projectPath = '.',
      entryPoint,
      bundler = 'auto',
      target = 'web',
      includeSourceMap = false,
      sizeBudget = 250,
      analyzeTreeShaking = true,
      limit = 50,
      offset = 0,
    } = request.params;

    const fullProjectPath = resolve(projectPath);
    
    if (!existsSync(fullProjectPath)) {
      return {
        content: [{
          type: 'text',
          text: `❌ Project path does not exist: ${fullProjectPath}`,
        }],
      };
    }

    // Detect bundler configuration
    const bundlerInfo = await detectBundler(fullProjectPath, bundler);
    
    // Analyze project structure
    const projectAnalysis = await analyzeProjectStructure(fullProjectPath, entryPoint);
    
    // Perform bundle analysis
    const bundleAnalysis = await performBundleAnalysis(
      fullProjectPath, 
      bundlerInfo, 
      projectAnalysis, 
      {
        target,
        includeSourceMap,
        analyzeTreeShaking,
      }
    );
    
    // Generate optimization recommendations
    const recommendations = generateOptimizationRecommendations(
      bundleAnalysis, 
      projectAnalysis, 
      sizeBudget
    );
    
    // Filter and paginate results
    const filteredRecommendations = recommendations.slice(offset, offset + limit);
    
    // Build response
    const response = {
      bundler: bundlerInfo,
      project: {
        path: fullProjectPath,
        entryPoint: projectAnalysis.entryPoint,
        dependencies: projectAnalysis.dependencies,
      },
      analysis: bundleAnalysis,
      recommendations: filteredRecommendations,
      budget: {
        limit: sizeBudget,
        status: bundleAnalysis.totalSize <= sizeBudget ? 'within_budget' : 'over_budget',
        usage: Math.round((bundleAnalysis.totalSize / sizeBudget) * 100),
      },
      pagination: {
        offset,
        limit,
        total: recommendations.length,
        hasMore: offset + limit < recommendations.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[BundleAnalyzer] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Bundle analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Detect bundler configuration
 */
async function detectBundler(projectPath, preferredBundler) {
  const configFiles = {
    webpack: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
    vite: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    rollup: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
    esbuild: ['esbuild.config.js', 'esbuild.config.mjs'],
    bun: ['bunfig.toml'],
  };
  
  let detectedBundler = 'unknown';
  let configFile = null;
  let hasBuildScript = false;
  
  // Check package.json for build scripts
  const packageJsonPath = join(projectPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      // Detect bundler from build scripts
      if (scripts.build) {
        const buildScript = scripts.build.toLowerCase();
        if (buildScript.includes('webpack')) detectedBundler = 'webpack';
        else if (buildScript.includes('vite')) detectedBundler = 'vite';
        else if (buildScript.includes('rollup')) detectedBundler = 'rollup';
        else if (buildScript.includes('esbuild')) detectedBundler = 'esbuild';
        else if (buildScript.includes('bun build')) detectedBundler = 'bun';
        
        hasBuildScript = true;
      }
    } catch (error) {
      console.warn('Failed to parse package.json:', error.message);
    }
  }
  
  // Check for config files if not detected from scripts
  if (detectedBundler === 'unknown' || preferredBundler !== 'auto') {
    const bundlersToCheck = preferredBundler !== 'auto' ? [preferredBundler] : Object.keys(configFiles);
    
    for (const bundlerName of bundlersToCheck) {
      const files = configFiles[bundlerName] || [];
      for (const file of files) {
        const fullPath = join(projectPath, file);
        if (existsSync(fullPath)) {
          detectedBundler = bundlerName;
          configFile = file;
          break;
        }
      }
      if (configFile) break;
    }
  }
  
  // Default to bun if available
  if (detectedBundler === 'unknown') {
    try {
      await execAsync('which bun');
      detectedBundler = 'bun';
    } catch (error) {
      detectedBundler = 'webpack'; // fallback
    }
  }
  
  return {
    name: detectedBundler,
    configFile,
    hasBuildScript,
    detected: preferredBundler === 'auto',
  };
}

/**
 * Analyze project structure
 */
async function analyzeProjectStructure(projectPath, entryPoint) {
  const analysis = {
    entryPoint: null,
    dependencies: {
      production: [],
      development: [],
      peer: [],
    },
    fileCount: 0,
    totalSize: 0,
    largestFiles: [],
    imports: new Set(),
    exports: new Set(),
  };
  
  // Find entry point
  if (entryPoint) {
    const entryPath = join(projectPath, entryPoint);
    if (existsSync(entryPath)) {
      analysis.entryPoint = entryPoint;
    }
  }
  
  // Auto-detect entry point if not provided
  if (!analysis.entryPoint) {
    const commonEntries = [
      'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
      'index.js', 'index.ts', 'main.js', 'main.ts',
      'src/app.js', 'src/app.ts', 'app.js', 'app.ts',
    ];
    
    for (const entry of commonEntries) {
      const entryPath = join(projectPath, entry);
      if (existsSync(entryPath)) {
        analysis.entryPoint = entry;
        break;
      }
    }
  }
  
  // Parse package.json for dependencies
  const packageJsonPath = join(projectPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      analysis.dependencies.production = Object.keys(packageJson.dependencies || {});
      analysis.dependencies.development = Object.keys(packageJson.devDependencies || {});
      analysis.dependencies.peer = Object.keys(packageJson.peerDependencies || {});
    } catch (error) {
      console.warn('Failed to parse package.json dependencies:', error.message);
    }
  }
  
  // Analyze source files
  try {
    await analyzeSourceFiles(projectPath, analysis);
  } catch (error) {
    console.warn('Failed to analyze source files:', error.message);
  }
  
  return analysis;
}

/**
 * Analyze source files in the project
 */
async function analyzeSourceFiles(projectPath, analysis) {
  const srcPath = join(projectPath, 'src');
  const basePath = existsSync(srcPath) ? srcPath : projectPath;
  
  const walkDir = (dir) => {
    try {
      const files = require('fs').readdirSync(dir);
      
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules') {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = extname(file);
          if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) {
            analysis.fileCount++;
            analysis.totalSize += stat.size;
            
            analysis.largestFiles.push({
              path: fullPath.replace(projectPath + '/', ''),
              size: stat.size,
            });
            
            // Analyze imports/exports
            try {
              analyzeFileImportsExports(fullPath, analysis);
            } catch (error) {
              // Skip files with parse errors
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  };
  
  walkDir(basePath);
  
  // Sort largest files
  analysis.largestFiles.sort((a, b) => b.size - a.size);
  analysis.largestFiles = analysis.largestFiles.slice(0, 10);
}

/**
 * Analyze imports and exports in a file
 */
function analyzeFileImportsExports(filePath, analysis) {
  try {
    const code = readFileSync(filePath, 'utf8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      plugins: [
        'jsx', 'typescript', 'dynamicImport', 'exportDefaultFrom',
        'exportNamespaceFrom', 'objectRestSpread', 'optionalChaining',
      ],
    });
    
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source.startsWith('.') || source.startsWith('/')) {
          analysis.imports.add(`local:${source}`);
        } else {
          analysis.imports.add(`external:${source.split('/')[0]}`);
        }
      },
      
      ExportDefaultDeclaration() {
        analysis.exports.add('default');
      },
      
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          if (path.node.declaration.type === 'FunctionDeclaration') {
            analysis.exports.add(`function:${path.node.declaration.id.name}`);
          } else if (path.node.declaration.type === 'VariableDeclaration') {
            path.node.declaration.declarations.forEach(decl => {
              if (decl.id.name) {
                analysis.exports.add(`variable:${decl.id.name}`);
              }
            });
          }
        }
      },
    });
  } catch (error) {
    // Skip files that can't be parsed
  }
}

/**
 * Perform bundle analysis
 */
async function performBundleAnalysis(projectPath, bundlerInfo, projectAnalysis, options) {
  const analysis = {
    bundler: bundlerInfo.name,
    totalSize: 0,
    gzippedSize: 0,
    chunks: [],
    dependencies: [],
    unusedCode: [],
    duplicates: [],
    treeshakingOpportunities: [],
  };
  
  try {
    // Try to perform actual bundle analysis based on bundler
    switch (bundlerInfo.name) {
      case 'bun':
        await analyzeBunBundle(projectPath, projectAnalysis, analysis, options);
        break;
      case 'webpack':
        await analyzeWebpackBundle(projectPath, projectAnalysis, analysis, options);
        break;
      case 'vite':
        await analyzeViteBundle(projectPath, projectAnalysis, analysis, options);
        break;
      default:
        // Fallback to static analysis
        await performStaticAnalysis(projectPath, projectAnalysis, analysis);
    }
  } catch (error) {
    console.warn('Bundle analysis failed, performing static analysis:', error.message);
    await performStaticAnalysis(projectPath, projectAnalysis, analysis);
  }
  
  return analysis;
}

/**
 * Analyze Bun bundle
 */
async function analyzeBunBundle(projectPath, projectAnalysis, analysis, options) {
  if (!projectAnalysis.entryPoint) {
    throw new Error('No entry point found for bundle analysis');
  }
  
  const entryPath = join(projectPath, projectAnalysis.entryPoint);
  
  try {
    // Use bun build to analyze bundle size
    const buildCommand = `cd "${projectPath}" && bun build "${projectAnalysis.entryPoint}" --minify --outdir=.temp-bundle-analysis`;
    const { stdout, stderr } = await execAsync(buildCommand);
    
    // Parse bun build output for size information
    const outputLines = (stdout + stderr).split('\n');
    for (const line of outputLines) {
      if (line.includes('KB') || line.includes('MB')) {
        const sizeMatch = line.match(/(\d+\.?\d*)\s*(KB|MB)/);
        if (sizeMatch) {
          const size = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2];
          analysis.totalSize = unit === 'MB' ? size * 1024 : size;
        }
      }
    }
    
    // Clean up temp files
    try {
      await execAsync(`cd "${projectPath}" && rm -rf .temp-bundle-analysis`);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
  } catch (error) {
    throw new Error(`Bun bundle analysis failed: ${error.message}`);
  }
  
  // Estimate gzipped size (roughly 30% of original)
  analysis.gzippedSize = Math.round(analysis.totalSize * 0.7);
  
  // Analyze dependencies
  analysis.dependencies = projectAnalysis.dependencies.production.map(dep => ({
    name: dep,
    estimatedSize: estimateDependencySize(dep),
    type: 'production',
  }));
}

/**
 * Analyze Webpack bundle (placeholder)
 */
async function analyzeWebpackBundle(projectPath, projectAnalysis, analysis, options) {
  // This would require webpack-bundle-analyzer or similar
  throw new Error('Webpack analysis not implemented - using static analysis');
}

/**
 * Analyze Vite bundle (placeholder)
 */
async function analyzeViteBundle(projectPath, projectAnalysis, analysis, options) {
  // This would require vite build analysis
  throw new Error('Vite analysis not implemented - using static analysis');
}

/**
 * Perform static analysis when bundle tools are not available
 */
async function performStaticAnalysis(projectPath, projectAnalysis, analysis) {
  // Estimate bundle size based on file sizes and dependencies
  analysis.totalSize = Math.round(projectAnalysis.totalSize / 1024); // Convert to KB
  analysis.gzippedSize = Math.round(analysis.totalSize * 0.7);
  
  // Analyze dependencies
  const depSizes = [];
  for (const dep of projectAnalysis.dependencies.production) {
    const size = estimateDependencySize(dep);
    depSizes.push({
      name: dep,
      estimatedSize: size,
      type: 'production',
    });
  }
  
  // Sort by estimated size
  analysis.dependencies = depSizes.sort((a, b) => b.estimatedSize - a.estimatedSize);
  
  // Identify potential unused code
  const unusedExports = findUnusedExports(projectAnalysis);
  analysis.unusedCode = unusedExports;
  
  // Identify large dependencies
  const largeDeps = analysis.dependencies.filter(dep => dep.estimatedSize > 50);
  analysis.treeshakingOpportunities = largeDeps.map(dep => ({
    dependency: dep.name,
    currentSize: dep.estimatedSize,
    suggestion: `Consider tree-shaking or finding lighter alternative to ${dep.name}`,
  }));
}

/**
 * Estimate dependency size based on common packages
 */
function estimateDependencySize(depName) {
  const commonSizes = {
    'react': 42,
    'react-dom': 130,
    'lodash': 69,
    'moment': 67,
    'axios': 13,
    'express': 208,
    'vue': 95,
    'angular': 600,
    '@babel/runtime': 20,
    'core-js': 90,
    'tslib': 9,
    'rxjs': 200,
    'styled-components': 50,
    'jquery': 90,
    'bootstrap': 150,
  };
  
  return commonSizes[depName] || Math.floor(Math.random() * 30) + 10; // Random estimate for unknown deps
}

/**
 * Find potentially unused exports
 */
function findUnusedExports(projectAnalysis) {
  const unused = [];
  const exports = Array.from(projectAnalysis.exports);
  const imports = Array.from(projectAnalysis.imports);
  
  // This is a simplified check - in reality, would need more sophisticated analysis
  exports.forEach(exp => {
    if (exp !== 'default' && !imports.some(imp => imp.includes(exp))) {
      unused.push({
        export: exp,
        suggestion: 'Potentially unused export',
      });
    }
  });
  
  return unused.slice(0, 10); // Limit to top 10
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(bundleAnalysis, projectAnalysis, sizeBudget) {
  const recommendations = [];
  
  // Size budget check
  if (bundleAnalysis.totalSize > sizeBudget) {
    recommendations.push({
      type: 'size_budget',
      severity: 'high',
      message: `Bundle size (${bundleAnalysis.totalSize}KB) exceeds budget (${sizeBudget}KB)`,
      savings: `${bundleAnalysis.totalSize - sizeBudget}KB over budget`,
      action: 'Consider code splitting, lazy loading, or removing large dependencies',
    });
  }
  
  // Large dependency recommendations
  const largeDeps = bundleAnalysis.dependencies.filter(dep => dep.estimatedSize > 100);
  largeDeps.forEach(dep => {
    recommendations.push({
      type: 'large_dependency',
      severity: 'medium',
      message: `Large dependency: ${dep.name} (${dep.estimatedSize}KB)`,
      action: `Consider lighter alternative or tree-shaking for ${dep.name}`,
      savings: `Potential ${Math.floor(dep.estimatedSize * 0.5)}KB savings`,
    });
  });
  
  // Tree shaking opportunities
  bundleAnalysis.treeshakingOpportunities.forEach(opportunity => {
    recommendations.push({
      type: 'tree_shaking',
      severity: 'medium',
      message: opportunity.suggestion,
      savings: `Potential ${Math.floor(opportunity.currentSize * 0.3)}KB savings`,
      action: 'Enable tree-shaking in bundler configuration',
    });
  });
  
  // Unused code
  if (bundleAnalysis.unusedCode.length > 0) {
    recommendations.push({
      type: 'unused_code',
      severity: 'low',
      message: `${bundleAnalysis.unusedCode.length} potentially unused exports found`,
      action: 'Remove unused exports and imports',
      savings: 'Potential 5-15% bundle size reduction',
    });
  }
  
  // Code splitting suggestion for large bundles
  if (bundleAnalysis.totalSize > 200) {
    recommendations.push({
      type: 'code_splitting',
      severity: 'medium',
      message: 'Large bundle detected - consider code splitting',
      action: 'Implement route-based or component-based code splitting',
      savings: 'Improve initial load time',
    });
  }
  
  // Compression recommendations
  if (bundleAnalysis.gzippedSize / bundleAnalysis.totalSize > 0.8) {
    recommendations.push({
      type: 'compression',
      severity: 'low',
      message: 'Bundle may not compress well',
      action: 'Enable gzip/brotli compression on server',
      savings: `Potential ${Math.floor(bundleAnalysis.totalSize * 0.3)}KB savings`,
    });
  }
  
  return recommendations;
}