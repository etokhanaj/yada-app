/**
 * Choose, inside Compare (CP-06): any one to three versions to set beside yours. The chosen come first, in
 * your order, each with a tick and a drag handle; the rest follow unticked. Compare shows them in that order
 * (lib/compare.ts compareSelection). A fourth pick changes nothing, with a warning haptic right after the
 * reader's own tap and a spoken line (review §3 C2, §4). VoiceOver moves a version with Move up and Move down,
 * since a drag is not something it can do. The choice is saved (settings.compareWith).
 */

import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { createContext, type ReactNode, useContext } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Icon } from "../../components/Icon";
import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { isLicensedCode } from "../../data/licensed";
import { BUILT_IN } from "../../data/queries";
import { useTranslations } from "../../data/translations";
import { licensedCodes, licensedEnabled, versionName } from "../../data/useLicensedChapter";
import { usePalette } from "../../design/tokens";
import { chooseOrder, COMPARE_MAX, compareSelection, moveCompare, toggleCompare } from "../../lib/compare";
import { formatRange } from "../../lib/chapters";
import { useReduceMotion } from "../../lib/motion";
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
  const rows = chooseOrder(available, chosen);
  // From Settings there is no verse: × returns to Settings, not to a Compare that was never open (IA stress test).
  const fromSettings = (params.ref ?? "") === "";
  const back = fromSettings ? null : formatRange(params.ref ?? "");

  // The drag, shared by every chosen row so the others make room as one moves (CP-06).
  const active = useSharedValue(-1);
  const target = useSharedValue(-1);
  const rowHeight = useSharedValue(56);

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

  const move = (code: string, to: number) => {
    const next = moveCompare(chosen, code, to);
    if (next.join() !== chosen.join()) setCompareWith(next);
    return next;
  };

  const note = (code: string): string => {
    const name = versionName(code, installed);
    if (code === "MSG") return `${name} · a paraphrase · online`;
    if (isLicensedCode(code)) return `${name} · online`;
    return downloaded.has(code) ? `${name} · downloaded` : name;
  };

  return (
    <SheetScreen
      title="Choose"
      subtitle={`Up to ${COMPARE_MAX}, in your order`}
      backLabel={back}
      footer={false}
      closeLabel={fromSettings ? "Back to Settings" : "Close"}
      testID="compare-choose-sheet"
    >
      <GestureHandlerRootView>
        {rows.map((code, i) => {
          const on = chosen.includes(code);
          const row = (
            <ListRow
              first={i === 0}
              chevron={false}
              chosen={on}
              onPress={() => tap(code)}
              label={`${code}, ${note(code)}${on ? `, ${i + 1} of ${chosen.length}` : ""}`}
              testID={`choose-${code}`}
              actions={on && chosen.length > 1 ? [...(i > 0 ? [{ name: "up", label: "Move up" }] : []), ...(i < chosen.length - 1 ? [{ name: "down", label: "Move down" }] : [])] : undefined}
              onAction={(name) => {
                const next = move(code, name === "up" ? i - 1 : i + 1);
                AccessibilityInfo.announceForAccessibility(`${code}, ${next.indexOf(code) + 1} of ${next.length}`);
              }}
              right={
                on ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Icon name="check" size={22} tone="accent" />
                    {chosen.length > 1 ? <DragHandle index={i} count={chosen.length} active={active} target={target} rowHeight={rowHeight} onDrop={(to) => move(code, to)} /> : null}
                  </View>
                ) : (
                  <Unticked />
                )
              }
            >
              <Chrome tone="ink" style={{ fontWeight: on ? "600" : "500" }}>
                {code}
              </Chrome>
              <Chrome step="note" tone="muted">
                {note(code)}
              </Chrome>
            </ListRow>
          );
          return on ? (
            <ChosenRow key={code} index={i} active={active} target={target} rowHeight={rowHeight}>
              {row}
            </ChosenRow>
          ) : (
            <View key={code}>{row}</View>
          );
        })}
      </GestureHandlerRootView>
    </SheetScreen>
  );
}

/** The empty ring of an unticked version (CP-06 `.ckoff`: 22 pt, a 1.5 pt muted ring). */
function Unticked() {
  const palette = usePalette();
  return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: palette.mutedInk }} />;
}

interface DragState {
  readonly active: SharedValue<number>;
  readonly target: SharedValue<number>;
  readonly rowHeight: SharedValue<number>;
}

/** A chosen row: lifts and follows the finger while dragged; its neighbours slide a row to make room. */
function ChosenRow({ index, active, target, rowHeight, children }: DragState & { index: number; children: ReactNode }) {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(0);
  const style = useAnimatedStyle(() => {
    if (active.value === index) return { transform: [{ translateY: offset.value }], zIndex: 2, backgroundColor: palette.sheet };
    const shift = active.value < 0 ? 0 : active.value < index && target.value >= index ? -rowHeight.value : active.value > index && target.value <= index ? rowHeight.value : 0;
    return { transform: [{ translateY: reduceMotion ? shift : withTiming(shift, { duration: 160 }) }], zIndex: 0 };
  });
  return (
    <DragOffset.Provider value={offset}>
      <Animated.View style={style} onLayout={(e) => (rowHeight.value = e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </DragOffset.Provider>
  );
}

/** The dragged row's offset, which its handle writes. */
const DragOffset = createContext<SharedValue<number> | null>(null);

/** The handle (CP-06 `.hdl`, 20 pt muted, 10 pt after the tick). Only it starts a drag; a tap on the row ticks. */
function DragHandle({ index, count, active, target, rowHeight, onDrop }: DragState & { index: number; count: number; onDrop: (to: number) => void }) {
  const offset = useContext(DragOffset);
  const tick = () => void Haptics.selectionAsync();
  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      active.value = index;
      target.value = index;
      runOnJS(tick)();
    })
    .onUpdate((e) => {
      "worklet";
      if (offset === null || !Number.isFinite(e.translationY)) return;
      offset.value = e.translationY;
      target.value = Math.max(0, Math.min(count - 1, index + Math.round(e.translationY / rowHeight.value)));
    })
    .onFinalize(() => {
      "worklet";
      const to = target.value;
      if (offset !== null) offset.value = 0;
      active.value = -1;
      target.value = -1;
      if (to >= 0 && to !== index) runOnJS(onDrop)(to);
    });
  return (
    <GestureDetector gesture={pan}>
      {/* 44 pt target around the 20 pt glyph. Hidden from VoiceOver: the row's Move up / Move down do this.
          It takes the touch itself, so a tap on the handle never unticks the row under it. */}
      <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }} onStartShouldSetResponder={() => true} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`choose-drag-${index}`}>
        <Icon name="drag" size={20} tone="muted" />
      </View>
    </GestureDetector>
  );
}
