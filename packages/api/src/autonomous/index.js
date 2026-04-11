/**
 * Autonomous Agent Execution Module
 *
 * Provides the orchestration layer for autonomous agent workflows:
 * - Tiered autonomy (auto-execute vs. require approval)
 * - Multi-agent coordination
 * - Event-driven execution
 *
 * @module autonomous
 */

export { ApprovalPolicy, getApprovalPolicy, CHANGE_TYPES } from './approval-policy.js';
export {
  AutonomousOrchestrator,
  getOrchestrator,
  RUN_STATUS,
  PHASES,
} from './orchestrator.js';
export { registerAutonomousRoutes } from './routes.js';
