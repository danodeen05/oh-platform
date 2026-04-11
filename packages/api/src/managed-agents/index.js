/**
 * Claude Managed Agents Module
 *
 * Provides integration with Claude Managed Agents API for
 * autonomous agent execution with the Oh! Platform.
 *
 * @module managed-agents
 */

export { ManagedAgentsClient, getManagedAgentsClient, ManagedAgentsError } from './client.js';
export { SessionManager, getSessionManager } from './session-manager.js';
export {
  ALL_AGENTS,
  getAgent,
  getAgentsByRole,
  getAutonomousAgents,
  getApprovalRequiredAgents,
  CEO_AGENT,
  CTO_AGENT,
  CPO_AGENT,
  CISO_AGENT,
  ENGINEER_AGENT,
  QA_AGENT,
  DEVOPS_AGENT,
  TECH_WRITER_AGENT,
  MODELS,
} from './agents.js';
export { ModelRouter, getModelRouter, PRICING } from './model-router.js';
