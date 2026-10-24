/**
 * Add or ask (PT-40, approved by John 24 Oct 2026): the one + on Pray. Add to your list first; then Ask for prayer, each
 * circle by name and Everyone on Yada, each saying who will see it; New circle last. Each row replaces this sheet
 * with the sheet it opens.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  type Circle,
  circlesCloud,
  prayCloud,
} from "../../../modules/yada-pray";
import { Icon, type IconName } from "../../components/Icon";
import { circleTone } from "../../components/pray/CircleCover";
import { SheetScreen } from "../../components/Sheet";
import { Chrome } from "../../components/Type";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { usePalette } from "../../design/tokens";
import { ICLOUD_WAIT_MS, peopleLine, withinTime } from "../../lib/pray";

export default function AddOrAsk() {
  const palette = usePalette();
  const [circles, setCircles] = useState<Circle[]>([]);
  useEffect(() => {
    if (circlesCloud === null) return;
    void withinTime(circlesCloud.list(), ICLOUD_WAIT_MS)
      .then(setCircles)
      .catch(() => setCircles([]));
  }, []);

  return (
    <SheetScreen
      title="Add or ask"
      backLabel={null}
      noBack
      footer={false}
      closeLabel="Close"
      testID="pray-add-or-ask"
    >
      <Option
        icon="lock"
        tone={palette.fill}
        ink
        title="Add to your list"
        line="Only you see it"
        onPress={() => router.replace("/pray/add")}
        testID="add-or-ask-list"
      />
      {prayCloud !== null ? (
        <>
          <Chrome step="note" tone="muted" style={styles.group}>
            Ask for prayer
          </Chrome>
          {circles.map((c) => (
            <Option
              key={c.id}
              icon="people"
              tone={circleTone(c.id)}
              title={c.name}
              line={peopleLine(c.people)}
              onPress={() =>
                router.replace({
                  pathname: "/pray/ask",
                  params: { circle: c.id, owner: c.owner, name: c.name },
                })
              }
              testID={`add-or-ask-circle-${c.id}`}
            />
          ))}
          <Option
            icon="globe"
            tone={BRAND.forest}
            title="Everyone on Yada"
            line="Never your name"
            onPress={() => router.replace("/pray/ask")}
            testID="add-or-ask-everyone"
          />
        </>
      ) : null}
      {circlesCloud !== null ? (
        <View style={{ marginTop: 18 }}>
          <Option
            icon="plus"
            tone={palette.fill}
            ink
            title="New circle"
            line="Up to 12 people you invite"
            onPress={() => router.replace("/pray/new-circle")}
            testID="add-or-ask-new-circle"
          />
        </View>
      ) : null}
    </SheetScreen>
  );
}

function Option({
  icon,
  tone,
  ink = false,
  title,
  line,
  onPress,
  testID,
}: {
  icon: IconName;
  tone: string;
  ink?: boolean;
  title: string;
  line: string;
  onPress: () => void;
  testID: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      style={({ pressed }) => [
        styles.option,
        pressed ? { backgroundColor: palette.fill } : null,
      ]}
      testID={testID}
    >
      <View style={[styles.mark, { backgroundColor: tone }]}>
        <Icon
          name={icon}
          size={20}
          {...(ink ? { tone: "ink" as const } : { color: ON_PICTURE.text })}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Chrome tone="ink" style={{ fontWeight: "500" }}>
          {title}
        </Chrome>
        <Chrome step="note" tone="muted">
          {line}
        </Chrome>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { fontWeight: "600", marginTop: 18, marginBottom: 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 14,
    minHeight: 56,
    paddingVertical: 8,
    borderRadius: 14,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
