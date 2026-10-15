/**
 * Choose, inside Compare (CP-06): any one to three versions to set beside yours, each a row with a tick.
 * The limit is said in the subtitle; a fourth pick changes nothing, with a warning haptic right after
 * the reader's own tap and a spoken line (review §3 C2, §4). The choice is saved (settings.compareWith).
 */

import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { AccessibilityInfo } from "react-native";

import { Icon } from "../../components/Icon";
import { Row, RowNote, SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { isLicensedCode, LICENSED } from "../../data/licensed";
import { BUILT_IN } from "../../data/queries";
import { translationName, useTranslations } from "../../data/translations";
import { licensedCodes, licensedEnabled } from "../../data/useLicensedChapter";
import { COMPARE_MAX, compareSelection, toggleCompare } from "../../lib/compare";
import { formatRange } from "../../lib/chapters";
import { onPhoneOrder } from "../../lib/translations";
import { useSettings } from "../../state/settings";

export default function ChooseScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const reading = useSettings((s) => s.translation);
  const compareWith = useSettings((s) => s.compareWith);
  const setCompareWith = useSettings((s) => s.setCompareWith);
  const installed = useTranslations((s) => s.installed);
  const downloaded = new Set(installed.map((t) => t.code));
  const available = [...onPhoneOrder(BUILT_IN, installed.map((t) => t.code)), ...(licensedEnabled() ? licensedCodes() : [])].filter((c) => c !== reading);
  const chosen = compareSelection(reading, available, compareWith);
  // From Settings there is no verse: × returns to Settings, not to a Compare that was never open (IA stress test).
  const fromSettings = (params.ref ?? "") === "";
  const back = fromSettings ? null : formatRange(params.ref ?? "");

  const tap = (code: string) => {
    const next = toggleCompare(chosen, code);
    if (next.length === chosen.length && !chosen.includes(code)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      AccessibilityInfo.announceForAccessibility(`Up to ${COMPARE_MAX}. Untick one first.`);
      return;
    }
    // Unticking the last leaves the default, never an empty Compare.
    setCompareWith(next.length === 0 ? null : next);
  };

  const note = (code: string): string => {
    const name = isLicensedCode(code) ? (LICENSED.find((t) => t.code === code)?.name ?? code) : translationName(code, installed);
    if (code === "MSG") return `${name} · a paraphrase · online`;
    if (isLicensedCode(code)) return `${name} · online`;
    return downloaded.has(code) ? `${name} · downloaded` : name;
  };

  return (
    <SheetScreen title="Choose" subtitle={`Compare with up to ${COMPARE_MAX}`} backLabel={back} footer={!fromSettings} closeLabel={fromSettings ? "Back to Settings" : "Back to Compare"} testID="compare-choose-sheet">
      {available.map((code, i) => {
        const on = chosen.includes(code);
        return (
          <Row
            key={code}
            first={i === 0}
            chevron={false}
            onPress={() => tap(code)}
            label={`${code}, ${note(code)}`}
            selected={on}
            testID={`choose-${code}`}
            trailing={on ? <Icon name="check" size={18} tone="accent" /> : null}
          >
            <Chrome tone="ink" style={{ fontWeight: on ? "600" : "500" }}>
              {code}
            </Chrome>
            <RowNote>{note(code)}</RowNote>
          </Row>
        );
      })}
    </SheetScreen>
  );
}
