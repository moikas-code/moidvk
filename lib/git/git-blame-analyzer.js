import { spawn } from 'child_process';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';
import { validateCode } from '../utils/validation.js';

/**
 * Tool definition for git_blame_analyzer
 */
export const gitBlameAnalyzerTool = {
  name: 'git_blame_analyzer',
  description: 'Analyzes code authorship using git blame to understand code ownership, contribution patterns, and identify who to contact for specific code sections.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to analyze (relative to project root)',
      },
      startLine: {
        type: 'number',
        description: 'Starting line number (optional)',
        minimum: 1,
      },
      endLine: {
        type: 'number',
        description: 'Ending line number (optional)',
        minimum: 1,
      },
      ignoreWhitespace: {
        type: 'boolean',
        description: 'Ignore whitespace changes',
        default: true,
      },
      showEmail: {
        type: 'boolean',
        description: 'Show author email addresses',
        default: false,
      },
    },
    required: ['filePath'],
  },
};

/**
 * Runs git blame on a file
 * @param {string} filePath - Path to the file
 * @param {Object} options - Blame options
 * @returns {Promise<Object>} Git blame output
 */
async function runGitBlame(filePath, options) {
  return new Promise((resolve, reject) => {
    const args = ['blame', '--porcelain'];
    
    if (options.ignoreWhitespace) {
      args.push('-w');
    }
    
    if (options.startLine && options.endLine) {
      args.push(`-L${options.startLine},${options.endLine}`);
    }
    
    args.push('--', filePath);
    
    const git = spawn('git', args);
    
    let stdout = '';
    let stderr = '';
    
    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    git.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || 'Git blame failed'));
      }
    });
    
    git.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Parses git blame porcelain output
 * @param {string} output - Raw git blame output
 * @returns {Array} Parsed blame data
 */
function parseGitBlame(output) {
  const lines = output.split('\n');
  const blameData = [];
  let currentCommit = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Commit hash line
    if (line.match(/^[0-9a-f]{40}/)) {
      const parts = line.split(' ');
      currentCommit = {
        hash: parts[0],
        originalLine: parseInt(parts[1]),
        finalLine: parseInt(parts[2]),
        numLines: parseInt(parts[3]) || 1,
      };
    }
    // Author line
    else if (line.startsWith('author ')) {
      if (currentCommit) {
        currentCommit.author = line.substring(7);
      }
    }
    // Author email
    else if (line.startsWith('author-mail ')) {
      if (currentCommit) {
        currentCommit.email = line.substring(12).replace(/[<>]/g, '');
      }
    }
    // Author time
    else if (line.startsWith('author-time ')) {
      if (currentCommit) {
        currentCommit.timestamp = parseInt(line.substring(12));
        currentCommit.date = new Date(currentCommit.timestamp * 1000).toISOString();
      }
    }
    // Summary
    else if (line.startsWith('summary ')) {
      if (currentCommit) {
        currentCommit.summary = line.substring(8);
      }
    }
    // Code line (starts with tab)
    else if (line.startsWith('\t')) {
      if (currentCommit) {
        currentCommit.code = line.substring(1);
        blameData.push({ ...currentCommit });
        currentCommit = null;
      }
    }
  }
  
  return blameData;
}

/**
 * Analyzes blame data for insights
 * @param {Array} blameData - Parsed blame data
 * @returns {Object} Analysis results
 */
function analyzeBlameData(blameData) {
  const authorStats = {};
  const commitStats = {};
  let oldestCommit = null;
  let newestCommit = null;
  
  blameData.forEach(entry => {
    // Author statistics
    if (!authorStats[entry.author]) {
      authorStats[entry.author] = {
        name: entry.author,
        email: entry.email,
        lines: 0,
        commits: new Set(),
        firstContribution: entry.date,
        lastContribution: entry.date,
      };
    }
    
    authorStats[entry.author].lines++;
    authorStats[entry.author].commits.add(entry.hash);
    
    // Update contribution dates
    if (entry.date < authorStats[entry.author].firstContribution) {
      authorStats[entry.author].firstContribution = entry.date;
    }
    if (entry.date > authorStats[entry.author].lastContribution) {
      authorStats[entry.author].lastContribution = entry.date;
    }
    
    // Commit statistics
    if (!commitStats[entry.hash]) {
      commitStats[entry.hash] = {
        hash: entry.hash,
        author: entry.author,
        date: entry.date,
        summary: entry.summary,
        lines: 0,
      };
    }
    commitStats[entry.hash].lines++;
    
    // Track oldest and newest
    if (!oldestCommit || entry.timestamp < oldestCommit.timestamp) {
      oldestCommit = entry;
    }
    if (!newestCommit || entry.timestamp > newestCommit.timestamp) {
      newestCommit = entry;
    }
  });
  
  // Convert Sets to counts
  Object.values(authorStats).forEach(author => {
    author.commitCount = author.commits.size;
    delete author.commits;
  });
  
  // Sort authors by contribution
  const topContributors = Object.values(authorStats)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);
  
  return {
    totalLines: blameData.length,
    uniqueAuthors: Object.keys(authorStats).length,
    uniqueCommits: Object.keys(commitStats).length,
    oldestCommit: oldestCommit ? {
      date: oldestCommit.date,
      author: oldestCommit.author,
      summary: oldestCommit.summary,
    } : null,
    newestCommit: newestCommit ? {
      date: newestCommit.date,
      author: newestCommit.author,
      summary: newestCommit.summary,
    } : null,
    topContributors,
    authorStats,
    commitStats: Object.values(commitStats).sort((a, b) => b.lines - a.lines).slice(0, 10),
  };
}

