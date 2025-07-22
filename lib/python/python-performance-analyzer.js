/**
 * Python Performance Analyzer
 * Analyzes Python code for performance issues, memory usage patterns, and optimization opportunities
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, extname } from 'path';

const execAsync = promisify(exec);

/**
 * Python Performance Analyzer Tool
 */
export const pythonPerformanceAnalyzerTool = {
  name: 'python_performance_analyzer',
  description: 'Analyzes Python code for performance issues, inefficient patterns, and optimization opportunities. Identifies memory leaks, algorithmic inefficiencies, and suggests improvements.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Python code to analyze for performance (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "main.py")',
      },
      projectPath: {
        type: 'string',
        description: 'Path to Python project directory for comprehensive analysis',
      },
      category: {
        type: 'string',
        enum: ['memory', 'cpu', 'io', 'async', 'algorithms', 'all'],
        default: 'all',
        description: 'Performance aspect to focus on',
      },
      focus: {
        type: 'string',
        enum: ['general', 'data_science', 'web', 'cli'],
        default: 'general',
        description: 'Application type focus for specialized analysis',
      },
      includeComplexity: {
        type: 'boolean',
        default: true,
        description: 'Include complexity analysis (default: true)',
      },
      includeProfileSuggestions: {
        type: 'boolean',
        default: true,
        description: 'Include profiling tool suggestions',
      },
      severity: {
        type: 'string',
        enum: ['high', 'medium', 'low', 'all'],
        default: 'all',
        description: 'Filter by impact severity',
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
    required: ['code'],
  },
};

/**
 * Handle Python performance analysis
 */
