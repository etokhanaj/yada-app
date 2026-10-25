/**
 * Ask someone (Build 12 AO-02, AO-03; approved by John 25 Oct 2026: "add [ask one specific person]… if they are not
 * on Yada you can send a text or mail"). One sheet in two steps:
 * - AO-02: the person, chosen with iOS's own contact picker (Yada sees only that one person, and never asks to read
 *   the contacts); the request in Literata; one line on what they get.
 * - AO-03: the exact message before it goes (Luma's preview, mobbin.com/screens/03d85c9c-010c-4791-a20e-d442de4adebf):
 *   the request in the asker's words and a link, so the person can pray without Yada and say they prayed with it. Send
 *   in Messages, or other ways (Mail, WhatsApp) through the share sheet.
 * The request is made in iCloud only when it is sent: a private share of one (modules/yada-pray askOne), never among
 * circles, ending after 7 days or when answered. Cancelled at the last step, it is deleted again.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, TextInput, View } from "react-native";

import { askNative, circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { Pill } from "../../components/Pill";
import { Avatar } from "../../components/pray/Avatar";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { FONTS, usePalette } from "../../design/tokens";
import { askAddress, askMessage, firstOf } from "../../lib/askSomeone";
import { ASK_MAX } from "../../lib/pray";

interface Person {
  readonly name: string;
  readonly first: string;
  readonly phones: string[];
  readonly emails: string[];
}

export default function AskSomeone() {
  const palette = usePalette();
  const [person, setPerson] = useState<Person | null>(null);
  const [text, setText] = useState("");
  const [step, setStep] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);

  const pick = () =>
    void askNative
      ?.pickPerson()
      .then((p) => (p === null ? undefined : setPerson(p)))
      .catch(() => AccessibilityInfo.announceForAccessibility("Couldn’t open your contacts. Try again."));
  // The picker first, as the frame starts from the person; closed without one, the sheet waits with Choose.
  useEffect(() => {
    void prayCloud?.accountStatus().then((s) => {
      if (s !== "available") return router.replace("/pray/icloud");
      pick();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = person === null ? "" : firstOf(person);
  const address = person === null ? null : askAddress(person);
  const preview = askMessage(text, "the link");

  const send = async (how: "text" | "other") => {
    if (circlesCloud === null || askNative === null || person === null) return;
    setBusy(true);
    let made: string | null = null;
    try {
      const { id, url } = await circlesCloud.askOne(text.trim(), person.name);
      made = id;
      const body = askMessage(text, url);
      const went =
        how === "text" && address?.kind === "text"
          ? (await askNative.sendText([address.to], body)) === "sent"
          : await askNative.shareText(body);
      if (!went) {
        // Not sent: the request is deleted again, so nothing waits for an answer that was never asked.
        await circlesCloud.leave(id, "").catch(() => undefined);
        made = null;
        return;
      }
      AccessibilityInfo.announceForAccessibility(`Asked ${first}`);
      router.back();
    } catch {
      if (made !== null) await circlesCloud.leave(made, "").catch(() => undefined);
      AccessibilityInfo.announceForAccessibility("Couldn’t ask. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "preview" && person !== null)
    return (
      <SheetScreen title={`To ${first}`} backLabel={null} footer={false} leading={<Pill small title="Back" onPress={() => setStep("write")} />} testID="ask-someone-preview">
        <View style={[styles.bubble, { backgroundColor: palette.selection }]} accessible accessibilityLabel={`${first} will get: ${preview}`}>
          <Chrome tone="ink" style={{ lineHeight: 23 }}>
            {preview}
          </Chrome>
        </View>
        <Chrome step="note" tone="muted" style={{ marginTop: 12 }}>{`Only ${first} gets the link. It ends in 7 days, or when you mark it answered.`}</Chrome>
        <View style={{ marginTop: 18, rowGap: 8 }}>
          {address?.kind === "text" ? <Pill title={busy ? "Asking…" : "Send in Messages"} primary stretch disabled={busy} onPress={() => void send("text")} testID="ask-someone-text" /> : null}
          <Pill title={address?.kind === "text" ? "Other ways to send" : busy ? "Asking…" : "Send"} primary={address?.kind !== "text"} stretch disabled={busy} onPress={() => void send("other")} testID="ask-someone-other" />
        </View>
      </SheetScreen>
    );

  return (
    <SheetScreen title="Ask someone" backLabel={null} noBack footer={false} keyboard testID="ask-someone">
      {person === null ? (
        <Pill title="Choose someone" icon="person" stretch onPress={pick} testID="ask-someone-choose" />
      ) : (
        <View style={[styles.person, { borderBottomColor: palette.divider }]}>
          <Avatar id={person.name} name={person.name} size={44} />
          <Chrome tone="ink" style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>
            {person.name}
          </Chrome>
          <Pill small title="Change" onPress={pick} testID="ask-someone-change" />
        </View>
      )}
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={ASK_MAX}
        multiline
        autoFocus={person !== null}
        placeholder="What would you like prayer for?"
        placeholderTextColor={palette.mutedInk}
        style={[styles.field, { color: palette.ink }]}
        accessibilityLabel="What you’d like prayer for"
        testID="ask-someone-field"
      />
      <Chrome step="note" tone="muted">
        {person === null ? "They get it by text." : `${first} gets it by ${address?.kind === "mail" ? "email" : "text"}. With Yada, ${first} can tell you they prayed.`}
      </Chrome>
      <View style={{ marginTop: 18 }}>
        <Pill title="Preview the message" primary stretch disabled={person === null || text.trim() === "" || address?.kind === "none"} onPress={() => setStep("preview")} testID="ask-someone-preview-go" />
      </View>
      {address?.kind === "none" ? (
        <Chrome step="note" tone="muted" style={{ marginTop: 10 }}>{`${first} has no phone number or email in your contacts.`}</Chrome>
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: "row", alignItems: "center", columnGap: 12, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  field: { fontFamily: FONTS.scripture, fontSize: 21, lineHeight: 30, minHeight: 120, marginVertical: 14, textAlignVertical: "top" },
  bubble: { borderRadius: 20, borderBottomRightRadius: 6, padding: 16 },
});
