/**
 * Model Router for Cost-Optimized Agent Execution
 *
 * Routes agent tasks to the most appropriate Claude model based on:
 * - Agent type and role
 * - Task complexity
 * - Cost optimization
 *
 * Model Tiers (2026 pricing):
 * - Haiku 4.5:  $1 input / $5 output per MTok - Fast, cheap, structured tasks
 * - Sonnet 4.6: $3 input / $15 output per MTok - Balanced, most tasks
 * - Opus 4.6:   $5 input / $25 output per MTok - Complex reasoning, high-stakes
 *
 * Expected savings: 20-30% vs. using Opus for everything
 */

/**
 * Model identifiers - Updated April 2026
 */
export const MODELS = {
  HAIKU: 'claude-haiku-4-5-20260301',
  SONNET: 'claude-sonnet-4-6-20260301',
  OPUS: 'claude-opus-4-7-20260416',       // Upgraded to Opus 4.7
};

/**
 * Pricing per million tokens (2026 rates)
 */
export const PRICING = {
  [MODELS.HAIKU]: { input: 1, output: 5 },
  [MODELS.SONNET]: { input: 3, output: 15 },
  [MODELS.OPUS]: { input: 5, output: 25 },
};

/**
 * Agent model assignments with routing options
 */
const AGENT_MODEL_CONFIG = {
  // Strategic/Security - Always Opus (high-stakes)
  'ceo-reviewer': {
    default: MODELS.OPUS,
    canDowngrade: false,
    reason: 'Strategic decisions require deep reasoning',
  },
  'ciso-auditor': {
    default: MODELS.OPUS,
    canDowngrade: false,
    reason: 'Security reviews are high-stakes',
  },

  // Technical/Product - Sonnet (balanced)
  'cto-advisor': {
    default: MODELS.SONNET,
    canDowngrade: false,
    reason: 'Technical assessment needs good reasoning',
  },
  'cpo-validator': {
    default: MODELS.SONNET,
    canDowngrade: false,
    reason: 'Product validation needs nuance',
  },
  'engineer': {
    default: MODELS.SONNET,
    canDowngrade: false,
    reason: 'Code implementation is core task',
  },
  'devops-engineer': {
    default: MODELS.SONNET,
    canDowngrade: false,
    reason: 'Infrastructure decisions need care',
  },

  // Can use Haiku for simple tasks
  'qa-engineer': {
    default: MODELS.SONNET,
    canDowngrade: true,
    downgradeModel: MODELS.HAIKU,
    downgradeConditions: ['test_generation', 'simple_review'],
    reason: 'Test generation is structured',
  },
  'tech-writer': {
    default: MODELS.HAIKU,
    canDowngrade: false, // Already on cheapest
    reason: 'Documentation is structured, high-volume',
  },
};

/**
 * Task complexity indicators
 */
const COMPLEXITY_INDICATORS = {
  high: [
    'architecture',
    'security',
    'authentication',
    'authorization',
    'payment',
    'database schema',
    'migration',
    'refactor',
    'multi-file',
    'breaking change',
  ],
  medium: [
    'feature',
    'implement',
    'fix bug',
    'api endpoint',
    'component',
    'integration',
  ],
  low: [
    'documentation',
    'readme',
    'comment',
    'test',
    'lint',
    'format',
    'typo',
    'rename',
  ],
};

/**
 * Model Router
 */
export class ModelRouter {
  constructor(options = {}) {
    this.forceModel = options.forceModel || null; // Override for testing
    this.trackUsage = options.trackUsage ?? true;
    this.usage = {
      [MODELS.HAIKU]: { requests: 0, inputTokens: 0, outputTokens: 0 },
      [MODELS.SONNET]: { requests: 0, inputTokens: 0, outputTokens: 0 },
      [MODELS.OPUS]: { requests: 0, inputTokens: 0, outputTokens: 0 },
    };
  }

