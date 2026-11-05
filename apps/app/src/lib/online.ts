/**
 * Is this device on the internet?
 *
 * Optimistic while unknown: a screen must not flash "you're offline" during the
 * half-second it takes to find out, and a false offline banner is more alarming
 * than a request that fails once.
 *
 * Native asks the OS (`expo-network`); the web listens to the browser's own
 * online/offline events. Metro picks `online.web.ts` for the browser build.
 */
import { useNetworkState } from 'expo-network';

export function useIsOnline(): boolean {
  const state = useNetworkState();

  if (state.isInternetReachable === false || state.isConnected === false) {
    return false;
  }

  return true;
}
