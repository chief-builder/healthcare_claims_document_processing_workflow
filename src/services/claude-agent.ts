import { query } from '@anthropic-ai/claude-agent-sdk';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/index.js';

/**
 * Claude Agent SDK wrapper service
 * Uses OAuth token authentication via CLAUDE_CODE_OAUTH_TOKEN
 */

export interface ClaudeAgentResponse {
  text: string;
  cost?: number;
}

export class ClaudeAgentService {
  private model: string;

  constructor() {
    const config = getConfig();
    this.model = config.anthropic.model;
  }

  /**
   * Send a prompt to Claude and get a response
   */
  async prompt(userPrompt: string): Promise<ClaudeAgentResponse> {
    try {
      let resultText = '';
      let totalCost: number | undefined;

      for await (const msg of query({
        prompt: userPrompt,
        options: {
          maxTurns: 1,
          model: this.model,
          // Disable tools since we just want text responses
          allowedTools: [],
        },
      })) {
        if (msg.type === 'result') {
          totalCost = msg.total_cost_usd;
          // Check if it's a success result (has 'result' property)
          if (msg.subtype === 'success') {
            resultText = msg.result;
          } else {
            // It's an error result
            const errorMsg = 'errors' in msg ? msg.errors.join(', ') : 'Unknown error';
            throw new Error(`Claude Agent error: ${errorMsg}`);
          }
        }
      }

      return {
        text: resultText,
        cost: totalCost,
      };
    } catch (error) {
      logger.error('Claude Agent query failed', { error });
      throw error;
    }
  }

  /**
   * Extract JSON from a prompt response
   */
  async promptForJSON<T>(userPrompt: string): Promise<T> {
    const response = await this.prompt(userPrompt);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]) as T;
  }
}

// Singleton instance
let claudeAgentInstance: ClaudeAgentService | null = null;

export function getClaudeAgentService(): ClaudeAgentService {
  if (!claudeAgentInstance) {
    claudeAgentInstance = new ClaudeAgentService();
  }
  return claudeAgentInstance;
}
