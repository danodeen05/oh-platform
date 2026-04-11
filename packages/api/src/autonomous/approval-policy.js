/**
 * Tiered Autonomy Approval Policy
 *
 * Defines rules for what changes can be auto-executed vs. require approval.
 *
 * Autonomy Levels:
 * - AUTO: Execute immediately, notify after
 * - APPROVAL: Wait for mobile approval before executing
 * - BLOCKED: Always requires human review (security-critical)
 */

/**
 * Change types and their default autonomy levels
 */
export const CHANGE_TYPES = {
  // Auto-execute (safe changes)
  DOCUMENTATION: 'AUTO',
  TEST_ADDITION: 'AUTO',
  COMMENT_UPDATE: 'AUTO',
  FORMATTING: 'AUTO',
  TYPE_ANNOTATION: 'AUTO',

  // Requires approval (significant changes)
  SINGLE_FILE_FIX: 'APPROVAL',
  MULTI_FILE_CHANGE: 'APPROVAL',
  NEW_FEATURE: 'APPROVAL',
  REFACTORING: 'APPROVAL',
  DEPENDENCY_UPDATE: 'APPROVAL',
  CONFIG_CHANGE: 'APPROVAL',

  // Always blocked (high-risk)
  SCHEMA_CHANGE: 'BLOCKED',
  API_CONTRACT: 'BLOCKED',
  AUTH_CHANGE: 'BLOCKED',
  SECURITY_RELATED: 'BLOCKED',
  PAYMENT_RELATED: 'BLOCKED',
  DATABASE_MIGRATION: 'BLOCKED',
  ENVIRONMENT_VARIABLE: 'BLOCKED',
};

/**
 * File path patterns and their associated change types
 */
