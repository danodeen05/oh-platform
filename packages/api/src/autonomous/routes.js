/**
 * Autonomous Agents API Routes
 *
 * REST API endpoints for the autonomous agent orchestration system.
 * Handles idea submission, approvals, questions, and run management.
 */

import { getOrchestrator, getApprovalPolicy } from './index.js';
import { getScheduler, registerWebhookRoutes } from '../triggers/index.js';
import {
  sendAgentNotification,
  registerDevice,
  unregisterDevice,
  NOTIFICATION_TYPES
} from '../wallet/agent-notification-service.js';
import { getModelRouter } from '../managed-agents/index.js';

/**
 * Register all autonomous agent routes
 * @param {import('fastify').FastifyInstance} app - Fastify instance
 */
export async function registerAutonomousRoutes(app) {
  const orchestrator = getOrchestrator();
  const approvalPolicy = getApprovalPolicy();
  const modelRouter = getModelRouter();

  // ====================
  // IDEA SUBMISSION
  // ====================

  /**
   * Get ideas API info
   * GET /agents/ideas
   */
  app.get('/agents/ideas', async (req, reply) => {
    return reply.send({
      endpoint: '/agents/ideas',
      method: 'POST',
      description: 'Submit a new idea for autonomous agent processing',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'Required - Your user ID',
      },
      body: {
        idea: 'Required - Description of the feature or improvement',
        metadata: 'Optional - Additional context',
      },
      example: {
        idea: 'Add dark mode support to the application',
      },
    });
  });

  /**
   * Submit a new idea for autonomous processing
   * POST /agents/ideas
   */
  app.post('/agents/ideas', async (req, reply) => {
    try {
      const { idea, metadata = {} } = req.body;
      const userId = req.headers['x-user-id'] || metadata.userId;

      if (!idea) {
        return reply.status(400).send({ error: 'Idea is required' });
      }

      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }

      const run = await orchestrator.submitIdea({
        idea,
        userId,
        metadata,
      });

      return reply.status(201).send({
        success: true,
        runId: run.id,
        status: run.status,
        message: 'Idea submitted for CEO review',
      });
    } catch (error) {
      console.error('[Autonomous] Idea submission error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // RUN MANAGEMENT
  // ====================

  /**
   * Get all runs for a user
   * GET /agents/runs
   */
  app.get('/agents/runs', async (req, reply) => {
    try {
      const userId = req.headers['x-user-id'];
      const { status, limit = 20, offset = 0 } = req.query;

      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }

      const runs = await orchestrator.getRuns(userId, { status, limit, offset });

      return reply.send({
        runs,
        pagination: { limit, offset },
      });
    } catch (error) {
      console.error('[Autonomous] Get runs error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get a specific run with full details
   * GET /agents/runs/:id
   */
  app.get('/agents/runs/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const run = await orchestrator.getRun(id);

      if (!run) {
        return reply.status(404).send({ error: 'Run not found' });
      }

      return reply.send({ run });
    } catch (error) {
      console.error('[Autonomous] Get run error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Cancel a run
   * POST /agents/runs/:id/cancel
   */
  app.post('/agents/runs/:id/cancel', async (req, reply) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await orchestrator.cancelRun(id, reason);

      return reply.send({ success: true, message: 'Run cancelled' });
    } catch (error) {
      console.error('[Autonomous] Cancel run error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // APPROVALS
  // ====================

  /**
   * Get pending approvals
   * GET /agents/approvals
   */
  app.get('/agents/approvals', async (req, reply) => {
    try {
      const userId = req.headers['x-user-id'];
      const { priority } = req.query;

      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }

      const approvals = await orchestrator.getPendingApprovals(userId, { priority });

      return reply.send({ approvals });
    } catch (error) {
      console.error('[Autonomous] Get approvals error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Approve or reject a pending approval
   * POST /agents/approvals/:id
   */
  app.post('/agents/approvals/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { action, feedback } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return reply.status(400).send({ error: 'Action must be "approve" or "reject"' });
      }

      if (action === 'approve') {
        await orchestrator.approve(null, id, feedback);
      } else {
        await orchestrator.reject(null, id, feedback);
      }

      return reply.send({
        success: true,
        message: `Approval ${action}d`,
      });
    } catch (error) {
      console.error('[Autonomous] Approval action error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // QUESTIONS
  // ====================

  /**
   * Get pending questions
   * GET /agents/questions
   */
  app.get('/agents/questions', async (req, reply) => {
    try {
      const userId = req.headers['x-user-id'];

      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }

      const questions = await orchestrator.getPendingQuestions(userId);

      return reply.send({ questions });
    } catch (error) {
      console.error('[Autonomous] Get questions error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Answer a question
   * POST /agents/questions/:id
   */
  app.post('/agents/questions/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { answer } = req.body;

      if (!answer) {
        return reply.status(400).send({ error: 'Answer is required' });
      }

      await orchestrator.answerQuestion(null, id, answer);

      return reply.send({ success: true, message: 'Question answered' });
    } catch (error) {
      console.error('[Autonomous] Answer question error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // APPROVAL POLICY
  // ====================

  /**
   * Classify a change to determine autonomy level
   * POST /agents/classify
   */
  app.post('/agents/classify', async (req, reply) => {
    try {
      const { files, agentName } = req.body;

      if (!files || !Array.isArray(files)) {
        return reply.status(400).send({ error: 'Files array is required' });
      }

      // Convert file paths to change objects
      const changes = files.map(f => typeof f === 'string' ? { filePath: f } : f);
      const evaluation = approvalPolicy.evaluateChanges(changes);

      // Check agent-specific action if agent name provided
      let agentAutonomy = null;
      if (agentName) {
        agentAutonomy = approvalPolicy.checkAgentAction(agentName, 'file_change', { changes });
      }

      return reply.send({
        overallAutonomy: evaluation.overallAutonomy,
        classifications: evaluation.classifications,
        blockers: evaluation.blockers,
        reasons: evaluation.reasons,
        requiresApproval: evaluation.overallAutonomy !== 'AUTO',
        agentAutonomy,
      });
    } catch (error) {
      console.error('[Autonomous] Classification error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // NOTIFICATIONS
  // ====================

  /**
   * Register a device for push notifications
   * POST /agents/notifications/devices
   */
  app.post('/agents/notifications/devices', async (req, reply) => {
    try {
      const { pushToken, platform, deviceId } = req.body;
      const userId = req.headers['x-user-id'];

      if (!userId || !pushToken || !deviceId) {
        return reply.status(400).send({
          error: 'User ID, push token, and device ID are required'
        });
      }

      const result = await registerDevice(userId, pushToken, platform, deviceId);

      return reply.send(result);
    } catch (error) {
      console.error('[Autonomous] Device registration error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Unregister a device
   * DELETE /agents/notifications/devices/:deviceId
   */
  app.delete('/agents/notifications/devices/:deviceId', async (req, reply) => {
    try {
      const { deviceId } = req.params;
      const userId = req.headers['x-user-id'];

      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }

      const result = await unregisterDevice(userId, deviceId);

      return reply.send(result);
    } catch (error) {
      console.error('[Autonomous] Device unregistration error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Send a test notification
   * POST /agents/notifications/test
   */
  app.post('/agents/notifications/test', async (req, reply) => {
    try {
      const userId = req.headers['x-user-id'];
      const { type = 'agent_completed' } = req.body;

      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }

      const result = await sendAgentNotification(userId, type, {
        idea: 'Test notification',
        phase: 'test',
      });

      return reply.send(result);
    } catch (error) {
      console.error('[Autonomous] Test notification error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // MODEL ROUTING & STATS
  // ====================

  /**
   * Get model routing table
   * GET /agents/models/routing
   */
  app.get('/agents/models/routing', async (req, reply) => {
    try {
      const routingTable = modelRouter.getRoutingTable();
      return reply.send({ routing: routingTable });
    } catch (error) {
      console.error('[Autonomous] Routing table error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Get usage statistics
   * GET /agents/models/usage
   */
  app.get('/agents/models/usage', async (req, reply) => {
    try {
      const stats = modelRouter.getUsageStats();
      return reply.send({ stats });
    } catch (error) {
      console.error('[Autonomous] Usage stats error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Estimate cost for a task
   * POST /agents/models/estimate
   */
  app.post('/agents/models/estimate', async (req, reply) => {
    try {
      const { agentName, task, inputTokens = 1000, outputTokens = 500 } = req.body;

      if (!agentName) {
        return reply.status(400).send({ error: 'Agent name is required' });
      }

      const estimate = modelRouter.estimateCost(agentName, task, inputTokens, outputTokens);

      return reply.send({ estimate });
    } catch (error) {
      console.error('[Autonomous] Cost estimate error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // SCHEDULER MANAGEMENT
  // ====================

  /**
   * Get scheduler status
   * GET /agents/scheduler/status
   */
  app.get('/agents/scheduler/status', async (req, reply) => {
    try {
      const scheduler = getScheduler();
      const status = await scheduler.getStatus();
      return reply.send({ status });
    } catch (error) {
      console.error('[Autonomous] Scheduler status error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * Trigger a scheduled job manually
   * POST /agents/scheduler/trigger
   */
  app.post('/agents/scheduler/trigger', async (req, reply) => {
    try {
      const { jobType, data = {} } = req.body;
      const userId = req.headers['x-user-id'];

      if (!jobType) {
        return reply.status(400).send({ error: 'Job type is required' });
      }

      const scheduler = getScheduler();
      const job = await scheduler.triggerJob(jobType, { ...data, triggeredBy: userId });

      return reply.send({
        success: true,
        jobId: job.id,
        message: `Job ${jobType} triggered`,
      });
    } catch (error) {
      console.error('[Autonomous] Trigger job error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // ====================
  // HEALTH CHECK
  // ====================

  /**
   * Autonomous system health check
   * GET /agents/health
   */
  app.get('/agents/health', async (req, reply) => {
    try {
      const scheduler = getScheduler();
      const schedulerStatus = await scheduler.getStatus().catch(() => ({ error: 'unavailable' }));

      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        components: {
          orchestrator: 'ready',
          scheduler: schedulerStatus.error ? 'unavailable' : 'ready',
          modelRouter: 'ready',
        },
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        error: error.message,
      });
    }
  });

  // Register webhook routes
  registerWebhookRoutes(app);

  console.log('✓ Autonomous agent routes registered');
}

export default registerAutonomousRoutes;
