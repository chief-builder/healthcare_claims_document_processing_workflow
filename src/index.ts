import { getConfig } from './config/index.js';
import { logger } from './utils/index.js';

// Export all modules for library usage
export * from './models/index.js';
export * from './services/index.js';
export * from './agents/index.js';
export * from './utils/index.js';
export { getConfig, loadConfig, resetConfig } from './config/index.js';

async function main(): Promise<void> {
  try {
    const config = getConfig();

    logger.info('ClaimsAgent starting', {
      nodeEnv: config.server.nodeEnv,
      port: config.server.port,
    });

    // TODO: Initialize API server (Phase 5-6)
    logger.info('ClaimsAgent initialized - API server not yet implemented');
    logger.info('Available modules:');
    logger.info('  - Models: Claim, Validation, Adjudication types');
    logger.info('  - Services: OCR, LLM, Storage, Queue');
    logger.info('  - Agents: Intake, Parsing, Extraction, Validation, Correction, Adjudication');

  } catch (error) {
    logger.error('Failed to start ClaimsAgent', { error });
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') ?? '');
if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