const FILE_PATTERNS = [
  // Documentation - AUTO
  { pattern: /\.md$/i, type: 'DOCUMENTATION' },
  { pattern: /\/docs\//i, type: 'DOCUMENTATION' },
  { pattern: /README/i, type: 'DOCUMENTATION' },
  { pattern: /CHANGELOG/i, type: 'DOCUMENTATION' },

  // Tests - AUTO
  { pattern: /\.test\.[jt]sx?$/i, type: 'TEST_ADDITION' },
  { pattern: /\.spec\.[jt]sx?$/i, type: 'TEST_ADDITION' },
  { pattern: /\/__tests__\//i, type: 'TEST_ADDITION' },
  { pattern: /\/tests?\//i, type: 'TEST_ADDITION' },

  // Schema/Database - BLOCKED
  { pattern: /schema\.prisma$/i, type: 'SCHEMA_CHANGE' },
  { pattern: /migrations?\//i, type: 'DATABASE_MIGRATION' },
  { pattern: /\.sql$/i, type: 'SCHEMA_CHANGE' },

  // Auth/Security - BLOCKED
  { pattern: /auth/i, type: 'AUTH_CHANGE' },
  { pattern: /security/i, type: 'SECURITY_RELATED' },
  { pattern: /password/i, type: 'SECURITY_RELATED' },
  { pattern: /credential/i, type: 'SECURITY_RELATED' },
  { pattern: /secret/i, type: 'SECURITY_RELATED' },
  { pattern: /token/i, type: 'SECURITY_RELATED' },

  // Payment - BLOCKED
  { pattern: /payment/i, type: 'PAYMENT_RELATED' },
  { pattern: /stripe/i, type: 'PAYMENT_RELATED' },
  { pattern: /billing/i, type: 'PAYMENT_RELATED' },
  { pattern: /checkout/i, type: 'PAYMENT_RELATED' },

  // Config/Environment - BLOCKED
  { pattern: /\.env/i, type: 'ENVIRONMENT_VARIABLE' },
  { pattern: /config\.[jt]s$/i, type: 'CONFIG_CHANGE' },

  // Dependencies - APPROVAL
  { pattern: /package\.json$/i, type: 'DEPENDENCY_UPDATE' },
  { pattern: /pnpm-lock\.yaml$/i, type: 'DEPENDENCY_UPDATE' },
  { pattern: /yarn\.lock$/i, type: 'DEPENDENCY_UPDATE' },

  // API contracts - BLOCKED
  { pattern: /\/api\//i, type: 'API_CONTRACT' },
  { pattern: /routes?\.[jt]s$/i, type: 'API_CONTRACT' },
];

/**
 * Approval Policy
 */
export class ApprovalPolicy {
  constructor(options = {}) {
    this.strictMode = options.strictMode ?? false; // In strict mode, everything requires approval
    this.customRules = options.customRules ?? [];
  }

  /**
   * Classify a file change
   *
   * @param {string} filePath - Path to the file
   * @param {Object} change - Change details
   * @returns {Object} - { type: string, autonomy: 'AUTO'|'APPROVAL'|'BLOCKED' }
   */
  classifyFileChange(filePath, change = {}) {
    // Check custom rules first
    for (const rule of this.customRules) {
      if (rule.pattern.test(filePath)) {
        return {
          type: rule.type,
          autonomy: CHANGE_TYPES[rule.type] || 'APPROVAL',
          reason: rule.reason || 'Custom rule match',
        };
      }
    }

    // Check built-in patterns
    for (const { pattern, type } of FILE_PATTERNS) {
      if (pattern.test(filePath)) {
        return {
          type,
          autonomy: CHANGE_TYPES[type],
          reason: `File matches pattern: ${pattern}`,
        };
      }
    }

    // Default based on change magnitude
    if (change.linesAdded !== undefined && change.linesDeleted !== undefined) {
      const totalChanges = change.linesAdded + change.linesDeleted;
      if (totalChanges <= 10) {
        return {
          type: 'SINGLE_FILE_FIX',
          autonomy: 'APPROVAL',
          reason: 'Small change to code file',
        };
      }
    }

    // Default to requiring approval
    return {
      type: 'MULTI_FILE_CHANGE',
      autonomy: 'APPROVAL',
      reason: 'Default policy - requires approval',
    };
  }

  /**
   * Evaluate a set of changes
   *
   * @param {Object[]} changes - Array of { filePath, linesAdded, linesDeleted }
   * @returns {Object} - { overallAutonomy, classifications, blockers, reasons }
   */
  evaluateChanges(changes) {
    if (this.strictMode) {
      return {
        overallAutonomy: 'APPROVAL',
        classifications: [],
        blockers: [],
        reasons: ['Strict mode enabled - all changes require approval'],
      };
    }

    const classifications = changes.map((change) => ({
      ...change,
      ...this.classifyFileChange(change.filePath, change),
    }));

    // Find blockers (any BLOCKED change blocks the entire set)
    const blockers = classifications.filter((c) => c.autonomy === 'BLOCKED');

    // Find approval-required changes
    const approvalRequired = classifications.filter((c) => c.autonomy === 'APPROVAL');

    // Multi-file changes require approval even if individual files are AUTO
    const isMultiFile = changes.length > 2;

    // Determine overall autonomy
    let overallAutonomy = 'AUTO';
    const reasons = [];

    if (blockers.length > 0) {
      overallAutonomy = 'BLOCKED';
      reasons.push(`Contains blocked file types: ${blockers.map((b) => b.type).join(', ')}`);
    } else if (approvalRequired.length > 0) {
      overallAutonomy = 'APPROVAL';
      reasons.push(`Contains changes requiring approval: ${approvalRequired.length} files`);
    } else if (isMultiFile) {
      overallAutonomy = 'APPROVAL';
      reasons.push('Multi-file change requires approval');
    } else {
      reasons.push('All changes are auto-executable');
    }

    return {
      overallAutonomy,
      classifications,
      blockers,
      reasons,
      summary: {
        total: changes.length,
        auto: classifications.filter((c) => c.autonomy === 'AUTO').length,
        approval: approvalRequired.length,
        blocked: blockers.length,
      },
    };
  }

  /**
   * Check if an agent action requires approval
   *
   * @param {string} agentName - Name of the agent
   * @param {string} actionType - Type of action
   * @param {Object} context - Additional context
   * @returns {Object} - { requiresApproval, reason }
   */
  checkAgentAction(agentName, actionType, context = {}) {
    // CISO always requires approval for recommendations
    if (agentName === 'ciso-auditor' && context.hasCriticalFindings) {
      return {
        requiresApproval: true,
        reason: 'CISO found critical security issues',
        priority: 'HIGH',
      };
    }

    // Engineer code changes
    if (agentName === 'engineer') {
      const evaluation = this.evaluateChanges(context.changes || []);
      return {
        requiresApproval: evaluation.overallAutonomy !== 'AUTO',
        reason: evaluation.reasons.join('; '),
        priority: evaluation.overallAutonomy === 'BLOCKED' ? 'HIGH' : 'MEDIUM',
        evaluation,
      };
    }

    // DevOps infrastructure changes always require approval
    if (agentName === 'devops-engineer') {
      return {
        requiresApproval: true,
        reason: 'Infrastructure changes require approval',
        priority: 'HIGH',
      };
    }

    // Tech Writer and QA can auto-execute most tasks
    if (agentName === 'tech-writer' || agentName === 'qa-engineer') {
      return {
        requiresApproval: false,
        reason: 'Documentation and testing are safe to auto-execute',
        priority: 'LOW',
      };
    }

    // Default: require approval
    return {
      requiresApproval: true,
      reason: 'Default policy requires approval',
      priority: 'MEDIUM',
    };
  }
}

// Singleton instance
let policyInstance = null;

/**
 * Get or create the Approval Policy singleton
 * @param {Object} options - Policy options
 * @returns {ApprovalPolicy}
 */
export function getApprovalPolicy(options = {}) {
  if (!policyInstance) {
    policyInstance = new ApprovalPolicy(options);
  }
  return policyInstance;
}

export default ApprovalPolicy;
