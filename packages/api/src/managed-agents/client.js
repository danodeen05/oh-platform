/**
 * Claude Managed Agents Client
 *
 * Provides a wrapper around the Claude Managed Agents API for:
 * - Agent definition and management
 * - Environment configuration
 * - Session lifecycle (create, steer, interrupt)
 * - SSE event streaming
 *
 * @see https://platform.claude.com/docs/en/managed-agents/overview
 */

const API_BASE = 'https://api.anthropic.com/v1';
const BETA_HEADER = 'managed-agents-2026-04-01';

/**
 * Claude Managed Agents API Client
 */
export class ManagedAgentsClient {
  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for Managed Agents');
    }
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': BETA_HEADER,
    };
  }

  /**
   * Make an API request to Claude Managed Agents
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} body - Request body
   * @returns {Promise<Object>}
   */
  async request(method, path, body = null) {
    const url = `${API_BASE}${path}`;
    const options = {
      method,
      headers: this.headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new ManagedAgentsError(
        error.error?.message || error.message || 'API request failed',
        response.status,
        error
      );
    }

    return response.json();
  }

  // ==========================================
  // AGENTS
  // ==========================================

  /**
   * Create a new agent definition
   * @param {Object} config - Agent configuration
   * @returns {Promise<Object>} - Created agent
   */
  async createAgent(config) {
    return this.request('POST', '/agents', config);
  }

  /**
   * Get an agent by ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>}
   */
  async getAgent(agentId) {
    return this.request('GET', `/agents/${agentId}`);
  }

  /**
   * List all agents
   * @param {Object} options - List options
   * @returns {Promise<Object>}
   */
  async listAgents(options = {}) {
    const params = new URLSearchParams(options).toString();
    return this.request('GET', `/agents${params ? '?' + params : ''}`);
  }

  /**
   * Delete an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async deleteAgent(agentId) {
    return this.request('DELETE', `/agents/${agentId}`);
  }

  // ==========================================
  // ENVIRONMENTS
  // ==========================================

  /**
   * Create a new environment
   * @param {Object} config - Environment configuration
   * @returns {Promise<Object>}
   */
  async createEnvironment(config) {
    return this.request('POST', '/environments', config);
  }

  /**
   * Get an environment by ID
   * @param {string} envId - Environment ID
   * @returns {Promise<Object>}
   */
  async getEnvironment(envId) {
    return this.request('GET', `/environments/${envId}`);
  }

  /**
   * List all environments
   * @returns {Promise<Object>}
   */
  async listEnvironments() {
    return this.request('GET', '/environments');
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  /**
   * Create a new session
   * @param {Object} config - Session configuration
   * @returns {Promise<Object>}
   */
  async createSession(config) {
    return this.request('POST', '/sessions', config);
  }

  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getSession(sessionId) {
    return this.request('GET', `/sessions/${sessionId}`);
  }

  /**
   * Send an event to a session (user message, tool result, etc.)
   * @param {string} sessionId - Session ID
   * @param {Object} event - Event to send
   * @returns {Promise<Object>}
   */
  async sendEvent(sessionId, event) {
    return this.request('POST', `/sessions/${sessionId}/events`, event);
  }

  /**
   * Interrupt a running session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async interruptSession(sessionId) {
    return this.request('POST', `/sessions/${sessionId}/interrupt`);
  }

  /**
   * Stream events from a session using SSE
   * @param {string} sessionId - Session ID
   * @param {Function} onEvent - Callback for each event
   * @param {Function} onError - Callback for errors
   * @returns {Promise<void>}
   */
  async streamSession(sessionId, onEvent, onError = console.error) {
    const url = `${API_BASE}/sessions/${sessionId}/stream`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...this.headers,
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const event = JSON.parse(data);
              onEvent(event);
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        }
      }
    } catch (error) {
      onError(error);
    }
  }

  /**
   * Get session history
   * @param {string} sessionId - Session ID
   * @param {Object} options - Options (limit, before, after)
   * @returns {Promise<Object>}
   */
  async getSessionHistory(sessionId, options = {}) {
    const params = new URLSearchParams(options).toString();
    return this.request('GET', `/sessions/${sessionId}/history${params ? '?' + params : ''}`);
  }

  /**
   * List all sessions
   * @param {Object} options - List options
   * @returns {Promise<Object>}
   */
  async listSessions(options = {}) {
    const params = new URLSearchParams(options).toString();
    return this.request('GET', `/sessions${params ? '?' + params : ''}`);
  }
}

/**
 * Custom error class for Managed Agents API errors
 */
export class ManagedAgentsError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.name = 'ManagedAgentsError';
    this.status = status;
    this.details = details;
  }
}

// Singleton instance
let clientInstance = null;

/**
 * Get or create the Managed Agents client singleton
 * @returns {ManagedAgentsClient}
 */
export function getManagedAgentsClient() {
  if (!clientInstance) {
    clientInstance = new ManagedAgentsClient();
  }
  return clientInstance;
}

export default ManagedAgentsClient;
