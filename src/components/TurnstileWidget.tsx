import { useEffect, useRef, useCallback } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const TurnstileWidget = ({ onVerify, onError, onExpire }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    
    // Clean up existing widget
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch (e) {
        console.error('Error removing widget:', e);
      }
      widgetIdRef.current = null;
    }

    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      console.error('VITE_TURNSTILE_SITE_KEY not configured');
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      'error-callback': onError,
      'expired-callback': onExpire,
      theme: 'auto',
      size: 'normal',
    });
  }, [onVerify, onError, onExpire]);

  useEffect(() => {
    // Check if script is already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript && !scriptLoadedRef.current) {
      window.onTurnstileLoad = renderWidget;
      return;
    }

    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    // Set up callback before loading script
    window.onTurnstileLoad = renderWidget;

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.error('Error removing widget on cleanup:', e);
        }
      }
    };
  }, [renderWidget]);

  return <div ref={containerRef} className="flex justify-center" />;
};

export default TurnstileWidget;
