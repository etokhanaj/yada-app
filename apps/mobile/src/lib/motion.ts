/**
 * Reduce Motion (brief §5): sheets cross-fade, the action bar appears without
 * movement, jumps land instantly, nothing staggers. Every Yada animation reads
 * this and picks its cut or cross-fade when it is on.
 */

import { useAccessibility } from "../state/accessibility";

export function useReduceMotion(): boolean {
  return useAccessibility((s) => s.reduceMotion);
}
