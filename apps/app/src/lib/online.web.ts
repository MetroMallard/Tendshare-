/**
 * Is this browser on the internet? `navigator.onLine` plus the browser's own
 * events — the same signal the rest of the web uses, and one that flips back to
 * `true` by itself when the connection returns.
 */
import { useEffect, useState } from 'react';

function readOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine !== false;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(readOnline);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);

    window.addEventListener('online', up);
    window.addEventListener('offline', down);

    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
