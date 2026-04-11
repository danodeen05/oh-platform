/**
 * Webhook Handlers for Agent Wake Triggers
 *
 * Provides Fastify route handlers for:
 * - GitHub webhooks (issues, PRs, deployments)
 * - Stripe webhooks (payment events)
 * - Monitoring webhooks (alerts from external services)
 *
 * These webhooks queue jobs for the scheduler to process asynchronously.
 */

import crypto from 'crypto';
import { getScheduler, JOB_TYPES } from './scheduler.js';

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(payload, signature, secret) {
  if (!secret) return true; // Skip verification if no secret configured

  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload, signature, secret) {
  if (!secret) return true; // Skip verification if no secret configured

  try {
    // Stripe signature format: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const v1Signature = parts.find(p => p.startsWith('v1='))?.slice(3);

    if (!timestamp || !v1Signature) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Register webhook routes with Fastify
 *
 * @param {FastifyInstance} app - Fastify instance
 */
export function registerWebhookRoutes(app) {
  const scheduler = getScheduler();

  // ==========================================
  // GITHUB WEBHOOKS
  // ==========================================

  /**
   * GitHub webhook endpoint
   * POST /webhooks/github
   *
   * Handles: issues, pull_request, deployment_status
   */
  app.post('/webhooks/github', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'];
    const event = request.headers['x-github-event'];
    const deliveryId = request.headers['x-github-delivery'];

    console.log(`[Webhooks] GitHub event: ${event} (${deliveryId})`);

    // Verify signature
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret && !verifyGitHubSignature(JSON.stringify(request.body), signature, secret)) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    const payload = request.body;

    try {
      let jobType;

      switch (event) {
        case 'issues':
          jobType = JOB_TYPES.GITHUB_ISSUE;
          break;

        case 'pull_request':
          jobType = JOB_TYPES.GITHUB_PR;
          break;

        case 'deployment_status':
          jobType = JOB_TYPES.GITHUB_DEPLOY;
          break;

        default:
          // Event type not handled
          return reply.send({ received: true, processed: false, reason: 'event_not_handled' });
      }

      // Queue the job
      const job = await scheduler.queueWebhook(jobType, {
        action: payload.action,
        issue: payload.issue,
        pull_request: payload.pull_request,
        deployment: payload.deployment,
        deployment_status: payload.deployment_status,
        repository: payload.repository,
        sender: payload.sender,
      });

      return reply.send({
        received: true,
        processed: true,
        jobId: job?.id,
        event,
      });
    } catch (error) {
      console.error('[Webhooks] GitHub webhook error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // STRIPE WEBHOOKS
  // ==========================================

  /**
   * Stripe webhook endpoint
   * POST /webhooks/stripe
   *
   * Handles: payment_intent.payment_failed, charge.dispute.created, etc.
   */
  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'];

    console.log(`[Webhooks] Stripe event received`);

    // Verify signature
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (secret && !verifyStripeSignature(JSON.stringify(request.body), signature, secret)) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    const event = request.body;

    // Only process specific event types that warrant agent attention
    const agentEventTypes = [
      'payment_intent.payment_failed',
      'charge.dispute.created',
      'charge.dispute.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ];

    if (!agentEventTypes.includes(event.type)) {
      return reply.send({ received: true, processed: false, reason: 'event_not_handled' });
    }

    try {
      const job = await scheduler.queueWebhook(JOB_TYPES.STRIPE_EVENT, {
        type: event.type,
        data: event.data,
        created: event.created,
        id: event.id,
      });

      return reply.send({
        received: true,
        processed: true,
        jobId: job?.id,
        eventType: event.type,
      });
    } catch (error) {
      console.error('[Webhooks] Stripe webhook error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // MONITORING WEBHOOKS
  // ==========================================

  /**
   * Generic monitoring alert webhook
   * POST /webhooks/monitoring
   *
   * Accepts alerts from various monitoring services (Datadog, PagerDuty, etc.)
   */
  app.post('/webhooks/monitoring', async (request, reply) => {
    // Basic auth verification
    const authHeader = request.headers['authorization'];
    const expectedToken = process.env.MONITORING_WEBHOOK_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    console.log('[Webhooks] Monitoring alert received');

    const { alertName, severity, message, source, timestamp, metadata } = request.body;

    // Validate required fields
    if (!alertName || !message) {
      return reply.code(400).send({ error: 'Missing required fields: alertName, message' });
    }

    try {
      const job = await scheduler.queueWebhook(JOB_TYPES.MONITORING_ALERT, {
        alertName,
        severity: severity || 'warning',
        message,
        source: source || 'unknown',
        timestamp: timestamp || new Date().toISOString(),
        metadata,
      });

      return reply.send({
        received: true,
        processed: true,
        jobId: job?.id,
        alertName,
      });
    } catch (error) {
      console.error('[Webhooks] Monitoring webhook error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // MANUAL TRIGGER ENDPOINT
  // ==========================================

  /**
   * Manual trigger endpoint for testing
   * POST /webhooks/trigger
   *
   * Allows manual triggering of agent workflows
   */
  app.post('/webhooks/trigger', async (request, reply) => {
    // Require authentication
    const authHeader = request.headers['authorization'];
    const expectedToken = process.env.AGENT_TRIGGER_SECRET || process.env.CRON_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { idea, userId, metadata } = request.body;

    if (!idea) {
      return reply.code(400).send({ error: 'Missing required field: idea' });
    }

    console.log(`[Webhooks] Manual trigger: ${idea.substring(0, 50)}...`);

    try {
      const job = await scheduler.queueAdhoc(idea, userId || 'manual-trigger', metadata || {});

      return reply.send({
        received: true,
        processed: true,
        jobId: job?.id || 'inline',
      });
    } catch (error) {
      console.error('[Webhooks] Manual trigger error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // STATUS ENDPOINT
  // ==========================================

  /**
   * Scheduler status endpoint
   * GET /webhooks/status
   */
  app.get('/webhooks/status', async (request, reply) => {
    try {
      const stats = await scheduler.getStats();

      return reply.send({
        status: scheduler.isRunning ? 'running' : 'stopped',
        queues: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.send({
        status: 'error',
        error: error.message,
      });
    }
  });

  console.log('[Webhooks] Routes registered');
}

export default registerWebhookRoutes;
