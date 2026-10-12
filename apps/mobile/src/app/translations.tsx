/**
 * Translations (canvas MT-02–05; brief §8.20; docs/more-translations-plan.md),
 * opened from Contents' Translation row. Three groups:
 *
 *   On your iPhone  the built-in four, then downloads; the current one is
 *                   tick + semibold. A download has `⋯` (Remove, native menu).
 *   Download        name; `1898 · 3.3 MB download · 7.2 MB on iPhone`; a download glyph. Downloading, a
 *                   progress ring with a stop square and `0.6 of 1.3 MB`; tap
 *                   cancels. Offline, the glyphs go and one line says so; rows
 *                   are never dimmed, which would fail contrast (MT-05).
 *   Online          API.Bible versions, behind a dev flag (data/online.ts).
 *
 * `Choose` in the header picks which three versions Compare shows beside the
 * reader's own (plan, "Compare cap").
 *
 * Pattern from John's YouVersion "My versions" screenshot (cover, name, one
 * trailing action), with Skillshare and Glow on Mobbin for the download states
 * (plan). Each row is one VoiceOver element; covers are hidden from it.
 */

import { MenuView } from "@react-native-menu/menu";
import { type ReactNode, useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";

import { Icon } from "../components/Icon";
import { useSheetNav } from "../components/navigation";
import { Section, SheetScreen } from "../components/Sheet";
import { TranslationCover } from "../components/TranslationCover";
import { Chrome, Prose } from "../components/Type";
import { useAppData } from "../data/AppData";
import { ONLINE_PLACEHOLDERS, SHOW_ONLINE_TRANSLATIONS, useOnlineProvider } from "../data/online";
import { BUILT_IN } from "../data/queries";
import {
  cancelDownload,
  downloadTranslation,
  MANIFEST_URL,
  refreshCatalogue,
  removeTranslation,
  translationName,
  useTranslations,
} from "../data/translations";
import { useIsDark, useLayout, usePalette } from "../design/tokens";
import { comparingLabel, compareSelection, COMPARE_MAX, toggleCompare } from "../lib/compare";
import { useReduceMotion } from "../lib/motion";
import { percent, progressLine } from "../lib/progress";
import { coverTone, downloadedLine, downloadLine, onPhoneOrder, rowLabel, UPDATE_LINE } from "../lib/translations";
import { useSettings } from "../state/settings";

export default function TranslationsScreen() {
  const { core, user } = useAppData();
  const { backToReading } = useSheetNav();
  const translation = useSettings((s) => s.translation);
  const setTranslation = useSettings((s) => s.setTranslation);
  const compareWith = useSettings((s) => s.compareWith);
  const setCompareWith = useSettings((s) => s.setCompareWith);
  const installed = useTranslations((s) => s.installed);
  const catalogue = useTranslations((s) => s.catalogue);
  const online = useTranslations((s) => s.online);
  const downloading = useTranslations((s) => s.downloading);
  const failed = useTranslations((s) => s.failed);
  const needsUpdate = useTranslations((s) => s.needsUpdate);
  const provider = useOnlineProvider((s) => s.provider);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    void refreshCatalogue(user);
  }, [user]);

  const onPhone = onPhoneOrder(BUILT_IN, installed.map((t) => t.code));
  const comparing = compareSelection(translation, onPhone, compareWith);
  // Unknown until the first fetch answers: offer downloads, and a failure says why.
  const connected = online !== false;
  const offered = catalogue.filter((e) => !onPhone.includes(e.code));

  const pick = (code: string) => {
    setTranslation(code);
    // Picking is the way out, as in Contents: back to the page, now in this version.
    backToReading();
  };

  const choose = (code: string) => {
    const next = toggleCompare(comparing, code);
    if (next.length === comparing.length && !comparing.includes(code)) {
      AccessibilityInfo.announceForAccessibility(`Compare shows up to ${COMPARE_MAX}`);
      return;
    }
    setCompareWith(next.length === 0 ? null : next);
  };

  const chooseControl = (
    <Pressable
      onPress={() => setChoosing((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={choosing ? "Done" : "Choose"}
      accessibilityHint={choosing ? undefined : "Choose which translations Compare shows"}
      accessibilityValue={{ text: comparingLabel(comparing) }}
      testID="translations-choose"
      style={({ pressed }) => [styles.textControl, pressed ? { opacity: 0.6 } : null]}
    >
      <Chrome tone="accent" style={{ fontWeight: "600" }}>
        {choosing ? "Done" : "Choose"}
      </Chrome>
    </Pressable>
  );

  const onPhoneRows = onPhone.map((code, i) => {
    const download = installed.find((t) => t.code === code);
    const name = translationName(code, installed);
    const current = code === translation;
    if (choosing) {
      const on = comparing.includes(code);
      return (
        <TranslationRow
          key={code}
          first={i === 0}
          code={code}
          tone={download?.cover ?? coverTone(code)}
          name={name}
          line={current ? "Your translation" : undefined}
          strong={on}
          right={on ? <Icon name="check" size={22} tone="accent" /> : null}
          onPress={current ? undefined : () => choose(code)}
          label={current ? `${name}, your translation` : name}
          checked={current ? undefined : on}
          testID={`compare-choose-${code}`}
        />
      );
    }
    return (
      <TranslationRow
        key={code}
        first={i === 0}
        code={code}
        tone={download?.cover ?? coverTone(code)}
        name={name}
        line={download === undefined ? undefined : downloadedLine(download.bytes)}
        strong={current}
        right={current ? <Icon name="check" size={22} tone="accent" /> : null}
        menu={download !== undefined ? <RemoveMenu code={code} onRemove={() => void removeTranslation(user, code)} /> : undefined}
        onPress={() => pick(code)}
        label={download === undefined ? rowLabel.builtIn(name, current) : rowLabel.downloaded(name, download.bytes, current)}
        selected={current}
        actions={download === undefined ? undefined : [{ name: "remove", label: "Remove" }]}
        onAction={() => void removeTranslation(user, code)}
        testID={`translation-${code}`}
      />
    );
  });

  if (choosing) {
    return (
      <SheetScreen title="Translations" subtitle={`Compare with up to ${COMPARE_MAX}`} backLabel={null} footer={false} leading={chooseControl} testID="translations">
        <Section title="On your iPhone" first>
          {onPhoneRows}
        </Section>
      </SheetScreen>
    );
  }

  const onlineRows = provider?.translations ?? ONLINE_PLACEHOLDERS;

  return (
    <SheetScreen title="Translations" backLabel={null} footer={false} leading={chooseControl} testID="translations">
      <Section title="On your iPhone" first>
        {onPhoneRows}
      </Section>

      {/* A binary built without a manifest URL has nothing to download: "Downloads need a
          connection" would be untrue when online (gate review, 11 Oct 2026). */}
      {MANIFEST_URL !== "" && (offered.length > 0 || !connected || needsUpdate) ? (
        <Section title="Download" hint={connected ? undefined : "Downloads need a connection."}>
          {offered.map((entry, i) => {
            const progress = downloading[entry.code];
            if (progress !== undefined) {
              const pct = percent(progress.written, progress.total);
              return (
                <TranslationRow
                  key={entry.code}
                  first={i === 0}
                  code={entry.code}
                  tone={entry.cover}
                  name={entry.name}
                  line={progressLine(progress.written, progress.total)}
                  right={<ProgressRing pct={pct} />}
                  onPress={() => cancelDownload(entry.code)}
                  label={rowLabel.downloading(entry.name, pct)}
                  hint="Cancels the download"
                  testID={`download-${entry.code}`}
                />
              );
            }
            return (
              <TranslationRow
                key={entry.code}
                first={i === 0}
                code={entry.code}
                tone={entry.cover}
                name={entry.name}
                line={failed[entry.code] === true && connected ? "Couldn't download. Tap to try again." : downloadLine(entry)}
                right={connected ? <Icon name="download" size={22} tone="accent" /> : null}
                onPress={connected ? () => void downloadTranslation(core, user, entry) : undefined}
                label={rowLabel.download(entry, connected)}
                testID={`download-${entry.code}`}
              />
            );
          })}
          {needsUpdate ? (
            // Below the rows, in the same muted note as the section's own hint: a version this
            // build cannot read is named nowhere else, so it must not vanish without a word.
            <Prose step="note" tone="muted" style={{ marginTop: offered.length > 0 ? 8 : 0 }} testID="translations-update">
              {UPDATE_LINE}
            </Prose>
          ) : null}
        </Section>
      ) : null}

      {SHOW_ONLINE_TRANSLATIONS || provider !== null ? (
        <Section title="Online" hint="Needs a connection.">
          {onlineRows.map((t, i) => (
            <TranslationRow
              key={t.code}
              first={i === 0}
              code={t.code}
              tone={t.cover}
              name={t.name}
              line={t.publisher}
              right={null}
              onPress={
                provider === null
                  ? undefined
                  : () => {
                      provider.choose(t.code);
                      backToReading();
                    }
              }
              label={rowLabel.online(t.name, t.publisher)}
              testID={`online-${t.code}`}
            />
          ))}
        </Section>
      ) : null}
    </SheetScreen>
  );
}

/**
 * One version: cover, name in Literata, at most one muted line, one trailing
 * mark or action; 72 pt tall (canvas `.trrow`). The whole row is the target
 * and one VoiceOver element.
 */
function TranslationRow({
  code,
  tone,
  name,
  line,
  strong = false,
  right,
  onPress,
  first,
  label,
  hint,
  selected,
  checked,
  actions,
  onAction,
  menu,
  testID,
}: {
  code: string;
  tone: ReturnType<typeof coverTone>;
  name: string;
  line?: string;
  strong?: boolean;
  right: ReactNode;
  onPress?: () => void;
  first: boolean;
  label: string;
  hint?: string;
  selected?: boolean;
  checked?: boolean;
  actions?: Array<{ name: string; label: string }>;
  onAction?: (name: string) => void;
  /**
   * A native menu beside the row, not inside it: inside the Pressable the row took the
   * touch and a tap on ⋯ chose the version instead of opening Remove (10 Oct 2026).
   */
  menu?: ReactNode;
  testID?: string;
}) {
  const palette = usePalette();
  const { ax } = useLayout();
  const row = (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      unstable_pressDelay={60}
      accessible
      accessibilityRole={onPress === undefined ? "text" : "button"}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected !== undefined || checked !== undefined ? { selected, checked } : undefined}
      accessibilityActions={actions}
      onAccessibilityAction={(e) => onAction?.(e.nativeEvent.actionName)}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        first || menu !== undefined ? null : { boxShadow: `0 -1px 0 ${palette.divider}` },
        pressed ? { backgroundColor: palette.fill } : null,
      ]}
    >
      <TranslationCover code={code} tone={tone} ax={ax} />
      <View style={styles.text}>
        <Chrome
          tone="ink"
          // 20 pt, reaching 44 at AX5 (canvas --lrow), as book names are.
          style={{ fontFamily: "Literata", fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: strong ? "600" : "400" }}
          maxFontSizeMultiplier={2.2}
        >
          {name}
        </Chrome>
        {line !== undefined ? (
          <Chrome step="note" tone="muted">
            {line}
          </Chrome>
        ) : null}
      </View>
      {right !== null ? <View style={styles.right}>{right}</View> : null}
    </Pressable>
  );
  if (menu === undefined) return row;
  return (
    <View style={[styles.withMenu, first ? null : { boxShadow: `0 -1px 0 ${palette.divider}` }]}>
      <View style={{ flex: 1 }}>{row}</View>
      {/* VoiceOver reaches Remove as the row's custom action, so the menu itself is hidden. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {menu}
      </View>
    </View>
  );
}

/** `⋯` → Remove, a native menu (MT-04). VoiceOver reaches Remove as the row's custom action. */
function RemoveMenu({ code, onRemove }: { code: string; onRemove: () => void }) {
  // iOS systemRed, as a destructive item draws its title; without it the icon is transparent (index.tsx).
  const red = useIsDark() ? "#FF453A" : "#FF3B30";
  return (
    <MenuView
      shouldOpenOnLongPress={false}
      actions={[{ id: "remove", title: "Remove", image: "trash", imageColor: red, attributes: { destructive: true } }]}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "remove") onRemove();
      }}
      testID={`translation-more-${code}`}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.action}>
        <Icon name="more" size={22} tone="accent" />
      </View>
    </MenuView>
  );
}

/** A ring filling clockwise around a stop square (MT-03); a plain percentage under Reduce Motion. */
function ProgressRing({ pct }: { pct: number }) {
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  if (reduceMotion) {
    return (
      <View style={styles.action}>
        <Text style={{ color: palette.accent, fontWeight: "600", fontVariant: ["tabular-nums"] }} maxFontSizeMultiplier={1.6}>
          {pct}%
        </Text>
      </View>
    );
  }
  const r = 15;
  const length = 2 * Math.PI * r;
  return (
    <View style={styles.action}>
      <Svg width={30} height={30} viewBox="0 0 36 36">
        <Circle cx={18} cy={18} r={r} fill="none" stroke={palette.divider} strokeWidth={3} />
        <Circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke={palette.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * length} ${length}`}
          transform="rotate(-90 18 18)"
        />
        <Rect x={13} y={13} width={10} height={10} rx={2} fill={palette.accent} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 16,
    minHeight: 72,
    paddingVertical: 8,
  },
  text: {
    flex: 1,
    minWidth: 0,
    rowGap: 2,
  },
  withMenu: {
    flexDirection: "row",
    alignItems: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  action: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textControl: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
});
