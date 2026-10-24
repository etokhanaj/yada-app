/**
 * Add to your list, or Edit an item (PC-09, PC-11): a sheet like Ask (PR-10), the words large in Literata, one line that
 * only you see your list, and Add or Save on the bar above the keyboard. It replaced an Alert.prompt (John, 18 Oct 2026).
 */

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, InputAccessoryView, Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon } from "../../components/Icon";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { useAppData } from "../../data/AppData";
import { addToList, editListItem } from "../../data/prayLocal";
import { FONTS, useLayout, usePalette } from "../../design/tokens";
import { ASK_MAX } from "../../lib/pray";

const BAR = "add-bar";

export default function AddToList() {
  const { index, text: initial = "" } = useLocalSearchParams<{ index?: string; text?: string }>();
  const editing = index !== undefined;
  const { user } = useAppData();
  const palette = usePalette();
  const { gutter } = useLayout();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const ready = text.trim() !== "" && !saving;
  const save = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      if (editing) await editListItem(user, Number(index), text.trim());
      else await addToList(user, text.trim());
      router.back();
    } catch {
      AccessibilityInfo.announceForAccessibility("Couldn’t change your list. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const bar = (
    <View style={[styles.bar, { paddingHorizontal: gutter, borderTopColor: palette.divider }]}>
      <Chrome step="note" tone="muted" style={{ fontVariant: ["tabular-nums"] }} accessibilityLabel={`${text.length} of ${ASK_MAX} characters`}>
        {`${text.length} / ${ASK_MAX}`}
      </Chrome>
      <Pressable onPress={() => void save()} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }} style={[styles.save, { backgroundColor: ready ? palette.ink : palette.card }]} testID="add-save">
        <Chrome style={{ fontWeight: "600", color: ready ? palette.paper : palette.mutedInk }}>{editing ? "Save" : "Add"}</Chrome>
      </Pressable>
    </View>
  );

  return (
    <>
      <SheetScreen title={editing ? "Edit" : "Add to your list"} backLabel={null} noBack footer={false} keyboard testID="add">
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={ASK_MAX}
          multiline
          autoFocus
          placeholder="Who or what would you like to pray for?"
          placeholderTextColor={palette.mutedInk}
          inputAccessoryViewID={BAR}
          style={[styles.field, { color: palette.ink }]}
          accessibilityLabel="What to pray for"
          testID="add-text"
        />
        <View style={styles.lock}>
          <Icon name="lock" size={13} tone="muted" />
          <Chrome step="note" tone="muted">
            Only you see your list.
          </Chrome>
        </View>
        {keyboardUp ? null : <View style={{ marginTop: 24, marginHorizontal: -gutter }}>{bar}</View>}
      </SheetScreen>
      <InputAccessoryView nativeID={BAR} backgroundColor={palette.sheet}>
        {bar}
      </InputAccessoryView>
    </>
  );
}

const styles = StyleSheet.create({
  field: { fontFamily: FONTS.scripture, fontSize: 26, lineHeight: 34, minHeight: 120, paddingTop: 4, textAlignVertical: "top" },
  lock: { flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 12 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  save: { minHeight: 44, paddingHorizontal: 24, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
