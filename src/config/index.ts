export interface Config {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  anthropic: {
    apiKey: string;
    model: string;
  };
  storage: {
    storagePath: string;
    uploadPath: string;
  };
  redis: {
    url: string;
  };
  processing: {
    maxCorrectionAttempts: number;
    autoProcessConfidenceThreshold: number;
    correctionConfidenceThreshold: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export function loadConfig(): Config {
  return {
    server: {
      port: parseInt(getEnvOrDefault('PORT', '3000'), 10),
      host: getEnvOrDefault('HOST', '0.0.0.0'),
      nodeEnv: getEnvOrDefault('NODE_ENV', 'development'),
    },
    anthropic: {
      // Claude Agent SDK uses CLAUDE_CODE_OAUTH_TOKEN automatically
      // This is only needed for direct Anthropic SDK usage
      apiKey: getEnvOrDefault('ANTHROPIC_API_KEY', ''),
      model: getEnvOrDefault('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
    },
    storage: {
      storagePath: getEnvOrDefault('STORAGE_PATH', './data/storage'),
      uploadPath: getEnvOrDefault('UPLOAD_PATH', './data/uploads'),
    },
    redis: {
      url: getEnvOrDefault('REDIS_URL', 'redis://localhost:6379'),
    },
    processing: {
      maxCorrectionAttempts: parseInt(getEnvOrDefault('MAX_CORRECTION_ATTEMPTS', '3'), 10),
      autoProcessConfidenceThreshold: parseFloat(
        getEnvOrDefault('AUTO_PROCESS_CONFIDENCE_THRESHOLD', '0.95')
      ),
      correctionConfidenceThreshold: parseFloat(
        getEnvOrDefault('CORRECTION_CONFIDENCE_THRESHOLD', '0.80')
      ),
    },
    logging: {
      level: getEnvOrDefault('LOG_LEVEL', 'info'),
      format: getEnvOrDefault('LOG_FORMAT', 'json'),
    },
  };
}

let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}
