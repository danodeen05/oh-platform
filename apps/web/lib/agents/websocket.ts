import type { RunEvent } from './types';

// WebSocket is disabled when page is served over HTTPS (mixed content not allowed)
// Real-time updates will use polling instead
const WS_URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://162.243.3.7:3001/ws';
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

type EventHandler = (event: RunEvent) => void;
type ConnectionHandler = () => void;

class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private subscribedRuns: Set<string> = new Set();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectDelay = INITIAL_RECONNECT_DELAY;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    if (typeof window === 'undefined') {
      return; // Skip on server-side
    }

    // Skip WebSocket on HTTPS pages (mixed content not allowed)
    // The UI will fall back to polling
    if (isSecureContext()) {
      console.log('WebSocket disabled on HTTPS - using polling for updates');
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('Agent WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = INITIAL_RECONNECT_DELAY;

        // Resubscribe to runs
        for (const runId of this.subscribedRuns) {
          this.send({ type: 'subscribe', runId });
        }

        // Notify handlers
        for (const handler of this.connectionHandlers) {
          handler();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RunEvent;
          this.handleEvent(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Agent WebSocket disconnected');
        this.isConnecting = false;

        // Notify handlers
        for (const handler of this.disconnectionHandlers) {
          handler();
        }

        // Attempt to reconnect with backoff
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Suppress console spam - just log once
        if (this.reconnectAttempts === 0) {
          console.log('Agent WebSocket connection failed - will retry');
        }
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    // Stop reconnecting after max attempts
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnect attempts reached - real-time updates disabled');
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const jitter = Math.random() * 1000;
    const delay = Math.min(this.reconnectDelay + jitter, MAX_RECONNECT_DELAY);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleEvent(event: RunEvent): void {
    // Notify run-specific handlers
    const runHandlers = this.eventHandlers.get(event.runId);
    if (runHandlers) {
      for (const handler of runHandlers) {
        handler(event);
      }
    }

    // Notify global handlers
    const globalHandlers = this.eventHandlers.get('*');
    if (globalHandlers) {
      for (const handler of globalHandlers) {
        handler(event);
      }
    }
  }

  subscribe(runId: string, handler: EventHandler): () => void {
    // Add to subscribed runs
    this.subscribedRuns.add(runId);

    // Add handler
    if (!this.eventHandlers.has(runId)) {
      this.eventHandlers.set(runId, new Set());
    }
    this.eventHandlers.get(runId)!.add(handler);

    // Send subscribe message
    this.send({ type: 'subscribe', runId });

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(runId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(runId);
          this.subscribedRuns.delete(runId);
          this.send({ type: 'unsubscribe', runId });
        }
      }
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const agentWsClient = new AgentWebSocketClient();
