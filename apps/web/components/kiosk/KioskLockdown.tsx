'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Default timeout before redirecting when fullscreen is lost (45 seconds)
const DEFAULT_FULLSCREEN_TIMEOUT = 45000;
// Show countdown for the last N seconds
const VISIBLE_COUNTDOWN_SECONDS = 15;

interface KioskLockdownProps {
  /** Enable fullscreen auto-recovery when accidentally exited */
  autoRecoverFullscreen?: boolean;
  /** Show a subtle indicator when fullscreen is lost */
  showFullscreenPrompt?: boolean;
  /** Callback when someone tries to exit (for logging/analytics) */
  onExitAttempt?: () => void;
  /** Timeout in ms before auto-redirect when fullscreen is lost (default: 45000) */
  fullscreenLostTimeout?: number;
  /** Path to redirect to when abandoned (default: /en/kiosk) */
  redirectPath?: string;
  /** Query parameters to preserve on redirect (default: ['locationId']) */
  preserveParams?: string[];
}

/**
 * KioskLockdown - Prevents accidental exit from kiosk mode
 *
 * Protections:
 * - Blocks pull-to-refresh (swipe down)
 * - Blocks edge swipe navigation (back/forward)
 * - Prevents keyboard shortcuts (Escape, F11, Alt+Tab, etc.)
 * - Blocks context menu (right-click / long-press)
 * - Auto-recovers fullscreen when accidentally exited
 * - Prevents pinch-to-zoom
 *
 * Staff can still exit via triple-tap + PIN (handled in layout.tsx)
 */
