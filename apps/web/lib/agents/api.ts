import type { Run } from './types';

// Use local API proxy to avoid mixed content issues (HTTPS -> HTTP)
const API_URL = '/api/agents';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}

// Get all runs
export async function getRuns(limit = 50, offset = 0): Promise<{ runs: Run[]; limit: number; offset: number }> {
  return fetchApi(`/runs?limit=${limit}&offset=${offset}`);
}

// Get a single run
export async function getRun(id: string): Promise<Run> {
  return fetchApi(`/runs/${id}`);
}

// Submit a new idea
export async function submitIdea(idea: string, metadata?: Record<string, unknown>): Promise<Run> {
  return fetchApi('/ideas', {
    method: 'POST',
    body: JSON.stringify({ idea, metadata }),
  });
}

// Approve a run
export async function approveRun(id: string, feedback?: string): Promise<Run> {
  return fetchApi(`/runs/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  });
}

// Reject a run
export async function rejectRun(id: string, reason: string): Promise<Run> {
  return fetchApi(`/runs/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Answer a question
export async function answerQuestion(runId: string, questionId: string, answer: string): Promise<Run> {
  return fetchApi(`/runs/${runId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ questionId, answer }),
  });
}

// Resume a failed run
export async function resumeRun(id: string): Promise<Run> {
  return fetchApi(`/runs/${id}/resume`, {
    method: 'POST',
  });
}

// Get run events
export async function getEvents(runId: string, limit = 100): Promise<{ events: unknown[] }> {
  return fetchApi(`/runs/${runId}/events?limit=${limit}`);
}
