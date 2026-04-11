'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRuns } from '@/lib/agents/api';
import { agentWsClient } from '@/lib/agents/websocket';
import type { Run, RunEvent } from '@/lib/agents/types';
import { PHASE_INFO, STATUS_INFO } from '@/lib/agents/types';
import { formatDistanceToNow } from 'date-fns';

export default function AgentsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch runs on mount
  useEffect(() => {
    async function fetchRuns() {
      try {
        const data = await getRuns();
        setRuns(data.runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch runs');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRuns();
  }, []);

  // Set up WebSocket connection (or polling fallback for HTTPS)
  useEffect(() => {
    agentWsClient.connect();

    const unsubConnect = agentWsClient.onConnect(() => setIsConnected(true));
    const unsubDisconnect = agentWsClient.onDisconnect(() => setIsConnected(false));

    // Subscribe to all events
    const unsubEvents = agentWsClient.subscribe('*', (event: RunEvent) => {
      if (event.type === 'status_changed' || event.type === 'phase_completed') {
        // Refresh runs list
        getRuns().then((data) => setRuns(data.runs));
      }
    });

    // Polling fallback when WebSocket is unavailable (HTTPS pages)
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    let pollInterval: NodeJS.Timeout | null = null;

    if (isHttps) {
      setIsPolling(true);
      pollInterval = setInterval(() => {
        getRuns().then((data) => setRuns(data.runs)).catch(() => {});
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubEvents();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: 'rgba(139, 58, 58, 0.1)',
          border: '1px solid rgba(139, 58, 58, 0.2)',
          borderRadius: '2px',
          padding: '24px',
        }}
      >
        <h3 style={{ fontWeight: 500, marginBottom: '8px', color: '#8B3A3A' }}>Error</h3>
        <p style={{ color: '#8B3A3A', margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="container section-padding fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Agent Orchestrator</h1>
          <p style={{ color: 'var(--color-text-light)', margin: 0 }}>
            Monitor and manage your AI agent pipeline runs
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isConnected ? 'var(--color-accent)' : isPolling ? '#C7A878' : '#8B3A3A',
                animation: isConnected || isPolling ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-light)' }}>
              {isConnected ? 'Live' : isPolling ? 'Polling' : 'Offline'}
            </span>
          </div>
          <Link
            href="/en/agents/submit"
            className="button-primary"
            style={{ textDecoration: 'none' }}
          >
            Submit Idea
          </Link>
        </div>
      </div>

      {/* Runs list */}
      {runs.length === 0 ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.5)',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '64px 32px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--color-text-light)', marginBottom: '24px' }}>
            No pipeline runs yet
          </p>
          <Link
            href="/en/agents/submit"
            className="button-primary"
            style={{ textDecoration: 'none' }}
          >
            Submit Your First Idea
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '24px',
          }}
        >
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/en/agents/runs/${run.id}`}
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid var(--color-border)',
                borderRadius: '2px',
                padding: '24px',
                textDecoration: 'none',
                display: 'block',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    borderRadius: '2px',
                    background: run.status === 'completed' ? 'rgba(74, 93, 35, 0.15)'
                      : run.status === 'awaiting_approval' || run.status === 'awaiting_answer' ? 'rgba(199, 168, 120, 0.2)'
                      : run.status === 'rejected' || run.status === 'failed' ? 'rgba(139, 58, 58, 0.15)'
                      : 'rgba(124, 122, 103, 0.15)',
                    color: run.status === 'completed' ? '#4A5D23'
                      : run.status === 'awaiting_approval' || run.status === 'awaiting_answer' ? '#8B6914'
                      : run.status === 'rejected' || run.status === 'failed' ? '#8B3A3A'
                      : 'var(--color-text-light)',
                  }}
                >
                  {STATUS_INFO[run.status]?.label || run.status}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                  {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                </span>
              </div>

              <h3 style={{
                fontSize: '1rem',
                fontWeight: 400,
                marginBottom: '12px',
                lineHeight: 1.5,
                color: 'var(--color-text)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {run.idea}
              </h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-accent)' }}>
                  {PHASE_INFO[run.currentPhase]?.label || run.currentPhase}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontFamily: 'monospace' }}>
                  {run.id.slice(0, 8)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
