/**
 * Autonomous Agent Orchestrator
 *
 * Coordinates the execution of multi-agent workflows with:
 * - Session management via Claude Managed Agents
 * - Tiered autonomy (auto-execute vs. require approval)
 * - Notification dispatch for mobile monitoring
 * - Event streaming to connected clients
 */

import { getSessionManager } from '../managed-agents/session-manager.js';
import { getApprovalPolicy } from './approval-policy.js';
import { sendAgentNotification } from '../wallet/agent-notification-service.js';
import { PrismaClient } from '@oh/db';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

/**
 * Run statuses
 */
export const RUN_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  AWAITING_APPROVAL: 'awaiting_approval',
  AWAITING_ANSWER: 'awaiting_answer',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Workflow phases
 */
export const PHASES = {
  IDEA_SUBMITTED: 'idea_submitted',
  CEO_REVIEW: 'ceo_review',
  SPECIALIST_REVIEW: 'specialist_review',
  ARCHITECTURE: 'architecture',
  IMPLEMENTATION: 'implementation',
  CODE_REVIEW: 'code_review',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
};

/**
 * Autonomous Orchestrator
 */
export class AutonomousOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.sessionManager = getSessionManager();
    this.approvalPolicy = getApprovalPolicy();
    this.activeRuns = new Map();
    this.notificationTargets = new Map(); // userId -> notification preferences
  }

  /**
   * Initialize the orchestrator
   */
  async initialize() {
    console.log('[Orchestrator] Initializing...');
    await this.sessionManager.initialize();

    // Load active runs from database
    await this.loadActiveRuns();

    console.log('[Orchestrator] Ready');
  }

  /**
   * Load active runs from database
   */
  async loadActiveRuns() {
    try {
      const runs = await prisma.agentRun.findMany({
        where: {
          status: {
            in: [RUN_STATUS.RUNNING, RUN_STATUS.AWAITING_APPROVAL, RUN_STATUS.AWAITING_ANSWER],
          },
        },
        include: {
          phases: true,
          sessions: true,
        },
      });

      for (const run of runs) {
        this.activeRuns.set(run.id, run);
      }

      console.log(`[Orchestrator] Loaded ${runs.length} active runs`);
    } catch (error) {
      console.warn('[Orchestrator] Could not load active runs:', error.message);
    }
  }

  /**
   * Submit a new idea for processing
   *
   * @param {Object} options - Idea options
   * @param {string} options.idea - The idea description
   * @param {string} options.userId - User who submitted
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - Created run
   */
  async submitIdea({ idea, userId, metadata = {} }) {
    // Create run in database
    const run = await prisma.agentRun.create({
      data: {
        idea,
        userId,
        status: RUN_STATUS.RUNNING,
        currentPhase: PHASES.IDEA_SUBMITTED,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.activeRuns.set(run.id, run);

    console.log(`[Orchestrator] Created run ${run.id} for idea: ${idea.substring(0, 50)}...`);

    // Start CEO review
    this.startPhase(run.id, PHASES.CEO_REVIEW, idea);

    return run;
  }

  /**
   * Start a workflow phase
   *
   * @param {string} runId - Run ID
   * @param {string} phase - Phase to start
   * @param {string} task - Task description
   */
  async startPhase(runId, phase, task) {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Determine which agent handles this phase
    const agentName = this.getAgentForPhase(phase);
    if (!agentName) {
      console.error(`[Orchestrator] No agent for phase: ${phase}`);
      return;
    }

    console.log(`[Orchestrator] Starting phase ${phase} with agent ${agentName}`);

    // Create session
    const session = await this.sessionManager.createSession({
      agentName,
      task: this.buildTaskPrompt(phase, task, run),
      runId,
      context: {
        phase,
        idea: run.idea,
        userId: run.userId,
      },
    });

    // Update run status
    run.currentPhase = phase;
    run.currentSession = session.id;
    run.status = RUN_STATUS.RUNNING;

    await this.updateRun(runId, {
      currentPhase: phase,
      status: RUN_STATUS.RUNNING,
    });

    // Record phase start
    await this.recordPhaseStart(runId, phase, agentName, session.id);

    // Emit event
    this.emit('phase_started', { runId, phase, agentName, sessionId: session.id });

    // Stream session events
    this.streamSessionEvents(runId, session.id);
  }

  /**
   * Stream events from a session and handle them
   *
   * @param {string} runId - Run ID
   * @param {string} sessionId - Session ID
   */
  async streamSessionEvents(runId, sessionId) {
    const run = this.activeRuns.get(runId);

    await this.sessionManager.streamSession(sessionId, async (event) => {
      // Forward event to listeners
      this.emit('session_event', { runId, sessionId, event });

      // Handle specific event types
      switch (event.type) {
        case 'tool_use':
          await this.handleToolUse(runId, sessionId, event);
          break;

        case 'approval_requested':
          await this.handleApprovalRequest(runId, sessionId, event);
          break;

        case 'question_asked':
          await this.handleQuestion(runId, sessionId, event);
          break;

        case 'phase_completed':
        case 'session_completed':
          await this.handlePhaseComplete(runId, sessionId, event);
          break;

        case 'error':
          await this.handleError(runId, sessionId, event);
          break;
      }
    });
  }

  /**
   * Handle tool use events - check if approval is needed
   */
  async handleToolUse(runId, sessionId, event) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    // Check if this tool use requires approval
    if (event.tool === 'edit_file' || event.tool === 'write_file') {
      const changes = event.changes || [{ filePath: event.path }];
      const approval = this.approvalPolicy.checkAgentAction(
        run.currentAgent,
        'file_change',
        { changes }
      );

      if (approval.requiresApproval) {
        // Pause execution and request approval
        await this.requestApproval(runId, sessionId, {
          type: 'file_change',
          changes,
          reason: approval.reason,
          priority: approval.priority,
        });
      }
    }
  }

  /**
   * Request approval from user
   */
  async requestApproval(runId, sessionId, details) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    // Update run status
    run.status = RUN_STATUS.AWAITING_APPROVAL;
    await this.updateRun(runId, { status: RUN_STATUS.AWAITING_APPROVAL });

    // Create approval request record
    const approvalRequest = await prisma.agentApprovalRequest.create({
      data: {
        runId,
        sessionId,
        type: details.type,
        details: JSON.stringify(details),
        priority: details.priority,
        status: 'pending',
        createdAt: new Date(),
      },
    });

    // Send notification to user's mobile
    await this.notifyUser(run.userId, 'approval_needed', {
      runId,
      phase: run.currentPhase,
      type: details.type,
      reason: details.reason,
      priority: details.priority,
      approvalId: approvalRequest.id,
    });

    // Emit event
    this.emit('approval_requested', {
      runId,
      sessionId,
      approvalId: approvalRequest.id,
      details,
    });
  }

  /**
   * Handle question from agent
   */
  async handleQuestion(runId, sessionId, event) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    // Update run status
    run.status = RUN_STATUS.AWAITING_ANSWER;
    await this.updateRun(runId, { status: RUN_STATUS.AWAITING_ANSWER });

    // Create question record
    const question = await prisma.agentQuestion.create({
      data: {
        runId,
        sessionId,
        questionId: event.question_id,
        question: event.question,
        options: event.options ? JSON.stringify(event.options) : null,
        status: 'pending',
        createdAt: new Date(),
      },
    });

    // Send notification to user
    await this.notifyUser(run.userId, 'question_asked', {
      runId,
      phase: run.currentPhase,
      questionId: question.id,
      question: event.question,
      options: event.options,
    });

    // Emit event
    this.emit('question_asked', { runId, sessionId, question: event });
  }

  /**
   * Handle phase completion
   */
  async handlePhaseComplete(runId, sessionId, event) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    // Record phase completion
    await this.recordPhaseComplete(runId, run.currentPhase, event.result);

    // Emit event
    this.emit('phase_completed', { runId, phase: run.currentPhase, result: event.result });

    // Determine next phase
    const nextPhase = this.getNextPhase(run.currentPhase, event.result);

    if (nextPhase === PHASES.COMPLETED) {
      await this.completeRun(runId, 'completed');
    } else if (nextPhase === PHASES.REJECTED) {
      await this.completeRun(runId, 'rejected');
    } else if (nextPhase) {
      // Start next phase
      await this.startPhase(runId, nextPhase, event.result?.summary || run.idea);
    }
  }

  /**
   * Handle errors
   */
  async handleError(runId, sessionId, event) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    console.error(`[Orchestrator] Error in run ${runId}:`, event.error);

    run.status = RUN_STATUS.FAILED;
    await this.updateRun(runId, {
      status: RUN_STATUS.FAILED,
      error: event.error,
    });

    // Notify user
    await this.notifyUser(run.userId, 'agent_error', {
      runId,
      phase: run.currentPhase,
      error: event.error,
    });

    this.emit('run_failed', { runId, error: event.error });
  }

  /**
   * Approve a pending request
   */
  async approve(runId, approvalId, feedback = '') {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Update approval request
    await prisma.agentApprovalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'approved',
        feedback,
        respondedAt: new Date(),
      },
    });

    // Resume session
    await this.sessionManager.approveSession(run.currentSession, feedback);

    // Update run status
    run.status = RUN_STATUS.RUNNING;
    await this.updateRun(runId, { status: RUN_STATUS.RUNNING });

    this.emit('approval_granted', { runId, approvalId });
  }

  /**
   * Reject a pending request
   */
  async reject(runId, approvalId, reason = '') {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Update approval request
    await prisma.agentApprovalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'rejected',
        feedback: reason,
        respondedAt: new Date(),
      },
    });

    // Reject session
    await this.sessionManager.rejectSession(run.currentSession, reason);

    // Update run status
    run.status = RUN_STATUS.REJECTED;
    await this.updateRun(runId, { status: RUN_STATUS.REJECTED });

    this.emit('approval_rejected', { runId, approvalId, reason });
  }

  /**
   * Answer a question
   */
  async answerQuestion(runId, questionId, answer) {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Get the question record
    const question = await prisma.agentQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    // Update question
    await prisma.agentQuestion.update({
      where: { id: questionId },
      data: {
        answer,
        status: 'answered',
        answeredAt: new Date(),
      },
    });

    // Send answer to session
    await this.sessionManager.answerQuestion(
      run.currentSession,
      question.questionId,
      answer
    );

    // Update run status
    run.status = RUN_STATUS.RUNNING;
    await this.updateRun(runId, { status: RUN_STATUS.RUNNING });

    this.emit('question_answered', { runId, questionId, answer });
  }

  /**
   * Complete a run
   */
  async completeRun(runId, status) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.status = status === 'rejected' ? RUN_STATUS.REJECTED : RUN_STATUS.COMPLETED;
    run.currentPhase = status === 'rejected' ? PHASES.REJECTED : PHASES.COMPLETED;

    await this.updateRun(runId, {
      status: run.status,
      currentPhase: run.currentPhase,
      completedAt: new Date(),
    });

    // Notify user
    await this.notifyUser(run.userId, 'agent_completed', {
      runId,
      status: run.status,
      idea: run.idea,
    });

    // Remove from active runs
    this.activeRuns.delete(runId);

    this.emit('run_completed', { runId, status: run.status });
  }

  /**
   * Get agent for a phase
   */
  getAgentForPhase(phase) {
    const mapping = {
      [PHASES.CEO_REVIEW]: 'ceo-reviewer',
      [PHASES.SPECIALIST_REVIEW]: 'ceo-reviewer', // CEO coordinates specialists
      [PHASES.ARCHITECTURE]: 'cto-advisor',
      [PHASES.IMPLEMENTATION]: 'engineer',
      [PHASES.CODE_REVIEW]: 'ciso-auditor',
    };
    return mapping[phase];
  }

  /**
   * Get next phase after current
   */
  getNextPhase(currentPhase, result) {
    // Check for rejection
    if (result?.decision === 'REJECTED') {
      return PHASES.REJECTED;
    }

    const sequence = [
      PHASES.IDEA_SUBMITTED,
      PHASES.CEO_REVIEW,
      PHASES.SPECIALIST_REVIEW,
      PHASES.ARCHITECTURE,
      PHASES.IMPLEMENTATION,
      PHASES.CODE_REVIEW,
      PHASES.COMPLETED,
    ];

    const currentIndex = sequence.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
      return PHASES.COMPLETED;
    }

    return sequence[currentIndex + 1];
  }

  /**
   * Build task prompt for a phase
   */
  buildTaskPrompt(phase, task, run) {
    const prompts = {
      [PHASES.CEO_REVIEW]: `Review this idea for strategic fit and feasibility:\n\n${task}\n\nConsider: strategic alignment, user value, technical feasibility, security implications, and priority.`,
      [PHASES.SPECIALIST_REVIEW]: `Coordinate specialist review of this approved idea:\n\n${task}\n\nLaunch parallel reviews with CTO (technical), CPO (product), and CISO (security).`,
      [PHASES.ARCHITECTURE]: `Design the architecture for this approved feature:\n\n${task}\n\nProvide: component structure, data flow, API contracts, and implementation sequence.`,
      [PHASES.IMPLEMENTATION]: `Implement this approved architecture:\n\n${task}\n\nFollow the plan exactly. Write tests. Update todos as you progress.`,
      [PHASES.CODE_REVIEW]: `Review this implementation for security and quality:\n\n${task}\n\nCheck: OWASP Top 10, input validation, auth/authz, code quality, test coverage.`,
    };

    return prompts[phase] || task;
  }

  /**
   * Notify user via mobile
   */
  async notifyUser(userId, type, data) {
    try {
      await sendAgentNotification(userId, type, data);
    } catch (error) {
      console.error(`[Orchestrator] Failed to notify user ${userId}:`, error.message);
    }
  }

  /**
   * Update run in database
   */
  async updateRun(runId, data) {
    try {
      await prisma.agentRun.update({
        where: { id: runId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`[Orchestrator] Failed to update run ${runId}:`, error.message);
    }
  }

  /**
   * Record phase start
   */
  async recordPhaseStart(runId, phase, agentName, sessionId) {
    try {
      await prisma.agentPhase.create({
        data: {
          runId,
          phase,
          agentName,
          sessionId,
          status: 'running',
          startedAt: new Date(),
        },
      });
    } catch (error) {
      console.warn(`[Orchestrator] Could not record phase start:`, error.message);
    }
  }

  /**
   * Record phase completion
   */
  async recordPhaseComplete(runId, phase, result) {
    try {
      await prisma.agentPhase.updateMany({
        where: { runId, phase, status: 'running' },
        data: {
          status: result?.success ? 'completed' : 'failed',
          result: result ? JSON.stringify(result) : null,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      console.warn(`[Orchestrator] Could not record phase complete:`, error.message);
    }
  }

  /**
   * Get run status
   */
  async getRun(runId) {
    // Check active runs first
    if (this.activeRuns.has(runId)) {
      return this.activeRuns.get(runId);
    }

    // Fetch from database
    return prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        phases: true,
        questions: true,
        approvalRequests: true,
      },
    });
  }

  /**
   * List runs
   */
  async listRuns(options = {}) {
    const { limit = 20, offset = 0, status, userId } = options;

    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    return prisma.agentRun.findMany({
      where,
      take: parseInt(limit, 10) || 20,
      skip: parseInt(offset, 10) || 0,
      orderBy: { createdAt: 'desc' },
      include: {
        phases: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
  }

  /**
   * Get runs for a user (alias for listRuns with userId filter)
   */
  async getRuns(userId, options = {}) {
    return this.listRuns({ ...options, userId });
  }

  /**
   * Cancel a run
   */
  async cancelRun(runId, reason = '') {
    const run = this.activeRuns.get(runId);

    // Stop any active session
    if (run?.currentSession) {
      try {
        await this.sessionManager.stopSession(run.currentSession);
      } catch (error) {
        console.warn(`[Orchestrator] Could not stop session:`, error.message);
      }
    }

    // Update database
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'cancelled',
        error: reason || 'Cancelled by user',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Remove from active runs
    this.activeRuns.delete(runId);

    this.emit('run_cancelled', { runId, reason });
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId, options = {}) {
    const { priority } = options;

    const where = {
      status: 'pending',
      run: { userId },
    };

    if (priority) {
      where.priority = priority;
    }

    return prisma.agentApprovalRequest.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        run: {
          select: {
            id: true,
            idea: true,
            currentPhase: true,
          },
        },
      },
    });
  }

  /**
   * Get pending questions for a user
   */
  async getPendingQuestions(userId) {
    return prisma.agentQuestion.findMany({
      where: {
        status: 'pending',
        run: { userId },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        run: {
          select: {
            id: true,
            idea: true,
            currentPhase: true,
          },
        },
      },
    });
  }
}

// Singleton instance
let orchestratorInstance = null;

/**
 * Get or create the Orchestrator singleton
 * @returns {AutonomousOrchestrator}
 */
export function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new AutonomousOrchestrator();
  }
  return orchestratorInstance;
}

export default AutonomousOrchestrator;