export function KioskLockdown({
  autoRecoverFullscreen = true,
  showFullscreenPrompt = true,
  onExitAttempt,
  fullscreenLostTimeout = DEFAULT_FULLSCREEN_TIMEOUT,
  redirectPath = '/en/kiosk',
  preserveParams = ['locationId'],
}: KioskLockdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const lastTouchY = useRef<number>(0);
  const lastTouchX = useRef<number>(0);
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Clear all countdown timers
  const clearCountdownTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Start the countdown when fullscreen is lost
  const startCountdown = useCallback(() => {
    clearCountdownTimers();

    const totalSeconds = Math.floor(fullscreenLostTimeout / 1000);
    let secondsRemaining = totalSeconds;

    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      secondsRemaining -= 1;

      // Only show countdown when we're in the visible window
      if (secondsRemaining <= VISIBLE_COUNTDOWN_SECONDS) {
        setCountdown(secondsRemaining);
      }

      if (secondsRemaining <= 0) {
        clearCountdownTimers();
        router.push(getRedirectUrl());
      }
    }, 1000);
  }, [fullscreenLostTimeout, clearCountdownTimers, router, getRedirectUrl]);

  // Check if we're in fullscreen
  const checkFullscreen = useCallback(() => {
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    setIsFullscreen(isFs);
    return isFs;
  }, []);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      setShowPrompt(false);
      clearCountdownTimers();
    } catch (e) {
      console.warn('Could not enter fullscreen:', e);
    }
  }, [clearCountdownTimers]);

  // Handle touch start - record initial position
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchY.current = e.touches[0].clientY;
      lastTouchX.current = e.touches[0].clientX;
    }
  }, []);

  // Handle touch move - prevent problematic gestures
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) {
      // Prevent pinch-to-zoom
      e.preventDefault();
      return;
    }

    const touch = e.touches[0];
    const deltaY = touch.clientY - lastTouchY.current;
    const deltaX = touch.clientX - lastTouchX.current;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Block pull-to-refresh (swipe down from top when already at top)
    if (lastTouchY.current < 50 && deltaY > 0 && window.scrollY === 0) {
      e.preventDefault();
      onExitAttempt?.();
      return;
    }

    // Block edge swipe navigation (swipe from left/right edges)
    const edgeThreshold = 30;
    if (lastTouchX.current < edgeThreshold && deltaX > 30) {
      // Swiping right from left edge (back gesture)
      e.preventDefault();
      onExitAttempt?.();
      return;
    }
    if (lastTouchX.current > screenWidth - edgeThreshold && deltaX < -30) {
      // Swiping left from right edge (forward gesture)
      e.preventDefault();
      onExitAttempt?.();
      return;
    }

    // Block swipe up from bottom (could trigger app switcher on some devices)
    if (lastTouchY.current > screenHeight - 50 && deltaY < -30) {
      e.preventDefault();
      onExitAttempt?.();
      return;
    }
  }, [onExitAttempt]);

  // Block problematic keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Block Escape (exits fullscreen)
    if (e.key === 'Escape') {
      e.preventDefault();
      onExitAttempt?.();
      return;
    }

    // Block F11 (toggles fullscreen)
    if (e.key === 'F11') {
      e.preventDefault();
      return;
    }

    // Block Alt+Tab, Alt+F4, Ctrl+W, etc.
    if (e.altKey || (e.ctrlKey && ['w', 'W', 'n', 'N', 't', 'T'].includes(e.key))) {
      e.preventDefault();
      return;
    }

    // Block Cmd+Q (Mac quit), Cmd+W (close tab)
    if (e.metaKey && ['q', 'Q', 'w', 'W'].includes(e.key)) {
      e.preventDefault();
      return;
    }
  }, [onExitAttempt]);

  // Block context menu
  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  // Handle fullscreen change
  const handleFullscreenChange = useCallback(() => {
    const isFs = checkFullscreen();

    if (!isFs && autoRecoverFullscreen) {
      onExitAttempt?.();

      // Show prompt and start countdown
      if (showFullscreenPrompt) {
        setShowPrompt(true);
        startCountdown();
      }
    } else if (isFs) {
      // Fullscreen restored - clear everything
      setShowPrompt(false);
      clearCountdownTimers();

      // Clear any existing prompt timeout
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
        promptTimeoutRef.current = null;
      }
    }
  }, [autoRecoverFullscreen, checkFullscreen, onExitAttempt, showFullscreenPrompt, startCountdown, clearCountdownTimers]);

  // Handle visibility change (tab switch, etc.)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      // Check if we lost fullscreen while away
      setTimeout(() => {
        if (!checkFullscreen() && autoRecoverFullscreen && showFullscreenPrompt) {
          setShowPrompt(true);
          // Start countdown if not already running
          if (!countdownIntervalRef.current) {
            startCountdown();
          }
        }
      }, 100);
    }
  }, [autoRecoverFullscreen, checkFullscreen, showFullscreenPrompt, startCountdown]);

  // Prevent beforeunload
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
    onExitAttempt?.();
    return '';
  }, [onExitAttempt]);

  useEffect(() => {
    // Initial fullscreen check
    checkFullscreen();

    // Add CSS lockdown styles to document
    const style = document.createElement('style');
    style.id = 'kiosk-lockdown-styles';
    style.textContent = `
      /* Prevent overscroll/pull-to-refresh */
      html, body {
        overscroll-behavior: none !important;
        overscroll-behavior-y: none !important;
        overscroll-behavior-x: none !important;
        touch-action: pan-x pan-y !important;
        -webkit-overflow-scrolling: auto !important;
      }

      /* Prevent zoom */
      html {
        touch-action: manipulation !important;
      }

      /* Prevent text selection globally in kiosk */
      body {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }

      /* Hide scrollbars but allow scrolling */
      ::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      const styleEl = document.getElementById('kiosk-lockdown-styles');
      if (styleEl) styleEl.remove();

      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
      }
      clearCountdownTimers();
    };
  }, [
    checkFullscreen,
    handleTouchStart,
    handleTouchMove,
    handleKeyDown,
    handleContextMenu,
    handleFullscreenChange,
    handleVisibilityChange,
    handleBeforeUnload,
    clearCountdownTimers,
  ]);

  // Fullscreen recovery prompt
  if (showPrompt && !isFullscreen) {
    const showCountdown = countdown !== null && countdown <= VISIBLE_COUNTDOWN_SECONDS;

    return (
      <div
        onClick={requestFullscreen}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          cursor: 'pointer',
          color: 'white',
          textAlign: 'center',
          padding: 48,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 24,
            background: showCountdown ? 'rgba(245, 158, 11, 0.2)' : 'rgba(124, 122, 103, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            transition: 'background 0.3s ease',
          }}
        >
          {showCountdown ? (
            // Show countdown number
            <span style={{ fontSize: '3rem', fontWeight: 700, color: '#f59e0b' }}>
              {countdown}
            </span>
          ) : (
            // Fullscreen icon
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </div>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 16 }}>
          {showCountdown ? 'Are you still there?' : 'Tap to Resume Kiosk Mode'}
        </h2>
        <p style={{ fontSize: '1.25rem', color: '#999', maxWidth: 400 }}>
          {showCountdown
            ? 'Tap anywhere to continue, or we\'ll return to the start screen.'
            : 'Fullscreen mode was interrupted. Tap anywhere to continue ordering.'}
        </p>
      </div>
    );
  }

  return null;
}

export default KioskLockdown;
