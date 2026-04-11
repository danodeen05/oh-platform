/**
 * Agent Wake Trigger Scheduler
 *
 * Uses Redis + BullMQ for reliable scheduled job execution.
 * Handles autonomous agent wake triggers:
 * - Daily standup (9am CEO review)
 * - Hourly health checks
 * - Weekly audits (tech debt, documentation)
 *
 * @requires Redis to be running (available in docker-compose)
 */

import { Queue, Worker } from 'bullmq';
import { getOrchestrator } from '../autonomous/orchestrator.js';
import { PrismaClient } from '@oh/db';

const prisma = new PrismaClient();

// Redis connection config - supports REDIS_URL or individual settings
const getRedisConnection = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
};

// Queue names
const QUEUES = {
  SCHEDULED: 'agent-scheduled-triggers',
  WEBHOOK: 'agent-webhook-triggers',
  ADHOC: 'agent-adhoc-triggers',
};

/**
 * Job types for scheduled triggers
 */
export const JOB_TYPES = {
  // Daily
  CEO_STANDUP: 'ceo_standup',

  // Hourly
  HEALTH_CHECK: 'health_check',

  // Weekly
  TECH_DEBT_REVIEW: 'tech_debt_review',
  DOCS_AUDIT: 'docs_audit',

  // Event-driven
  GITHUB_ISSUE: 'github_issue',
  GITHUB_PR: 'github_pr',
  GITHUB_DEPLOY: 'github_deploy',
  STRIPE_EVENT: 'stripe_event',
  MONITORING_ALERT: 'monitoring_alert',
};

/**
 * Agent Scheduler
 */
export class AgentScheduler {
  constructor() {
    this.queues = {};
    this.workers = {};
    this.orchestrator = null;
    this.isRunning = false;
  }

  /**
   * Initialize the scheduler
   */
  async initialize() {
    const connection = getRedisConnection();
    console.log('[Scheduler] Initializing with Redis:', typeof connection === 'string' ? 'URL' : connection.host);

    try {
      // Create queues (BullMQ v5+ doesn't need QueueScheduler)
      for (const [name, queueName] of Object.entries(QUEUES)) {
        this.queues[name] = new Queue(queueName, { connection });
      }

      // Create workers
      this.workers.SCHEDULED = new Worker(
        QUEUES.SCHEDULED,
        this.processScheduledJob.bind(this),
        { connection, concurrency: 1 }
      );

      this.workers.WEBHOOK = new Worker(
        QUEUES.WEBHOOK,
        this.processWebhookJob.bind(this),
        { connection, concurrency: 5 }
      );

      this.workers.ADHOC = new Worker(
        QUEUES.ADHOC,
        this.processAdhocJob.bind(this),
        { connection, concurrency: 3 }
      );

      // Set up error handlers
      for (const [name, worker] of Object.entries(this.workers)) {
        worker.on('failed', (job, error) => {
          console.error(`[Scheduler] Job ${job.name} failed:`, error.message);
        });

        worker.on('completed', (job) => {
          console.log(`[Scheduler] Job ${job.name} completed`);
        });
      }

      // Get orchestrator
      this.orchestrator = getOrchestrator();

      // Set up recurring schedules
      await this.setupRecurringJobs();

      this.isRunning = true;
      console.log('[Scheduler] Ready');
    } catch (error) {
      console.error('[Scheduler] Failed to initialize:', error.message);
      console.warn('[Scheduler] Running without Redis - scheduled triggers disabled');
    }
  }

