import winston from 'winston';

const { combine, timestamp, json, printf, colorize } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Create logger instance
function createLogger(options: { level?: string; format?: string } = {}): winston.Logger {
  const level = options.level ?? process.env.LOG_LEVEL ?? 'info';
  const formatType = options.format ?? process.env.LOG_FORMAT ?? 'json';

  const formats = [timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })];

  if (formatType === 'json') {
    formats.push(json());
  } else {
    formats.push(colorize(), devFormat);
  }

  return winston.createLogger({
    level,
    format: combine(...formats),
    transports: [new winston.transports.Console()],
    defaultMeta: { service: 'claimsagent' },
  });
}

// Default logger instance
export const logger = createLogger();

// Logger with context (claim ID, agent name, etc.)
export function createContextLogger(context: Record<string, string>): winston.Logger {
  return logger.child(context);
}

// Convenience methods for claim processing
export function logClaimEvent(
  claimId: string,
  event: string,
  details?: Record<string, unknown>
): void {
  logger.info(event, { claimId, ...details });
}

export function logAgentStart(agentName: string, claimId: string): void {
  logger.info(`Agent starting`, { agent: agentName, claimId });
}

export function logAgentComplete(
  agentName: string,
  claimId: string,
  durationMs: number,
  success: boolean
): void {
  logger.info(`Agent completed`, {
    agent: agentName,
    claimId,
    durationMs,
    success,
  });
}

export function logAgentError(agentName: string, claimId: string, error: Error): void {
  logger.error(`Agent error`, {
    agent: agentName,
    claimId,
    error: error.message,
    stack: error.stack,
  });
}

export function logValidationError(
  claimId: string,
  field: string,
  errorType: string,
  message: string
): void {
  logger.warn(`Validation error`, { claimId, field, errorType, message });
}

export function logCorrectionAttempt(
  claimId: string,
  field: string,
  attemptNumber: number,
  success: boolean
): void {
  logger.info(`Correction attempt`, { claimId, field, attemptNumber, success });
}

export default logger;
