/**
 * Global error handling middleware for the Target API.
 * Catches all unhandled errors and formats them as structured JSON
 * so the Sentinel agent can parse and act on them.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  
  const errorLog = {
    type: 'error',
    level: 'error',
    timestamp: new Date().toISOString(),
    statusCode: statusCode,
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    request_body: req.body,
    file: extractFileFromStack(err.stack),
    line: extractLineFromStack(err.stack)
  };

  // Emit structured error to stdout for LogTail MCP
  console.error(JSON.stringify(errorLog));

  res.status(statusCode).json({
    error: true,
    message: statusCode === 500 ? 'Internal Server Error' : err.message,
    incident_id: err.incident_id || null
  });
}

/**
 * Extract the filename from a stack trace
 */
function extractFileFromStack(stack) {
  if (!stack) return null;
  const match = stack.match(/at\s+\S+\s+\((.+?):\d+:\d+\)/);
  if (match) return match[1];
  const match2 = stack.match(/at\s+(.+?):\d+:\d+/);
  return match2 ? match2[1] : null;
}

/**
 * Extract the line number from a stack trace
 */
function extractLineFromStack(stack) {
  if (!stack) return null;
  const match = stack.match(/at\s+\S+\s+\(.+?:(\d+):\d+\)/);
  if (match) return parseInt(match[1]);
  const match2 = stack.match(/at\s+.+?:(\d+):\d+/);
  return match2 ? parseInt(match2[1]) : null;
}

module.exports = errorHandler;