  /**
   * Set up recurring scheduled jobs
   */
  async setupRecurringJobs() {
    const queue = this.queues.SCHEDULED;
    if (!queue) return;

    // Clear existing repeatable jobs
    const existingJobs = await queue.getRepeatableJobs();
    for (const job of existingJobs) {
      await queue.removeRepeatableByKey(job.key);
    }

    // Daily CEO Standup at 9am
    await queue.add(
      JOB_TYPES.CEO_STANDUP,
      { type: JOB_TYPES.CEO_STANDUP },
      {
        repeat: { pattern: '0 9 * * *' }, // 9:00 AM daily
        jobId: 'daily-ceo-standup',
      }
    );

    // Hourly Health Check
    await queue.add(
      JOB_TYPES.HEALTH_CHECK,
      { type: JOB_TYPES.HEALTH_CHECK },
      {
        repeat: { pattern: '0 * * * *' }, // Every hour on the hour
        jobId: 'hourly-health-check',
      }
    );

    // Weekly Tech Debt Review (Monday 10am)
    await queue.add(
      JOB_TYPES.TECH_DEBT_REVIEW,
      { type: JOB_TYPES.TECH_DEBT_REVIEW },
      {
        repeat: { pattern: '0 10 * * 1' }, // Monday 10:00 AM
        jobId: 'weekly-tech-debt',
      }
    );

    // Weekly Docs Audit (Friday 2pm)
    await queue.add(
      JOB_TYPES.DOCS_AUDIT,
      { type: JOB_TYPES.DOCS_AUDIT },
      {
        repeat: { pattern: '0 14 * * 5' }, // Friday 2:00 PM
        jobId: 'weekly-docs-audit',
      }
    );

    console.log('[Scheduler] Recurring jobs configured');
  }

  /**
   * Process scheduled job
   */
  async processScheduledJob(job) {
    console.log(`[Scheduler] Processing scheduled job: ${job.name}`);

    switch (job.name) {
      case JOB_TYPES.CEO_STANDUP:
        return this.runCEOStandup();

      case JOB_TYPES.HEALTH_CHECK:
        return this.runHealthCheck();

      case JOB_TYPES.TECH_DEBT_REVIEW:
        return this.runTechDebtReview();

      case JOB_TYPES.DOCS_AUDIT:
        return this.runDocsAudit();

      default:
        console.warn(`[Scheduler] Unknown job type: ${job.name}`);
    }
  }

  /**
   * Process webhook job
   */
  async processWebhookJob(job) {
    console.log(`[Scheduler] Processing webhook job: ${job.name}`);

    switch (job.name) {
      case JOB_TYPES.GITHUB_ISSUE:
        return this.handleGitHubIssue(job.data);

      case JOB_TYPES.GITHUB_PR:
        return this.handleGitHubPR(job.data);

      case JOB_TYPES.GITHUB_DEPLOY:
        return this.handleGitHubDeploy(job.data);

      case JOB_TYPES.STRIPE_EVENT:
        return this.handleStripeEvent(job.data);

      case JOB_TYPES.MONITORING_ALERT:
        return this.handleMonitoringAlert(job.data);

      default:
        console.warn(`[Scheduler] Unknown webhook type: ${job.name}`);
    }
  }

  /**
   * Process adhoc job
   */
  async processAdhocJob(job) {
    console.log(`[Scheduler] Processing adhoc job: ${job.name}`);

    // Adhoc jobs are direct orchestrator calls
    if (job.data.idea) {
      return this.orchestrator.submitIdea({
        idea: job.data.idea,
        userId: job.data.userId || 'system',
        metadata: job.data.metadata,
      });
    }
  }

  // ==========================================
  // SCHEDULED JOB HANDLERS
  // ==========================================

