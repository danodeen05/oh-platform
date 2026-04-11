'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getRun, approveRun, rejectRun, answerQuestion } from '@/lib/agents/api';
import { agentWsClient } from '@/lib/agents/websocket';
import type { Run, RunEvent, Phase, AgentQuestion } from '@/lib/agents/types';
import { PHASE_INFO, STATUS_INFO, AGENT_INFO } from '@/lib/agents/types';
import { formatDistanceToNow } from 'date-fns';

const PHASES: Phase[] = [
  'idea_submitted',
  'ceo_review',
  'specialist_review',
  'architecture',
  'implementation',
  'code_review',
  'completed',
];

// Format phase result from details object (full data) with optional summary fallback
function formatPhaseResult(details: Record<string, unknown>, summary: string): { lines: { label?: string; value: string; type: 'heading' | 'text' | 'list-item' | 'badge' }[] } {
  const lines: { label?: string; value: string; type: 'heading' | 'text' | 'list-item' | 'badge' }[] = [];

  if (!details || Object.keys(details).length === 0) {
    // Fallback to summary if no details
    if (summary) {
      const cleanSummary = summary.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      lines.push({ value: cleanSummary, type: 'text' });
    }
    return { lines };
  }

  // Key fields to display as badges
  const badgeFields = ['decision', 'feasibility', 'complexity', 'userValue', 'priority', 'riskLevel', 'approvalStatus'];

  // Extract badges first
  for (const field of badgeFields) {
    if (details[field] && typeof details[field] === 'string') {
      lines.push({ label: field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(), value: details[field] as string, type: 'badge' });
    }
  }

  // Overview/rationale as main text
  const textFields = ['overview', 'rationale', 'recommendation', 'architectureImpact', 'estimatedEffort'];
  for (const field of textFields) {
    if (details[field] && typeof details[field] === 'string') {
      const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      lines.push({ label, value: details[field] as string, type: 'text' });
    }
  }

  // Array fields as lists
  const listFields = ['conditions', 'nextSteps', 'risks', 'recommendations', 'targetUsers', 'uxConsiderations'];
  for (const field of listFields) {
    const arr = details[field];
    if (Array.isArray(arr) && arr.length > 0) {
      const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      lines.push({ label, value: '', type: 'heading' });
      for (const item of arr.slice(0, 5)) { // Show first 5 items
        if (typeof item === 'string') {
          lines.push({ value: item, type: 'list-item' });
        }
      }
      if (arr.length > 5) {
        lines.push({ value: `...and ${arr.length - 5} more`, type: 'list-item' });
      }
    }
  }

  // Vulnerabilities (from CISO)
  if (Array.isArray(details.vulnerabilities)) {
    lines.push({ label: 'Security Issues', value: '', type: 'heading' });
    for (const vuln of (details.vulnerabilities as Array<{ severity: string; description: string }>).slice(0, 4)) {
      lines.push({ value: `[${vuln.severity}] ${vuln.description}`, type: 'list-item' });
    }
  }

  // Components (from Architect)
  if (Array.isArray(details.components)) {
    lines.push({ label: 'Components', value: '', type: 'heading' });
    for (const comp of (details.components as Array<{ name: string; purpose: string }>).slice(0, 4)) {
      lines.push({ value: `${comp.name}: ${comp.purpose}`, type: 'list-item' });
    }
    if ((details.components as unknown[]).length > 4) {
      lines.push({ value: `...and ${(details.components as unknown[]).length - 4} more components`, type: 'list-item' });
    }
  }

  // Build sequence (from Architect)
  if (Array.isArray(details.buildSequence)) {
    lines.push({ label: 'Build Sequence', value: '', type: 'heading' });
    for (const [idx, step] of (details.buildSequence as string[]).slice(0, 5).entries()) {
      lines.push({ value: `${idx + 1}. ${step}`, type: 'list-item' });
    }
    if ((details.buildSequence as unknown[]).length > 5) {
      lines.push({ value: `...and ${(details.buildSequence as unknown[]).length - 5} more steps`, type: 'list-item' });
    }
  }

  // Scope recommendation (from CPO)
  if (details.scopeRecommendation && typeof details.scopeRecommendation === 'object') {
    const scope = details.scopeRecommendation as { mustHave?: string[]; canDefer?: string[]; shouldSkip?: string[] };
    if (scope.mustHave?.length) {
      lines.push({ label: 'Must Have', value: '', type: 'heading' });
      for (const item of scope.mustHave) {
        lines.push({ value: item, type: 'list-item' });
      }
    }
    if (scope.canDefer?.length) {
      lines.push({ label: 'Can Defer', value: '', type: 'heading' });
      for (const item of scope.canDefer) {
        lines.push({ value: item, type: 'list-item' });
      }
    }
  }

  // Delegations (from CEO)
  if (details.delegations && typeof details.delegations === 'object') {
    lines.push({ label: 'Delegations', value: '', type: 'heading' });
    for (const [agent, task] of Object.entries(details.delegations as Record<string, string>)) {
      lines.push({ value: `${agent.toUpperCase()}: ${task}`, type: 'list-item' });
    }
  }

  return { lines };
}

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Action states
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Question answer state
  const [answerText, setAnswerText] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);

  const fetchRun = useCallback(async () => {
    try {
      const data = await getRun(runId);
      setRun(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch run');
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    agentWsClient.connect();

    const unsubConnect = agentWsClient.onConnect(() => setIsConnected(true));
    const unsubDisconnect = agentWsClient.onDisconnect(() => setIsConnected(false));

    const unsubEvents = agentWsClient.subscribe(runId, (event: RunEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 50));
      if (event.type === 'status_changed' || event.type === 'phase_completed' || event.type === 'question_asked') {
        fetchRun();
      }
    });

    // Polling fallback when WebSocket is unavailable (HTTPS pages)
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    let pollInterval: NodeJS.Timeout | null = null;

    if (isHttps) {
      setIsPolling(true);
      pollInterval = setInterval(() => {
        fetchRun();
      }, 3000); // Poll every 3 seconds for run detail
    }

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubEvents();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [runId, fetchRun]);

  async function handleApprove() {
    setIsApproving(true);
    try {
      const updated = await approveRun(runId, feedback || undefined);
      setRun(updated);
      setFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setIsRejecting(true);
    try {
      const updated = await rejectRun(runId, rejectReason);
      setRun(updated);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setIsRejecting(false);
    }
  }

  async function handleAnswer(question: AgentQuestion) {
    if (!answerText.trim()) return;
    setIsAnswering(true);
    try {
      const updated = await answerQuestion(runId, question.id, answerText);
      setRun(updated);
      setAnswerText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to answer question');
    } finally {
      setIsAnswering(false);
    }
  }

  function getPhaseStatus(phase: Phase): 'completed' | 'active' | 'pending' | 'rejected' {
    if (!run) return 'pending';
    const currentIndex = PHASES.indexOf(run.currentPhase);
    const phaseIndex = PHASES.indexOf(phase);
    if (run.status === 'rejected' && phase === run.currentPhase) return 'rejected';
    if (phaseIndex < currentIndex || run.currentPhase === 'completed') return 'completed';
    if (phase === run.currentPhase) return 'active';
    return 'pending';
  }

  if (isLoading) {
    return (
      <div className="container section-padding" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="container section-padding">
        <div style={{ background: 'rgba(139, 58, 58, 0.1)', border: '1px solid rgba(139, 58, 58, 0.2)', borderRadius: '2px', padding: '24px' }}>
          <h3 style={{ fontWeight: 500, marginBottom: '8px', color: '#8B3A3A' }}>Error</h3>
          <p style={{ color: '#8B3A3A', margin: 0 }}>{error || 'Run not found'}</p>
        </div>
      </div>
    );
  }

  const pendingQuestions = run.questions.filter((q) => !q.answeredAt);

  return (
    <div className="container section-padding fade-in">
      {/* Back link */}
      <Link href="/en/agents" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '0.875rem', display: 'inline-block', marginBottom: '24px' }}>
        ← Back to Runs
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <h1 style={{ margin: 0 }}>Pipeline Run</h1>
            <span style={{
              padding: '4px 12px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '2px',
              background: run.status === 'completed' ? 'rgba(74, 93, 35, 0.15)' : run.status === 'awaiting_approval' || run.status === 'awaiting_answer' ? 'rgba(199, 168, 120, 0.2)' : run.status === 'rejected' || run.status === 'failed' ? 'rgba(139, 58, 58, 0.15)' : 'rgba(124, 122, 103, 0.15)',
              color: run.status === 'completed' ? '#4A5D23' : run.status === 'awaiting_approval' || run.status === 'awaiting_answer' ? '#8B6914' : run.status === 'rejected' || run.status === 'failed' ? '#8B3A3A' : 'var(--color-text-light)',
            }}>
              {STATUS_INFO[run.status]?.label || run.status}
            </span>
          </div>
          <p style={{ maxWidth: '640px', marginBottom: '8px' }}>{run.idea}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', margin: 0 }}>
            Created {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? 'var(--color-accent)' : isPolling ? '#C7A878' : '#8B3A3A', animation: isConnected || isPolling ? 'pulse 2s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-light)' }}>{isConnected ? 'Live' : isPolling ? 'Polling' : 'Offline'}</span>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid var(--color-border)', borderRadius: '2px', padding: '32px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 400, marginBottom: '24px', letterSpacing: '0.5px' }}>Pipeline Progress</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {PHASES.filter((p) => p !== 'rejected').map((phase, index) => {
            const status = getPhaseStatus(phase);
            const isLast = index === PHASES.length - 2;
            return (
              <div key={phase} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 400,
                    background: status === 'completed' ? 'var(--color-primary)' : status === 'active' ? 'var(--color-accent)' : status === 'rejected' ? '#8B3A3A' : 'rgba(124, 122, 103, 0.15)',
                    color: status === 'pending' ? 'var(--color-text-light)' : 'white',
                    animation: status === 'active' ? 'pulse 2s ease-in-out infinite' : 'none',
                  }}>
                    {status === 'completed' ? '✓' : index + 1}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '8px', textAlign: 'center', maxWidth: '80px' }}>
                    {PHASE_INFO[phase]?.label || phase}
                  </span>
                </div>
                {!isLast && <div style={{ flex: 1, height: '1px', margin: '0 8px', marginBottom: '24px', background: status === 'completed' ? 'var(--color-primary)' : 'var(--color-border)' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval Panel */}
      {run.status === 'awaiting_approval' && (
        <div style={{ background: 'rgba(199, 168, 120, 0.1)', border: '1px solid rgba(199, 168, 120, 0.3)', borderRadius: '2px', padding: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 400, marginBottom: '8px', color: '#8B6914' }}>Awaiting Your Approval</h2>
          <p style={{ color: 'var(--color-text-light)', marginBottom: '24px' }}>
            The <strong style={{ color: 'var(--color-text)' }}>{PHASE_INFO[run.currentPhase]?.label}</strong> phase is complete and needs your approval to proceed.
          </p>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>Feedback (optional)</label>
            <input type="text" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Any notes or conditions..." style={{ width: '100%', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--color-border)', borderRadius: '2px', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={handleApprove} disabled={isApproving} className="button-primary" style={{ background: '#4A5D23', opacity: isApproving ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isApproving ? <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 1s linear infinite' }} /> : <span>✓</span>}
              <span>Approve & Continue</span>
            </button>
            <button onClick={() => setShowRejectModal(true)} className="button-secondary" style={{ borderColor: '#8B3A3A', color: '#8B3A3A' }}>Reject</button>
          </div>
        </div>
      )}

      {/* Pending Questions */}
      {pendingQuestions.length > 0 && (
        <div style={{ background: 'rgba(199, 168, 120, 0.15)', border: '1px solid rgba(199, 168, 120, 0.3)', borderRadius: '2px', padding: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 400, marginBottom: '24px', color: '#8B6914' }}>Agent Questions</h2>
          {pendingQuestions.map((question) => (
            <div key={question.id} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span>{AGENT_INFO[question.agent]?.emoji}</span>
                <span style={{ fontWeight: 500 }}>{AGENT_INFO[question.agent]?.label}</span>
              </div>
              <p style={{ marginBottom: '16px' }}>{question.question}</p>
              {question.options && question.options.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {question.options.map((option, index) => (
                    <button key={index} onClick={() => { setAnswerText(option); handleAnswer(question); }} disabled={isAnswering} className="button-secondary" style={{ textAlign: 'left', padding: '12px 16px' }}>{option}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input type="text" value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Your answer..." style={{ flex: 1, padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--color-border)', borderRadius: '2px', fontFamily: 'inherit' }} />
                  <button onClick={() => handleAnswer(question)} disabled={isAnswering || !answerText.trim()} className="button-primary" style={{ opacity: isAnswering || !answerText.trim() ? 0.5 : 1 }}>Answer</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Phase Results */}
      {run.phases.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid var(--color-border)', borderRadius: '2px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 400, padding: '24px 32px', borderBottom: '1px solid var(--color-border)', letterSpacing: '0.5px', margin: 0 }}>Phase Results</h2>
          {run.phases.map((result, index) => {
            const formatted = formatPhaseResult(result.details, result.summary);
            return (
              <div key={index} style={{ padding: '24px 32px', borderBottom: index < run.phases.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{AGENT_INFO[result.agent]?.emoji}</span>
                    <span style={{ fontWeight: 500 }}>{AGENT_INFO[result.agent]?.label}</span>
                    <span style={{ color: 'var(--color-text-light)' }}>•</span>
                    <span style={{ color: 'var(--color-text-light)' }}>{PHASE_INFO[result.phase]?.label}</span>
                  </div>
                  <span style={{
                    padding: '4px 12px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '2px',
                    background: result.status === 'success' ? 'rgba(74, 93, 35, 0.15)' : result.status === 'needs_changes' ? 'rgba(199, 168, 120, 0.2)' : 'rgba(139, 58, 58, 0.15)',
                    color: result.status === 'success' ? '#4A5D23' : result.status === 'needs_changes' ? '#8B6914' : '#8B3A3A',
                  }}>{result.status}</span>
                </div>
                {/* Badges */}
                {formatted.lines.filter(l => l.type === 'badge').length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {formatted.lines.filter(l => l.type === 'badge').map((line, i) => (
                      <span key={i} style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        borderRadius: '2px',
                        background: 'rgba(124, 122, 103, 0.1)',
                        color: 'var(--color-text)',
                      }}>
                        {line.label}: <strong>{line.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {/* Content */}
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', lineHeight: 1.6 }}>
                  {formatted.lines.filter(l => l.type !== 'badge').map((line, i) => {
                    if (line.type === 'heading') {
                      return (
                        <div key={i} style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: i > 0 ? '16px' : '0', marginBottom: '8px' }}>
                          {line.label}
                        </div>
                      );
                    }
                    if (line.type === 'text') {
                      return (
                        <div key={i} style={{ marginBottom: '12px' }}>
                          {line.label && <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{line.label}: </span>}
                          {line.value}
                        </div>
                      );
                    }
                    if (line.type === 'list-item') {
                      return (
                        <div key={i} style={{ display: 'flex', gap: '8px', marginLeft: '8px', marginBottom: '4px' }}>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span>{line.value}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {result.cost !== undefined && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '16px', opacity: 0.7, margin: '16px 0 0 0' }}>Cost: ${result.cost.toFixed(4)} • Duration: {result.duration}ms</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Feed */}
      {events.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid var(--color-border)', borderRadius: '2px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 400, padding: '24px 32px', borderBottom: '1px solid var(--color-border)', letterSpacing: '0.5px', margin: 0 }}>Live Activity</h2>
          <div style={{ maxHeight: '256px', overflowY: 'auto' }}>
            {events.map((event, index) => (
              <div key={index} style={{ padding: '12px 32px', borderBottom: index < events.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--color-text-light)' }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
                <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>•</span>
                <span style={{ fontWeight: 500 }}>{event.type}</span>
                {'phase' in event.data && event.data.phase ? (
                  <>
                    <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>•</span>
                    <span style={{ color: 'var(--color-text-light)' }}>{String(event.data.phase)}</span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(34, 34, 34, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '2px', padding: '32px', maxWidth: '448px', width: '100%', margin: '16px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 400, marginBottom: '16px' }}>Reject Run</h3>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '24px' }}>Please provide a reason for rejection.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection..." style={{ width: '100%', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--color-border)', borderRadius: '2px', fontFamily: 'inherit', marginBottom: '24px', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <button onClick={() => setShowRejectModal(false)} style={{ padding: '12px 16px', background: 'transparent', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleReject} disabled={isRejecting || !rejectReason.trim()} style={{ padding: '12px 24px', background: '#8B3A3A', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: 'inherit', opacity: isRejecting || !rejectReason.trim() ? 0.5 : 1 }}>{isRejecting ? 'Rejecting...' : 'Reject'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        input:focus, textarea:focus { outline: none; border-color: var(--color-accent); background: rgba(255, 255, 255, 0.8); }
      `}</style>
    </div>
  );
}