export async function handlePythonPerformanceAnalyzer(request) {
  try {
    const { 
      code,
      filename = 'script.py',
      projectPath,
      category = 'all',
      focus = 'general',
      includeComplexity = true,
      includeProfileSuggestions = true,
      severity = 'all',
      limit = 50,
      offset = 0,
    } = request.params;

    if (!code || code.trim().length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ No Python code provided for analysis',
        }],
      };
    }

    if (code.length > 100000) {
      return {
        content: [{
          type: 'text',
          text: '❌ Code too large (max 100KB)',
        }],
      };
    }

    const analysis = {
      filename,
      category,
      focus,
      issues: [],
      metrics: {
        cyclomaticComplexity: 0,
        functionCount: 0,
        classCount: 0,
        loopCount: 0,
        nestedLoopCount: 0,
        comprehensionCount: 0,
        generatorCount: 0,
        memoryHotspots: 0,
        ioOperations: 0,
        performanceScore: 0,
      },
      optimizations: [],
      profileSuggestions: [],
    };

    // Analyze Python code performance
    await analyzePythonPerformance(code, filename, analysis, {
      category,
      focus,
      includeComplexity,
    });

    // Analyze project structure if provided
    if (projectPath) {
      await analyzePythonProject(projectPath, analysis, { focus });
    }

    // Generate optimization recommendations
    generatePythonOptimizations(analysis);

    // Generate profiling suggestions
    if (includeProfileSuggestions) {
      generateProfileSuggestions(analysis);
    }

    // Calculate performance score
    analysis.metrics.performanceScore = calculatePythonPerformanceScore(analysis);

    // Filter by severity
    let filteredIssues = analysis.issues;
    if (severity !== 'all') {
      filteredIssues = analysis.issues.filter(issue => issue.severity === severity);
    }

    // Apply pagination
    const paginatedIssues = filteredIssues.slice(offset, offset + limit);

    // Build response
    const response = {
      analysis: {
        filename,
        category,
        focus,
        performanceScore: analysis.metrics.performanceScore,
      },
      metrics: analysis.metrics,
      issues: paginatedIssues,
      optimizations: analysis.optimizations,
      profileSuggestions: includeProfileSuggestions ? analysis.profileSuggestions : null,
      summary: {
        totalIssues: filteredIssues.length,
        high: filteredIssues.filter(i => i.severity === 'high').length,
        medium: filteredIssues.filter(i => i.severity === 'medium').length,
        low: filteredIssues.filter(i => i.severity === 'low').length,
      },
      pagination: {
        offset,
        limit,
        total: filteredIssues.length,
        hasMore: offset + limit < filteredIssues.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[PythonPerformanceAnalyzer] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Python performance analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Analyze Python code performance
 */
async function analyzePythonPerformance(code, filename, analysis, options) {
  const lines = code.split('\n');
  
  // Track context for nested analysis
  let indentLevel = 0;
  let inFunction = false;
  let inClass = false;
  let loopDepth = 0;
  let functionComplexity = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;
    
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Calculate indentation
    const currentIndent = line.length - line.trimLeft().length;
    
    // Function and class detection
    if (trimmed.startsWith('def ')) {
      inFunction = true;
      analysis.metrics.functionCount++;
      functionComplexity = 1; // Base complexity
      
      // Check for complex function signatures
      if (line.length > 80) {
        analysis.issues.push({
          type: 'long_function_signature',
          severity: 'low',
          message: 'Function signature exceeds recommended length',
          line: lineNumber,
          category: 'readability',
          recommendation: 'Consider breaking long parameter lists or using *args, **kwargs',
        });
      }
    }
    
    if (trimmed.startsWith('class ')) {
      inClass = true;
      analysis.metrics.classCount++;
    }
    
    // Loop detection and analysis
    if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) {
      loopDepth++;
      analysis.metrics.loopCount++;
      
      if (loopDepth > 1) {
        analysis.metrics.nestedLoopCount++;
        analysis.issues.push({
          type: 'nested_loops',
          severity: loopDepth > 2 ? 'high' : 'medium',
          message: `Nested loop detected (depth: ${loopDepth})`,
          line: lineNumber,
          category: 'cpu',
          depth: loopDepth,
          recommendation: 'Consider algorithm optimization or vectorization with NumPy',
        });
      }
      
      // Check for inefficient patterns in loops
      analyzeLoopContent(lines, i, analysis, loopDepth);
    }
    
    // List/dict comprehensions
    if (trimmed.includes('[') && trimmed.includes('for ') && trimmed.includes('in ')) {
      analysis.metrics.comprehensionCount++;
      
      // Check for complex comprehensions
      if (trimmed.includes('if ') && trimmed.count('for ') > 1) {
        analysis.issues.push({
          type: 'complex_comprehension',
          severity: 'medium',
          message: 'Complex list comprehension with multiple conditions',
          line: lineNumber,
          category: 'readability',
          recommendation: 'Consider breaking into regular loop for clarity',
        });
      }
    }
    
    // Generator expressions
    if ((trimmed.includes('yield ') || 
         (trimmed.includes('(') && trimmed.includes('for ') && trimmed.includes('in '))) &&
        !trimmed.includes('[')) {
      analysis.metrics.generatorCount++;
    }
    
    // Memory-related patterns
    analyzeMemoryPatterns(trimmed, lineNumber, analysis, options);
    
    // I/O operations
    analyzeIOPatterns(trimmed, lineNumber, analysis, options);
    
    // Algorithm complexity indicators
    if (options.includeComplexity) {
      analyzeComplexityIndicators(trimmed, lineNumber, analysis, options);
    }
    
    // Focus-specific analysis
    analyzeFocusSpecific(trimmed, lineNumber, analysis, options);
    
    // Track complexity for current function
    if (inFunction) {
      functionComplexity += countComplexityFactors(trimmed);
      
      if (trimmed.startsWith('def ') && i > 0) {
        // Function ended, check complexity
        if (functionComplexity > 10) {
          analysis.metrics.cyclomaticComplexity = Math.max(
            analysis.metrics.cyclomaticComplexity, 
            functionComplexity
          );
          
          analysis.issues.push({
            type: 'high_complexity',
            severity: functionComplexity > 20 ? 'high' : 'medium',
            message: `Function has high cyclomatic complexity (${functionComplexity})`,
            line: lineNumber,
            category: 'complexity',
            complexity: functionComplexity,
            recommendation: 'Consider breaking function into smaller functions',
          });
        }
        functionComplexity = 1;
      }
    }
    
    // Update loop depth based on indentation
    if (currentIndent <= indentLevel && loopDepth > 0) {
      loopDepth = Math.max(0, loopDepth - 1);
    }
    
    indentLevel = currentIndent;
  }
}