  /**
   * Daily CEO Standup
   * Reviews pending items, prioritizes work, delegates to specialists
   */
  async runCEOStandup() {
    console.log('[Scheduler] Running CEO standup...');

    // Get pending runs/issues
    const pendingRuns = await prisma.agentRun.findMany({
      where: {
        status: { in: ['pending', 'awaiting_approval', 'awaiting_answer'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Get recent errors
    const recentErrors = await prisma.agentRun.findMany({
      where: {
        status: 'failed',
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      take: 5,
    });

    // Build standup agenda
    const agenda = [];

    if (pendingRuns.length > 0) {
      agenda.push(`${pendingRuns.length} pending items need attention`);
    }

    if (recentErrors.length > 0) {
      agenda.push(`${recentErrors.length} failed runs in last 24 hours`);
    }

    // If there's work to do, start CEO review
    if (agenda.length > 0) {
      return this.orchestrator.submitIdea({
        idea: `Daily Standup Review:\n\n${agenda.join('\n')}\n\nPending runs: ${JSON.stringify(pendingRuns.map(r => ({ id: r.id, idea: r.idea?.substring(0, 50) })))}\n\nReview and prioritize these items.`,
        userId: 'system-scheduler',
        metadata: { trigger: 'daily_standup' },
      });
    }

    console.log('[Scheduler] No items for standup');
    return { skipped: true, reason: 'no_pending_items' };
  }

  /**
   * Hourly Health Check
   * Monitors deployments, checks for alerts
   */
  async runHealthCheck() {
    console.log('[Scheduler] Running health check...');

    // Check for any system issues
    const issues = [];

    // Check failed runs in last hour
    const recentFails = await prisma.agentRun.count({
      where: {
        status: 'failed',
        updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentFails > 3) {
      issues.push(`High failure rate: ${recentFails} failed runs in last hour`);
    }

    // If there are issues, alert DevOps
    if (issues.length > 0) {
      return this.orchestrator.submitIdea({
        idea: `Health Check Alert:\n\n${issues.join('\n')}\n\nInvestigate and resolve these issues.`,
        userId: 'system-scheduler',
        metadata: { trigger: 'health_check', priority: 'high' },
      });
    }

    return { healthy: true };
  }

  /**
   * Weekly Tech Debt Review
   */
  async runTechDebtReview() {
    console.log('[Scheduler] Running tech debt review...');

    return this.orchestrator.submitIdea({
      idea: `Weekly Tech Debt Review:\n\nAnalyze the codebase for:\n1. Code complexity hotspots\n2. Outdated dependencies\n3. Missing test coverage\n4. Performance bottlenecks\n\nProvide a prioritized list of tech debt items to address.`,
      userId: 'system-scheduler',
      metadata: { trigger: 'weekly_tech_debt' },
    });
  }

  /**
   * Weekly Documentation Audit
   */
  async runDocsAudit() {
    console.log('[Scheduler] Running docs audit...');

    return this.orchestrator.submitIdea({
      idea: `Weekly Documentation Audit:\n\nReview documentation for:\n1. Outdated information\n2. Missing API documentation\n3. Incomplete READMEs\n4. Undocumented features\n\nProvide a list of documentation updates needed.`,
      userId: 'system-scheduler',
      metadata: { trigger: 'weekly_docs_audit' },
    });
  }

  // ==========================================
  // WEBHOOK JOB HANDLERS
  // ==========================================

  /**
   * Handle GitHub issue webhook
   */
  async handleGitHubIssue(data) {
    const { action, issue, repository } = data;

    if (action !== 'opened') {
      return { skipped: true, reason: `action_${action}` };
    }

    return this.orchestrator.submitIdea({
      idea: `New GitHub Issue: ${issue.title}\n\nRepository: ${repository.full_name}\nNumber: #${issue.number}\nAuthor: ${issue.user.login}\n\nDescription:\n${issue.body}\n\nTriage this issue: determine priority, assign to appropriate team, and provide initial response.`,
      userId: 'system-github',
      metadata: {
        trigger: 'github_issue',
        issueNumber: issue.number,
        repository: repository.full_name,
      },
    });
  }

  /**
   * Handle GitHub PR webhook
   */
  async handleGitHubPR(data) {
    const { action, pull_request, repository } = data;

    if (action !== 'opened' && action !== 'synchronize') {
      return { skipped: true, reason: `action_${action}` };
    }

    return this.orchestrator.submitIdea({
      idea: `GitHub Pull Request: ${pull_request.title}\n\nRepository: ${repository.full_name}\nNumber: #${pull_request.number}\nAuthor: ${pull_request.user.login}\nBranch: ${pull_request.head.ref} → ${pull_request.base.ref}\n\nDescription:\n${pull_request.body}\n\nReview this PR for security issues (CISO), code quality, and test coverage.`,
      userId: 'system-github',
      metadata: {
        trigger: 'github_pr',
        prNumber: pull_request.number,
        repository: repository.full_name,
      },
    });
  }

  /**
   * Handle GitHub deployment webhook
   */
  async handleGitHubDeploy(data) {
    const { deployment, deployment_status, repository } = data;

    if (deployment_status?.state !== 'success') {
      return { skipped: true, reason: `state_${deployment_status?.state}` };
    }

    return this.orchestrator.submitIdea({
      idea: `Deployment Completed: ${repository.full_name}\n\nEnvironment: ${deployment.environment}\nRef: ${deployment.ref}\n\nRun post-deployment verification checks.`,
      userId: 'system-github',
      metadata: {
        trigger: 'github_deploy',
        environment: deployment.environment,
        repository: repository.full_name,
      },
    });
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeEvent(data) {
    const { type, data: eventData } = data;

    // Only handle specific event types
    const handleTypes = [
      'payment_intent.payment_failed',
      'charge.dispute.created',
      'customer.subscription.deleted',
    ];

    if (!handleTypes.includes(type)) {
      return { skipped: true, reason: `event_type_${type}` };
    }

    return this.orchestrator.submitIdea({
      idea: `Stripe Alert: ${type}\n\nEvent Data:\n${JSON.stringify(eventData.object, null, 2)}\n\nInvestigate this payment issue and determine if customer contact is needed.`,
      userId: 'system-stripe',
      metadata: {
        trigger: 'stripe_event',
        eventType: type,
      },
    });
  }

  /**
   * Handle monitoring alert
   */
  async handleMonitoringAlert(data) {
    const { alertName, severity, message, source } = data;

    return this.orchestrator.submitIdea({
      idea: `Monitoring Alert: ${alertName}\n\nSeverity: ${severity}\nSource: ${source}\n\nMessage:\n${message}\n\nInvestigate this alert and determine appropriate action.`,
      userId: 'system-monitoring',
      metadata: {
        trigger: 'monitoring_alert',
        alertName,
        severity,
      },
    });
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Queue a webhook event
   */
  async queueWebhook(type, data) {
    if (!this.queues.WEBHOOK) {
      console.warn('[Scheduler] Redis not available, processing webhook inline');
      return this.processWebhookJob({ name: type, data });
    }

    return this.queues.WEBHOOK.add(type, data);
  }

  /**
   * Queue an adhoc trigger
   */
  async queueAdhoc(idea, userId, metadata = {}) {
    if (!this.queues.ADHOC) {
      console.warn('[Scheduler] Redis not available, processing adhoc inline');
      return this.processAdhocJob({ data: { idea, userId, metadata } });
    }

    return this.queues.ADHOC.add('adhoc_trigger', { idea, userId, metadata });
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      if (queue) {
        const counts = await queue.getJobCounts();
        stats[name] = counts;
      }
    }

    return stats;
  }

  /**
   * Get overall scheduler status
   */
  async getStatus() {
    const stats = this.isRunning ? await this.getStats() : {};

    return {
      isRunning: this.isRunning,
      queues: Object.keys(this.queues).length,
      workers: Object.keys(this.workers).length,
      stats,
    };
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(jobType, data = {}) {
    if (!this.isRunning) {
      throw new Error('Scheduler not running');
    }

    const queue = this.queues.ADHOC || this.queues.SCHEDULED;
    if (!queue) {
      throw new Error('No queue available');
    }

    return queue.add(jobType, {
      ...data,
      triggeredManually: true,
      triggeredAt: new Date().toISOString(),
    });
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    console.log('[Scheduler] Shutting down...');

    for (const worker of Object.values(this.workers)) {
      if (worker) await worker.close();
    }

    for (const queue of Object.values(this.queues)) {
      if (queue) await queue.close();
    }

    this.isRunning = false;
    console.log('[Scheduler] Shutdown complete');
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get or create the Scheduler singleton
 * @returns {AgentScheduler}
 */
export function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new AgentScheduler();
  }
  return schedulerInstance;
}

export default AgentScheduler;