/**
 * Handles the git_blame_analyzer tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleGitBlameAnalyzer(args) {
  const {
    filePath,
    startLine,
    endLine,
    ignoreWhitespace = true,
    showEmail = false,
  } = args;
  
  // Validate file path
  if (!filePath || typeof filePath !== 'string') {
    return {
      content: [{
        type: 'text',
        text: '❌ Error: Valid file path is required.',
      }],
    };
  }
  
  // Validate line numbers
  if (startLine && endLine && startLine > endLine) {
    return {
      content: [{
        type: 'text',
        text: '❌ Error: Start line must be less than or equal to end line.',
      }],
    };
  }
  
  try {
    // Check if we're in a git repository
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          spawn('git', ['rev-parse', '--git-dir']).on('close', code => {
            code === 0 ? resolve() : reject(new Error('Not a git repository'));
          });
        }),
        5000,
        'Git check'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: Not in a git repository or git is not installed.',
        }],
      };
    }
    
    // Run git blame
    const options = {
      ignoreWhitespace,
      startLine,
      endLine,
    };
    
    const blamePromise = runGitBlame(filePath, options);
    const result = await withTimeout(blamePromise, LINT_TIMEOUT_MS, 'Git blame');
    
    // Parse blame data
    const blameData = parseGitBlame(result.stdout);
    
    if (blameData.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error: No blame data found for ${filePath}. File might not exist or have no commits.`,
        }],
      };
    }
    
    // Analyze the data
    const analysis = analyzeBlameData(blameData);
    
    // Format output
    let output = `📝 Git Blame Analysis for ${filePath}\n\n`;
    
    if (startLine && endLine) {
      output += `Lines ${startLine}-${endLine}\n\n`;
    }
    
    output += '📊 Summary:\n';
    output += `  Total lines: ${analysis.totalLines}\n`;
    output += `  Unique authors: ${analysis.uniqueAuthors}\n`;
    output += `  Unique commits: ${analysis.uniqueCommits}\n\n`;
    
    if (analysis.oldestCommit) {
      output += '📅 Code Timeline:\n';
      output += `  Oldest: ${analysis.oldestCommit.date.split('T')[0]} by ${analysis.oldestCommit.author}\n`;
      output += `  Newest: ${analysis.newestCommit.date.split('T')[0]} by ${analysis.newestCommit.author}\n\n`;
    }
    
    output += '👥 Top Contributors:\n';
    analysis.topContributors.forEach((contributor, index) => {
      output += `  ${index + 1}. ${contributor.name}`;
      if (showEmail) {
        output += ` <${contributor.email}>`;
      }
      output += '\n';
      output += `     Lines: ${contributor.lines} (${Math.round(contributor.lines / analysis.totalLines * 100)}%)\n`;
      output += `     Commits: ${contributor.commitCount}\n`;
      output += `     Active: ${contributor.firstContribution.split('T')[0]} to ${contributor.lastContribution.split('T')[0]}\n`;
    });
    
    output += '\n📝 Recent Commits (by lines):\n';
    analysis.commitStats.slice(0, 5).forEach(commit => {
      output += `  ${commit.hash.substring(0, 8)} - ${commit.lines} lines\n`;
      output += `    ${commit.date.split('T')[0]} by ${commit.author}\n`;
      output += `    ${commit.summary}\n`;
    });
    
    output += '\n💡 Insights:\n';
    
    // Code ownership insights
    const primaryAuthor = analysis.topContributors[0];
    if (primaryAuthor && primaryAuthor.lines / analysis.totalLines > 0.5) {
      output += `- ${primaryAuthor.name} is the primary maintainer (${Math.round(primaryAuthor.lines / analysis.totalLines * 100)}% of code)\n`;
    } else {
      output += '- Code has shared ownership among multiple contributors\n';
    }
    
    // Age insights
    if (analysis.oldestCommit) {
      const ageInDays = Math.floor((Date.now() - new Date(analysis.oldestCommit.date).getTime()) / (1000 * 60 * 60 * 24));
      if (ageInDays > 365) {
        output += `- Code is mature (${Math.floor(ageInDays / 365)} years old)\n`;
      } else if (ageInDays > 90) {
        output += `- Code is relatively stable (${ageInDays} days old)\n`;
      } else {
        output += `- Code is recent (${ageInDays} days old)\n`;
      }
    }
    
    // Activity insights
    const recentCommits = analysis.commitStats.filter(c => {
      const daysSince = (Date.now() - new Date(c.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });
    
    if (recentCommits.length > 0) {
      output += `- Active development (${recentCommits.length} commits in last 30 days)\n`;
    } else {
      output += '- No recent changes (stable or unmaintained)\n';
    }
    
    // Include detailed data
    const detailedData = {
      analysis: {
        totalLines: analysis.totalLines,
        uniqueAuthors: analysis.uniqueAuthors,
        uniqueCommits: analysis.uniqueCommits,
        topContributors: analysis.topContributors,
      },
      lineByLine: startLine && endLine ? blameData : undefined,
    };
    
    return {
      content: [{
        type: 'text',
        text: output,
      }, {
        type: 'text',
        text: JSON.stringify(detailedData, null, 2),
      }],
    };
  } catch (error) {
    console.error('Error running git blame:', error);
    
    let errorMessage = 'Failed to analyze file history.';
    
    if (error.message.includes('does not exist')) {
      errorMessage = `File '${filePath}' does not exist in the repository.`;
    } else if (error.message.includes('no such path')) {
      errorMessage = `Invalid path: ${filePath}`;
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}`,
      }],
    };
  }
}