  /**
   * Select the optimal model for a task
   *
   * @param {string} agentName - Name of the agent
   * @param {string} task - Task description
   * @param {Object} context - Additional context
   * @returns {Object} - { model, reason, estimatedCostMultiplier }
   */
  selectModel(agentName, task = '', context = {}) {
    // Check for forced model
    if (this.forceModel) {
      return {
        model: this.forceModel,
        reason: 'Model forced via configuration',
        estimatedCostMultiplier: this.getCostMultiplier(this.forceModel),
      };
    }

    // Get agent config
    const config = AGENT_MODEL_CONFIG[agentName];
    if (!config) {
      // Unknown agent - default to Sonnet
      return {
        model: MODELS.SONNET,
        reason: 'Unknown agent - using default model',
        estimatedCostMultiplier: 1,
      };
    }

    // Check if we can downgrade based on task
    if (config.canDowngrade && config.downgradeModel) {
      const taskLower = task.toLowerCase();
      const complexity = this.assessComplexity(taskLower);

      if (complexity === 'low') {
        return {
          model: config.downgradeModel,
          reason: `Low complexity task - downgraded for cost savings`,
          estimatedCostMultiplier: this.getCostMultiplier(config.downgradeModel),
        };
      }

      // Check specific downgrade conditions
      if (config.downgradeConditions) {
        for (const condition of config.downgradeConditions) {
          if (taskLower.includes(condition.replace('_', ' '))) {
            return {
              model: config.downgradeModel,
              reason: `Task matches downgrade condition: ${condition}`,
              estimatedCostMultiplier: this.getCostMultiplier(config.downgradeModel),
            };
          }
        }
      }
    }

    // Use default model
    return {
      model: config.default,
      reason: config.reason,
      estimatedCostMultiplier: this.getCostMultiplier(config.default),
    };
  }

  /**
   * Assess task complexity based on keywords
   */
  assessComplexity(task) {
    for (const indicator of COMPLEXITY_INDICATORS.high) {
      if (task.includes(indicator)) {
        return 'high';
      }
    }

    for (const indicator of COMPLEXITY_INDICATORS.low) {
      if (task.includes(indicator)) {
        return 'low';
      }
    }

    return 'medium';
  }

  /**
   * Get cost multiplier relative to Sonnet
   */
  getCostMultiplier(model) {
    const sonnetCost = (PRICING[MODELS.SONNET].input + PRICING[MODELS.SONNET].output) / 2;
    const modelCost = (PRICING[model].input + PRICING[model].output) / 2;
    return modelCost / sonnetCost;
  }

  /**
   * Record token usage
   */
  recordUsage(model, inputTokens, outputTokens) {
    if (!this.trackUsage) return;

    if (this.usage[model]) {
      this.usage[model].requests++;
      this.usage[model].inputTokens += inputTokens;
      this.usage[model].outputTokens += outputTokens;
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const stats = {
      models: {},
      totalCost: 0,
      totalRequests: 0,
      savingsVsOpus: 0,
    };

    let opusCost = 0;

    for (const [model, usage] of Object.entries(this.usage)) {
      const pricing = PRICING[model];
      const cost = (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1000000;
      const opusEquivalent = (usage.inputTokens * PRICING[MODELS.OPUS].input +
        usage.outputTokens * PRICING[MODELS.OPUS].output) / 1000000;

      stats.models[model] = {
        requests: usage.requests,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: cost.toFixed(2),
      };

      stats.totalCost += cost;
      stats.totalRequests += usage.requests;
      opusCost += opusEquivalent;
    }

    stats.totalCost = stats.totalCost.toFixed(2);
    stats.savingsVsOpus = ((opusCost - parseFloat(stats.totalCost)) / opusCost * 100).toFixed(1) + '%';

    return stats;
  }

  /**
   * Estimate cost for a task
   */
  estimateCost(agentName, task, estimatedInputTokens = 1000, estimatedOutputTokens = 500) {
    const { model } = this.selectModel(agentName, task);
    const pricing = PRICING[model];

    const inputCost = (estimatedInputTokens * pricing.input) / 1000000;
    const outputCost = (estimatedOutputTokens * pricing.output) / 1000000;

    return {
      model,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: (inputCost + outputCost).toFixed(4),
    };
  }

  /**
   * Get routing recommendation for all agents
   */
  getRoutingTable() {
    const table = [];

    for (const [agent, config] of Object.entries(AGENT_MODEL_CONFIG)) {
      table.push({
        agent,
        defaultModel: config.default.split('-')[1], // Extract model name
        canDowngrade: config.canDowngrade,
        downgradeModel: config.downgradeModel?.split('-')[1],
        reason: config.reason,
      });
    }

    return table;
  }
}

// Singleton instance
let routerInstance = null;

/**
 * Get or create the Model Router singleton
 * @param {Object} options - Router options
 * @returns {ModelRouter}
 */
export function getModelRouter(options = {}) {
  if (!routerInstance) {
    routerInstance = new ModelRouter(options);
  }
  return routerInstance;
}

export default ModelRouter;
