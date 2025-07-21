// Time constants (in milliseconds)
export const TIME_CONSTANTS = {
  HOURS_24: 24 * 60 * 60 * 1000,
  MINUTES_60: 60 * 60 * 1000,
  SECONDS_60: 60 * 1000,
  MS_PER_SECOND: 1000,
};

// File system limits
export const LIMITS = {
  MAX_SEARCH_RESULTS: 100,
  MAX_DIRECTORY_DEPTH: 5,
  SIMILAR_FILES_DEFAULT: 10,
  SIMILARITY_THRESHOLD: 0.7,
  BOUNDARY_SEARCH_LIMIT: 5,
  LOOKAHEAD_LINES: 10,
  SNIPPET_CONTEXT_LINES: 25,
  EMBEDDING_DIMENSION: 384,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

// Function size limits (lines)
export const FUNCTION_LIMITS = {
  MAX_LINES_PER_FUNCTION: 60,
  MAX_COMPLEXITY: 10,
};

// Sharing levels for snippets
export const SHARING_LEVELS = {
  micro: { maxLines: 10, description: 'Minimal snippet (up to 10 lines)' },
  function: { maxLines: 50, description: 'Function-level snippet (up to 50 lines)' },
  component: { maxLines: 200, description: 'Component-level snippet (up to 200 lines)' },
};

// Common file patterns to ignore
export const IGNORE_PATTERNS = [
  'node_modules',
  '__pycache__',
  'dist',
  'build',
  '.git',
  '.DS_Store',
];

// Code file extensions
export const CODE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
  '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
  '.vue', '.svelte', '.dart', '.lua', '.r', '.m', '.mm',
];