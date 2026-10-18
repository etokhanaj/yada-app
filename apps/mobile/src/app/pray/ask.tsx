/**
 * Ask for prayer (PR-10): just the words, 280 at most, and an optional first name; Post. A request that mentions
 * self-harm shows a helpline first (PR-12). Signed out of iCloud, one line explains and opens Settings (XT-05).
 * Opened from a circle (CI-02), it posts to that circle only: a request lives in one place (build 8 plan §I.6).
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";

import { type AccountStatus, circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { PageScreen } from "../../components/Page";
import { Chrome, Prose } from "../../components/Type";
import { usePalette } from "../../design/tokens";
import { ASK_MAX, helplineFor, mentionsSelfHarm } from "../../lib/pray";

export default function Ask() {
  const { circle = "", owner = "", name: circleName = "" } = useLocalSearchParams<{ circle?: string; owner?: string; name?: string }>();
  const palette = usePalette();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [help, setHelp] = useState(false);
  const [posting, setPosting] = useState(false);
  useEffect(() => void prayCloud?.accountStatus().then(setStatus).catch(() => setStatus("couldNotDetermine")), []);

  const post = async () => {
    if (prayCloud === null || text.trim() === "") return;
    setPosting(true);
    if (circle !== "") {
      await circlesCloud?.ask(circle, owner, text.trim(), name.trim()).finally(() => setPosting(false));
      return router.back();
    }
    await prayCloud.ask(text.trim(), name.trim()).finally(() => setPosting(false));
    router.replace("/pray/mine");
  };
  const tryPost = () => (mentionsSelfHarm(text) && !help ? setHelp(true) : void post());
  const button = (title: string, onPress: () => void, primary: boolean, testID: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.button, { backgroundColor: primary ? palette.ink : palette.card }]} testID={testID}>
      <Chrome style={{ fontWeight: "600", color: primary ? palette.paper : palette.ink }}>{title}</Chrome>
    </Pressable>
  );

  if (status !== null && status !== "available")
    return (
      <PageScreen title="Sign in to iCloud" back="Pray" testID="ask-signed-out">
        <Prose step="claim">Asking for prayer uses your iCloud account, so no one sees who you are and nothing is stored by Yada.</Prose>
        <View style={{ rowGap: 10, marginTop: 20 }}>
          {button("Open Settings", () => void Linking.openSettings(), true, "ask-settings")}
          {button("Not now", () => router.back(), false, "ask-not-now")}
        </View>
      </PageScreen>
    );

  if (help) {
    // The phone's region from its locale ("en-GB" -> GB), no extra module.
    const line = helplineFor(Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] ?? null);
    return (
      <PageScreen title="You don’t have to carry this alone" back="Pray" testID="ask-help">
        <Prose step="claim">{line.call !== null ? `${line.name} is there to listen, any time: ${line.call}.` : `${line.name} lists free, confidential lines where you are.`}</Prose>
        <View style={{ rowGap: 10, marginTop: 20 }}>
          {line.call !== null ? button(`Call ${line.call}`, () => void Linking.openURL(`tel:${line.call?.replace(/\s/g, "")}`), true, "ask-call") : null}
          {button(line.call !== null ? "More lines" : "Open Find A Helpline", () => void Linking.openURL(line.url), line.call === null, "ask-helpline")}
          {button("Post my request", () => void post(), false, "ask-post-anyway")}
        </View>
      </PageScreen>
    );
  }

  return (
    <PageScreen title={circle !== "" ? `Ask ${circleName}` : "Ask for prayer"} back={circle !== "" ? circleName : "Pray"} testID="ask">
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={ASK_MAX}
        multiline
        autoFocus
        placeholder="What would you like prayer for?"
        placeholderTextColor={palette.mutedInk}
        style={[styles.input, { color: palette.ink, minHeight: 140 }]}
        accessibilityLabel="Your request, up to 280 characters"
        testID="ask-text"
      />
      <TextInput value={name} onChangeText={setName} maxLength={30} placeholder="First name (optional)" placeholderTextColor={palette.mutedInk} style={[styles.input, { color: palette.ink }]} accessibilityLabel="First name, optional" testID="ask-name" />
      <View style={styles.bar}>
        <Chrome tone="muted" step="note">
          {ASK_MAX - text.length}
        </Chrome>
        {button(posting ? "Posting…" : "Post", tryPost, true, "ask-post")}
      </View>
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 17, lineHeight: 24, paddingVertical: 10, textAlignVertical: "top" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  button: { minHeight: 50, paddingHorizontal: 24, borderRadius: 25, alignItems: "center", justifyContent: "center" },
});
