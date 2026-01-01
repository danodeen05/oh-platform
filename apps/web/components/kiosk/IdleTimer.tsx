'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Default idle timeout: 60 seconds
const DEFAULT_IDLE_TIMEOUT = 60000;

// Warning countdown: 10 seconds before redirect
const WARNING_COUNTDOWN = 10000;

interface IdleTimerProps {
  /** Timeout in milliseconds before showing warning (default: 60000 = 60s) */
  timeout?: number;
  /** Path to redirect to on idle (default: /kiosk) */
  redirectPath?: string;
  /** Paths that should not trigger idle timeout */
  excludePaths?: string[];
  /** Show warning modal before redirect */
  showWarning?: boolean;
  /** Callback when idle timeout is about to trigger */
  onIdle?: () => void;
  /** Query parameters to preserve on redirect (e.g., ['locationId']) */
  preserveParams?: string[];
}

/**
 * IdleTimer component for kiosk mode
 * Automatically returns to attract screen after period of inactivity
 */
export function IdleTimer({
  timeout = DEFAULT_IDLE_TIMEOUT,
  redirectPath = '/kiosk',
  excludePaths = [],
  showWarning = true,
  onIdle,
  preserveParams = ['locationId'],
}: IdleTimerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_COUNTDOWN / 1000);

  // Build redirect URL with preserved query params
  const getRedirectUrl = useCallback(() => {
    const params = new URLSearchParams();
    preserveParams.forEach(param => {
      const value = searchParams.get(param);
      if (value) {
        params.set(param, value);
      }
    });
    const queryString = params.toString();
    return queryString ? `${redirectPath}?${queryString}` : redirectPath;
  }, [redirectPath, searchParams, preserveParams]);

  // Check if current path should be excluded from idle timeout
  const isExcludedPath = useCallback(() => {
    if (!pathname) return false;

    // Always exclude the attract screen itself
    if (pathname.endsWith('/kiosk') && !pathname.includes('/kiosk/')) {
      return true;
    }

    // Check custom excluded paths
    return excludePaths.some(path => pathname.includes(path));
  }, [pathname, excludePaths]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Reset timer on activity
  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarningModal(false);
    setCountdown(WARNING_COUNTDOWN / 1000);

    // Don't set timer on excluded paths
    if (isExcludedPath()) return;

    // Set main idle timeout
    timeoutRef.current = setTimeout(() => {
      if (showWarning) {
        // Show warning modal
        setShowWarningModal(true);
        onIdle?.();

        // Start countdown
        let count = WARNING_COUNTDOWN / 1000;
        setCountdown(count);

        countdownRef.current = setInterval(() => {
          count -= 1;
          setCountdown(count);

          if (count <= 0) {
            clearAllTimers();
            router.push(getRedirectUrl());
          }
        }, 1000);
      } else {
        // Redirect immediately
        onIdle?.();
        router.push(getRedirectUrl());
      }
    }, timeout);
  }, [pathname, timeout, showWarning, isExcludedPath, clearAllTimers, router, onIdle, getRedirectUrl]);

  // Handle user activity
  useEffect(() => {
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll'];

    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetTimer();

    return () => {
      // Cleanup
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [resetTimer, clearAllTimers]);

  // Handle "I'm still here" button
  const handleStillHere = () => {
    resetTimer();
  };

  // Don't render anything if no warning to show
  if (!showWarningModal) {
    return null;
  }

  // Warning modal
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 28,
          padding: 56,
          textAlign: 'center',
          maxWidth: 480,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            fontSize: '3rem',
          }}
        >
          ⏰
        </div>

        <h2
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: 16,
          }}
        >
          Are you still there?
        </h2>

        <p
          style={{
            color: '#999999',
            fontSize: '1.25rem',
            marginBottom: 32,
          }}
        >
          Returning to start in{' '}
          <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.5rem' }}>
            {countdown}
          </span>{' '}
          seconds
        </p>

        <button
          onClick={handleStillHere}
          className="kiosk-btn kiosk-btn-primary"
          style={{
            width: '100%',
            padding: '20px 48px',
            fontSize: '1.25rem',
          }}
        >
          I'm Still Here
        </button>
      </div>
    </div>
  );
}

export default IdleTimer;
