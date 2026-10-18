/**
 * Ask for prayer (PR-10): a sheet over Pray; just the words, 280 at most, and an optional first name; Post on a bar above
 * the keyboard. A request that mentions self-harm shows a helpline first (PR-12). Signed out of iCloud, one line explains
 * and opens Settings (XT-05). Opened from a circle (CI-02), it posts to that circle only: a request lives in one place
 * (build 8 plan §I.6).
 *
 * Every state is drawn as a sheet. They were full pages inside the form sheet, whose scroll view collapsed to nothing:
 * TestFlight build 9 showed only a "‹ Pray" pill over the keyboard, and the request could not be typed (John, 18 Oct 2026).
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, InputAccessoryView, Keyboard, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";

import { type AccountStatus, circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { Pill } from "../../components/Pill";
import { SheetScreen } from "../../components/Sheet";
import { Chrome, Prose } from "../../components/Type";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { ASK_MAX, helplineFor, mentionsSelfHarm, regionName } from "../../lib/pray";

/** One bar for both fields, so Post rides on the keyboard whichever field is focused. */
const BAR = "ask-bar";

export default function Ask() {
  const { circle = "", owner = "", name: circleName = "" } = useLocalSearchParams<{ circle?: string; owner?: string; name?: string }>();
  const palette = usePalette();
  const { gutter } = useLayout();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [help, setHelp] = useState(false);
  const [helpSeen, setHelpSeen] = useState(false);
  const [posting, setPosting] = useState(false);
  useEffect(() => void prayCloud?.accountStatus().then(setStatus).catch(() => setStatus("couldNotDetermine")), []);
  // The bar rides on the on-screen keyboard; with none (a hardware keyboard, or after dismissing it) it sits in the sheet.
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const ready = text.trim() !== "" && !posting;
  const post = async () => {
    if (prayCloud === null || text.trim() === "") return;
    setPosting(true);
    try {
      if (circle !== "") {
        await circlesCloud?.ask(circle, owner, text.trim(), name.trim());
        return router.back();
      }
      await prayCloud.ask(text.trim(), name.trim());
    } catch {
      // A failed post left the sheet up with no word why (code review, 18 Oct 2026); the request stays to try again.
      return AccessibilityInfo.announceForAccessibility("Couldn’t post your request. Try again.");
    } finally {
      setPosting(false);
    }
    // The sheet closes onto Pray, and Your requests opens there with the new one in it.
    router.back();
    router.push("/today/pray/mine");
  };
  const tryPost = () => (mentionsSelfHarm(text) && !helpSeen ? setHelp(true) : void post());

  if (status !== null && status !== "available")
    return (
      <SheetScreen title="Sign in to iCloud" backLabel={null} noBack footer={false} testID="ask-signed-out">
        <Prose step="claim">Asking for prayer uses your iCloud account, so no one sees who you are and nothing is stored by Yada.</Prose>
        <View style={{ rowGap: 10, marginTop: 20 }}>
          <Pill title="Open Settings" onPress={() => void Linking.openSettings()} primary testID="ask-settings" />
          <Pill title="Not now" onPress={() => router.back()} testID="ask-not-now" />
        </View>
      </SheetScreen>
    );

  if (help) {
    // PR-12: the phone's region from its locale ("en-GB" -> GB), no extra module.
    const region = Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] ?? null;
    const line = helplineFor(region);
    const where = regionName(region);
    return (
      <SheetScreen title="Before you post" backLabel={null} noBack footer={false} testID="ask-help">
        <Prose step="claim">It sounds like you might be going through something very hard. You don’t have to face it alone.</Prose>
        <Prose step="claim" style={{ marginTop: 8 }}>
          {line.call !== null ? `${line.name} is a free, confidential helpline, open day and night, for anyone who is struggling.` : `${line.name} lists free, confidential lines where you are.`}
        </Prose>
        <View style={{ rowGap: 10, marginTop: 20 }}>
          {line.call !== null ? <Pill title={`Call ${line.name} · ${line.call}`} onPress={() => void Linking.openURL(`tel:${line.call?.replace(/\s/g, "")}`)} primary testID="ask-call" /> : null}
          <Pill
            title={line.call !== null ? `More helplines${where === null ? "" : ` in ${where}`}` : "Open Find A Helpline"}
            onPress={() => void Linking.openURL(line.url)}
            primary={line.call === null}
            testID="ask-helpline"
          />
          {/* Back to the request; Post then posts it (the helpline has been shown). */}
          <Pill
            title="Back to my request"
            onPress={() => {
              setHelpSeen(true);
              setHelp(false);
            }}
            testID="ask-back"
          />
        </View>
      </SheetScreen>
    );
  }

  const bar = (
    <View style={[styles.bar, { paddingHorizontal: gutter, borderTopColor: palette.divider }]}>
      <Chrome step="note" tone="muted" style={{ fontVariant: ["tabular-nums"] }} accessibilityLabel={`${text.length} of ${ASK_MAX} characters`}>
        {`${text.length} / ${ASK_MAX}`}
      </Chrome>
      <Pressable
        onPress={tryPost}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        style={[styles.post, { backgroundColor: ready ? palette.ink : palette.card }]}
        testID="ask-post"
      >
        <Chrome style={{ fontWeight: "600", color: ready ? palette.paper : palette.mutedInk }}>{posting ? "Posting…" : "Post"}</Chrome>
      </Pressable>
    </View>
  );

  return (
    <>
      <SheetScreen title={circle !== "" ? `Ask ${circleName}` : "Ask for prayer"} backLabel={null} noBack footer={false} keyboard testID="ask">
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={ASK_MAX}
          multiline
          autoFocus
          placeholder="What would you like prayer for?"
          placeholderTextColor={palette.mutedInk}
          inputAccessoryViewID={BAR}
          style={[styles.request, { color: palette.ink }]}
          accessibilityLabel={`Your request, up to ${ASK_MAX} characters`}
          testID="ask-text"
        />
        <View style={styles.nameRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={30}
            placeholder="First name · optional"
            placeholderTextColor={palette.mutedInk}
            inputAccessoryViewID={BAR}
            style={[styles.name, { color: palette.ink, backgroundColor: palette.card }]}
            accessibilityLabel="First name, optional"
            testID="ask-name"
          />
          {/* lib/pray.ts: a request lives seven days; renewing starts them again. */}
          <Chrome step="note" tone="muted">
            Live for 7 days
          </Chrome>
        </View>
        <Chrome step="note" tone="muted" style={{ marginTop: 10 }}>
          Leave out other people’s names and details.
        </Chrome>
        {keyboardUp ? null : <View style={{ marginTop: 24, marginHorizontal: -gutter }}>{bar}</View>}
      </SheetScreen>
      <InputAccessoryView nativeID={BAR} backgroundColor={palette.sheet}>
        {bar}
      </InputAccessoryView>
    </>
  );
}

const styles = StyleSheet.create({
  request: { fontFamily: FONTS.scripture, fontSize: 22, lineHeight: 30, minHeight: 120, paddingTop: 4, textAlignVertical: "top" },
  nameRow: { flexDirection: "row", alignItems: "center", columnGap: 12, flexWrap: "wrap", rowGap: 8, marginTop: 20 },
  name: { minHeight: 44, minWidth: 190, borderRadius: 999, paddingHorizontal: 18, fontSize: 16 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  post: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
