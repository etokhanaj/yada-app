/**
 * ST-01, ST-02 (approved by John, 23 Oct 2026): while a streaming chapter waits for bytes, the play control shows the
 * system's own spinner in place of its icon, and stays a Pause. Mobbin: Suno
 * (mobbin.com/screens/03f689e1-f7ff-4098-a90a-f011a5e32119), Google TV (aaa569f3-0cfb-440f-b6dc-2df987cd91ed), Deezer
 * (bc7b5f93-d71e-4aa7-b5f1-9ecf8962453f). Drawn on the ink disc, so in paper. The mini bar and the full player use it.
 */

import { ActivityIndicator } from "react-native";

import { usePalette } from "../../design/tokens";

export function Buffering({ large = false }: { large?: boolean }) {
  const palette = usePalette();
  return <ActivityIndicator size={large ? "large" : "small"} color={palette.paper} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

/** The play control's VoiceOver label while it waits: what it is doing, then what a tap does. */
export function bufferingLabel(action: string): string {
  return `Loading. ${action}`;
}
