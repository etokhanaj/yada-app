/**
 * Shares accepted from a link (a circle's invitation, PC-34; an ask, AO-04), wherever Yada is when iOS hands them
 * over: at launch, and on the module's own event when an acceptance completes (no polling, CLAUDE.md). A circle opens
 * its welcome; an ask opens its request. It replaces the Pray tab's check, which missed a link opened on Today.
 */

import { router } from "expo-router";

import { circlesCloud } from "../../modules/yada-pray";
import { circleParams } from "../lib/pray";

async function take(): Promise<void> {
  if (circlesCloud === null) return;
  const accepted = await circlesCloud.takeAccepted().catch(() => [] as string[]);
  if (accepted.length === 0) return;
  for (const entry of accepted.filter((a) => a.startsWith("ask-"))) {
    const [id, owner] = entry.split("|");
    router.push({ pathname: "/pray/asked", params: { id: id ?? "", owner: owner ?? "" } });
  }
  const circles = accepted.filter((a) => !a.startsWith("ask-"));
  if (circles.length === 0) return;
  const all = await circlesCloud.list().catch(() => []);
  const joined = all.find((c) => circles.includes(c.id));
  if (joined !== undefined) router.push({ pathname: "/pray/joined", params: circleParams(joined) });
}

/** Once, from the root layout once data is open. Returns the unsubscribe. */
export function followAccepted(): () => void {
  if (circlesCloud === null) return () => undefined;
  void take();
  const sub = circlesCloud.addListener("onAccepted", () => void take());
  return () => sub.remove();
}
