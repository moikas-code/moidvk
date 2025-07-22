// Timeout utility functions

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of the operation for error message
 * @returns {Promise} Promise that rejects if timeout is exceeded
 */
export function withTimeout(promise, timeoutMs, operationName) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`${operationName} timeout exceeded`)), timeoutMs),
  );
  
  return Promise.race([promise, timeoutPromise]);
}

// Timeout constants
export const LINT_TIMEOUT_MS = 5000; // 5 second timeout
export const FORMAT_TIMEOUT_MS = 3000; // 3 second timeout for formatting