/**
 * Analyze loop content for performance issues
 */
function analyzeLoopContent(lines, loopStartIndex, analysis, depth) {
  const loopLine = lines[loopStartIndex];
  const lineNumber = loopStartIndex + 1;
  
  // Check for expensive operations in loops
  const expensivePatterns = [
    { pattern: /\.append\(/, message: 'List append in loop', recommendation: 'Use list comprehension or pre-allocate list' },
    { pattern: /print\(/, message: 'Print statement in loop', recommendation: 'Collect data and print after loop' },
    { pattern: /open\(/, message: 'File operation in loop', recommendation: 'Move file operations outside loop' },
    { pattern: /import /, message: 'Import statement in loop', recommendation: 'Move imports to module level' },
    { pattern: /re\.compile\(/, message: 'Regex compilation in loop', recommendation: 'Compile regex outside loop' },
    { pattern: /\+.*\+/, message: 'String concatenation in loop', recommendation: 'Use list and join() for string building' },
  ];
  
  // Look ahead in the loop body
  for (let i = loopStartIndex + 1; i < lines.length && i < loopStartIndex + 20; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Stop if we exit the loop (simple indentation check)
    const currentIndent = lines[i].length - lines[i].trimLeft().length;
    const loopIndent = loopLine.length - loopLine.trimLeft().length;
    
    if (currentIndent <= loopIndent && line && !line.startsWith('#')) {
      break;
    }
    
    for (const { pattern, message, recommendation } of expensivePatterns) {
      if (pattern.test(line)) {
        analysis.issues.push({
          type: 'expensive_loop_operation',
          severity: depth > 1 ? 'high' : 'medium',
          message: `${message} (loop depth: ${depth})`,
          line: i + 1,
          category: 'cpu',
          recommendation,
        });
      }
    }
  }
}

/**
 * Analyze memory patterns
 */
function analyzeMemoryPatterns(line, lineNumber, analysis, options) {
  if (options.category !== 'memory' && options.category !== 'all') return;
  
  // Memory hotspot patterns
  const memoryPatterns = [
    {
      pattern: /\[\] \* \d+/,
      severity: 'medium',
      message: 'List multiplication creates shared references',
      recommendation: 'Use list comprehension: [[] for _ in range(n)]',
    },
    {
      pattern: /global /,
      severity: 'medium',
      message: 'Global variable usage',
      recommendation: 'Consider using function parameters or class attributes',
    },
    {
      pattern: /eval\(/,
      severity: 'high',
      message: 'eval() usage - security and performance risk',
      recommendation: 'Use safer alternatives like ast.literal_eval() or avoid eval()',
    },
    {
      pattern: /exec\(/,
      severity: 'high',
      message: 'exec() usage - security and performance risk',
      recommendation: 'Refactor to avoid dynamic code execution',
    },
    {
      pattern: /range\(\d{4,}\)/,
      severity: 'medium',
      message: 'Large range() usage',
      recommendation: 'Consider using generators or breaking into chunks',
    },
  ];
  
  for (const { pattern, severity, message, recommendation } of memoryPatterns) {
    if (pattern.test(line)) {
      analysis.metrics.memoryHotspots++;
      analysis.issues.push({
        type: 'memory_hotspot',
        severity,
        message,
        line: lineNumber,
        category: 'memory',
        recommendation,
      });
    }
  }
}

/**
 * Analyze I/O patterns
 */
function analyzeIOPatterns(line, lineNumber, analysis, options) {
  if (options.category !== 'io' && options.category !== 'all') return;
  
  const ioPatterns = [
    {
      pattern: /open\([^)]*\)/,
      severity: 'low',
      message: 'File operation without context manager',
      recommendation: 'Use "with open()" for automatic file closure',
      checkContext: true,
    },
    {
      pattern: /requests\.get\(/,
      severity: 'medium',
      message: 'HTTP request without timeout',
      recommendation: 'Add timeout parameter to prevent hanging',
    },
    {
      pattern: /\.read\(\)/,
      severity: 'medium',
      message: 'Reading entire file into memory',
      recommendation: 'Consider reading in chunks for large files',
    },
    {
      pattern: /os\.system\(/,
      severity: 'high',
      message: 'Using os.system() - security risk',
      recommendation: 'Use subprocess module instead',
    },
  ];
  
  for (const { pattern, severity, message, recommendation, checkContext } of ioPatterns) {
    if (pattern.test(line)) {
      analysis.metrics.ioOperations++;
      
      // Special check for open() without context manager
      if (checkContext && pattern.test(line) && !line.includes('with ')) {
        analysis.issues.push({
          type: 'io_issue',
          severity,
          message,
          line: lineNumber,
          category: 'io',
          recommendation,
        });
      } else if (!checkContext) {
        analysis.issues.push({
          type: 'io_issue',
          severity,
          message,
          line: lineNumber,
          category: 'io',
          recommendation,
        });
      }
    }
  }
}

/**
 * Analyze complexity indicators
 */
function analyzeComplexityIndicators(line, lineNumber, analysis, options) {
  const complexityPatterns = [
    {
      pattern: /if .* and .* and /,
      message: 'Complex boolean expression',
      recommendation: 'Break down into separate conditions or use intermediate variables',
    },
    {
      pattern: /\[.*\[.*\[/,
      message: 'Deeply nested data structure access',
      recommendation: 'Consider flattening data structure or using get() methods',
    },
    {
      pattern: /lambda.*lambda/,
      message: 'Nested lambda expressions',
      recommendation: 'Use regular functions for better readability',
    },
    {
      pattern: /try:.*except:.*except:/,
      message: 'Multiple exception handlers',
      recommendation: 'Consider more specific exception handling',
    },
  ];
  
  for (const { pattern, message, recommendation } of complexityPatterns) {
    if (pattern.test(line)) {
      analysis.issues.push({
        type: 'complexity_indicator',
        severity: 'low',
        message,
        line: lineNumber,
        category: 'complexity',
        recommendation,
      });
    }
  }
}

/**
 * Focus-specific analysis
 */
function analyzeFocusSpecific(line, lineNumber, analysis, options) {
  switch (options.focus) {
    case 'data_science':
      analyzeDataSciencePatterns(line, lineNumber, analysis);
      break;
    case 'web':
      analyzeWebPatterns(line, lineNumber, analysis);
      break;
    case 'cli':
      analyzeCLIPatterns(line, lineNumber, analysis);
      break;
  }
}

/**
 * Analyze data science specific patterns
 */
function analyzeDataSciencePatterns(line, lineNumber, analysis) {
  const dsPatterns = [
    {
      pattern: /pd\.read_csv\([^)]*\)/,
      message: 'Reading entire CSV into memory',
      recommendation: 'Consider using chunksize parameter for large files',
      severity: 'medium',
    },
    {
      pattern: /\.iterrows\(\)/,
      message: 'Using iterrows() - very slow',
      recommendation: 'Use vectorized operations or .apply() method',
      severity: 'high',
    },
    {
      pattern: /plt\.show\(\)/,
      message: 'Displaying plot in loop or function',
      recommendation: 'Consider batch plotting or saving to file',
      severity: 'low',
    },
    {
      pattern: /np\.array\(.*\.tolist\(\)/,
      message: 'Converting DataFrame to list then to numpy array',
      recommendation: 'Use .values or .to_numpy() directly',
      severity: 'medium',
    },
  ];
  
  for (const { pattern, message, recommendation, severity } of dsPatterns) {
    if (pattern.test(line)) {
      analysis.issues.push({
        type: 'data_science_performance',
        severity,
        message,
        line: lineNumber,
        category: 'cpu',
        recommendation,
      });
    }
  }
}

/**
 * Analyze web development patterns
 */
function analyzeWebPatterns(line, lineNumber, analysis) {
  const webPatterns = [
    {
      pattern: /@app\.route\(/,
      message: 'Flask route defined',
      recommendation: 'Consider using blueprints for better organization',
      severity: 'low',
    },
    {
      pattern: /render_template\(/,
      message: 'Template rendering',
      recommendation: 'Ensure template caching is enabled in production',
      severity: 'low',
    },
  ];
  
  for (const { pattern, message, recommendation, severity } of webPatterns) {
    if (pattern.test(line)) {
      analysis.issues.push({
        type: 'web_performance',
        severity,
        message,
        line: lineNumber,
        category: 'web',
        recommendation,
      });
    }
  }
}

/**
 * Analyze CLI patterns
 */
function analyzeCLIPatterns(line, lineNumber, analysis) {
  const cliPatterns = [
    {
      pattern: /input\(/,
      message: 'Synchronous input() call',
      recommendation: 'Consider async input for better UX',
      severity: 'low',
    },
    {
      pattern: /time\.sleep\(/,
      message: 'Blocking sleep in main thread',
      recommendation: 'Consider async sleep or threading for responsiveness',
      severity: 'medium',
    },
  ];
  
  for (const { pattern, message, recommendation, severity } of cliPatterns) {
    if (pattern.test(line)) {
      analysis.issues.push({
        type: 'cli_performance',
        severity,
        message,
        line: lineNumber,
        category: 'cpu',
        recommendation,
      });
    }
  }
}

/**
 * Count complexity factors in a line
 */
function countComplexityFactors(line) {
  let complexity = 0;
  
  // Decision points
  if (line.includes('if ') || line.includes('elif ')) complexity++;
  if (line.includes('for ') || line.includes('while ')) complexity++;
  if (line.includes('try:') || line.includes('except ')) complexity++;
  if (line.includes('and ') || line.includes('or ')) complexity++;
  if (line.includes('break') || line.includes('continue')) complexity++;
  
  return complexity;
}

/**
 * Analyze Python project structure
 */
async function analyzePythonProject(projectPath, analysis, options) {
  try {
    // Check for requirements.txt or setup.py
    const reqPath = join(projectPath, 'requirements.txt');
    const setupPath = join(projectPath, 'setup.py');
    const pyprojectPath = join(projectPath, 'pyproject.toml');
    
    if (existsSync(reqPath)) {
      const requirements = readFileSync(reqPath, 'utf8');
      analyzeRequirements(requirements, analysis);
    }
    
    if (existsSync(setupPath)) {
      const setup = readFileSync(setupPath, 'utf8');
      analyzeSetupPy(setup, analysis);
    }
    
    if (existsSync(pyprojectPath)) {
      const pyproject = readFileSync(pyprojectPath, 'utf8');
      analyzePyprojectToml(pyproject, analysis);
    }
    
  } catch (error) {
    // Ignore project analysis errors
    console.warn('Project analysis warning:', error.message);
  }
}

/**
 * Analyze requirements.txt for performance-impacting dependencies
 */
function analyzeRequirements(requirements, analysis) {
  const heavyPackages = [
    'tensorflow', 'torch', 'numpy', 'pandas', 'scipy', 'matplotlib',
    'opencv-python', 'pillow', 'scikit-learn'
  ];
  
  const lines = requirements.split('\n');
  
  for (const line of lines) {
    const packageName = line.split('==')[0].split('>=')[0].split('<=')[0].trim();
    
    if (heavyPackages.includes(packageName.toLowerCase())) {
      analysis.issues.push({
        type: 'heavy_dependency',
        severity: 'low',
        message: `Heavy dependency detected: ${packageName}`,
        category: 'memory',
        package: packageName,
        recommendation: `Consider lazy loading ${packageName} or using lighter alternatives`,
      });
    }
  }
}

/**
 * Analyze setup.py
 */
function analyzeSetupPy(setup, analysis) {
  // Simple analysis of setup.py patterns
  if (setup.includes('install_requires') && setup.length > 1000) {
    analysis.issues.push({
      type: 'complex_setup',
      severity: 'low',
      message: 'Complex setup.py with many dependencies',
      category: 'deployment',
      recommendation: 'Consider breaking into optional dependency groups',
    });
  }
}

/**
 * Analyze pyproject.toml
 */
function analyzePyprojectToml(pyproject, analysis) {
  // Simple analysis of pyproject.toml
  if (pyproject.includes('[tool.') && pyproject.includes('dependencies')) {
    analysis.issues.push({
      type: 'modern_packaging',
      severity: 'low',
      message: 'Using modern Python packaging',
      category: 'positive',
      recommendation: 'Good practice - continue using pyproject.toml',
    });
  }
}

/**
 * Generate Python-specific optimizations
 */
function generatePythonOptimizations(analysis) {
  const optimizations = [];
  
  // Based on metrics
  if (analysis.metrics.nestedLoopCount > 0) {
    optimizations.push({
      type: 'algorithmic',
      priority: 'high',
      title: 'Algorithm Optimization',
      description: 'Replace nested loops with more efficient algorithms',
      techniques: [
        'Use dictionary lookups instead of nested searches',
        'Consider NumPy vectorized operations for numerical data',
        'Implement early termination conditions',
        'Use set operations for membership testing',
      ],
    });
  }
  
  if (analysis.metrics.memoryHotspots > 2) {
    optimizations.push({
      type: 'memory',
      priority: 'medium',
      title: 'Memory Optimization',
      description: 'Reduce memory usage and prevent memory leaks',
      techniques: [
        'Use generators instead of lists where possible',
        'Implement memory pooling for frequently created objects',
        'Use __slots__ in classes to reduce memory overhead',
        'Consider memory-efficient data structures (array.array, etc.)',
      ],
    });
  }
  
  if (analysis.metrics.ioOperations > 3) {
    optimizations.push({
      type: 'io',
      priority: 'medium',
      title: 'I/O Optimization',
      description: 'Improve I/O performance and resource management',
      techniques: [
        'Use context managers for resource cleanup',
        'Implement connection pooling for database/network operations',
        'Use buffered I/O for file operations',
        'Consider async I/O for concurrent operations',
      ],
    });
  }
  
  analysis.optimizations = optimizations;
}

/**
 * Generate profiling suggestions
 */
function generateProfileSuggestions(analysis) {
  const suggestions = [];
  
  // Based on performance issues found
  const hasComplexity = analysis.issues.some(i => i.type === 'high_complexity');
  const hasNestedLoops = analysis.issues.some(i => i.type === 'nested_loops');
  const hasMemoryIssues = analysis.metrics.memoryHotspots > 0;
  
  if (hasComplexity || hasNestedLoops) {
    suggestions.push({
      tool: 'cProfile',
      purpose: 'CPU profiling',
      command: 'python -m cProfile -s cumtime script.py',
      description: 'Identify CPU bottlenecks and function call overhead',
    });
  }
  
  if (hasMemoryIssues) {
    suggestions.push({
      tool: 'memory_profiler',
      purpose: 'Memory profiling',
      command: 'pip install memory-profiler && python -m memory_profiler script.py',
      description: 'Track memory usage line by line',
    });
    
    suggestions.push({
      tool: 'tracemalloc',
      purpose: 'Memory tracking',
      command: 'Built into Python 3.4+',
      description: 'Track memory allocations in your code',
    });
  }
  
  if (analysis.metrics.functionCount > 10) {
    suggestions.push({
      tool: 'py-spy',
      purpose: 'Production profiling',
      command: 'pip install py-spy && py-spy top --pid <PID>',
      description: 'Profile running Python processes without modification',
    });
  }
  
  suggestions.push({
    tool: 'line_profiler',
    purpose: 'Line-by-line profiling',
    command: 'pip install line_profiler && kernprof -l -v script.py',
    description: 'Get detailed timing information for each line',
  });
  
  analysis.profileSuggestions = suggestions;
}

/**
 * Calculate Python performance score
 */
function calculatePythonPerformanceScore(analysis) {
  let score = 100;
  
  // Deduct points for issues
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  });
  
  // Factor in complexity
  if (analysis.metrics.cyclomaticComplexity > 15) {
    score -= (analysis.metrics.cyclomaticComplexity - 15) * 2;
  }
  
  // Factor in nested loops
  score -= analysis.metrics.nestedLoopCount * 10;
  
  // Factor in memory hotspots
  score -= analysis.metrics.memoryHotspots * 5;
  
  // Bonus for using generators
  score += Math.min(analysis.metrics.generatorCount * 2, 10);
  
  // Bonus for using comprehensions (up to a point)
  score += Math.min(analysis.metrics.comprehensionCount * 1, 5);
  
  return Math.max(0, Math.min(100, Math.round(score)));
}