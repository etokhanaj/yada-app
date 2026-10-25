/**
 * Add or ask (Build 12 AO-01, approved by John 25 Oct 2026; PT-40 before it): the one + on Pray. One list, each a row
 * with its picture: Add to your list (only you), Ask someone (one person, by text or in Yada), Ask each circle by
 * name, Ask everyone on Yada, then New circle. Each row replaces this sheet with the one it opens. The sheet is as
 * tall as its rows.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { type Circle, circlesCloud, prayCloud } from "../../../modules/yada-pray";
import { Icon, type IconName } from "../../components/Icon";
import { ListRow } from "../../components/Page";
import { SheetScreen } from "../../components/Sheet";
import { BRAND, ON_PICTURE } from "../../design/palette";
import { useLayout, usePalette } from "../../design/tokens";
import { CIRCLE_MAX, ICLOUD_WAIT_MS, peopleLine, withinTime } from "../../lib/pray";

export default function AddOrAsk() {
  const fitSheet = !useLayout().ax;
  const palette = usePalette();
  const [circles, setCircles] = useState<Circle[]>([]);
  useEffect(() => {
    if (circlesCloud === null) return;
    void withinTime(circlesCloud.list(), ICLOUD_WAIT_MS)
      .then(setCircles)
      .catch(() => setCircles([]));
  }, []);

  const go = (to: Parameters<typeof router.replace>[0]) => () => router.replace(to);
  const thumb = (icon: IconName, ground: string, white = false) => (
    <View style={[styles.mark, { backgroundColor: ground }]}>
      <Icon name={icon} size={20} {...(white ? { color: ON_PICTURE.text } : { tone: "ink" as const })} />
    </View>
  );
  return (
    <SheetScreen fit={fitSheet} title="Add or ask" backLabel={null} noBack footer={false} closeLabel="Close" testID="pray-add-or-ask">
      <ListRow first leading={thumb("lock", palette.fill)} title="Add to your list" subtitle="Only you see it" onPress={go("/pray/add")} testID="add-or-ask-list" />
      {circlesCloud !== null ? (
        <ListRow leading={thumb("person", palette.tints.sky)} title="Ask someone" subtitle="One person, by text or in Yada" onPress={go("/pray/ask-someone")} testID="add-or-ask-someone" />
      ) : null}
      {prayCloud !== null ? (
        <>
          {circles.map((c) => (
            <ListRow
              key={c.id}
              leading={thumb("people", palette.tints.forest)}
              title={`Ask ${c.name}`}
              subtitle={peopleLine(c.people)}
              onPress={go({ pathname: "/pray/ask", params: { circle: c.id, owner: c.owner, name: c.name } })}
              testID={`add-or-ask-circle-${c.id}`}
            />
          ))}
          <ListRow leading={thumb("globe", BRAND.forest, true)} title="Ask everyone on Yada" subtitle="Never your name" onPress={go("/pray/ask")} testID="add-or-ask-everyone" />
        </>
      ) : null}
      {circlesCloud !== null ? (
        <ListRow leading={thumb("plus", palette.fill)} title="New circle" subtitle={`Up to ${CIRCLE_MAX} people you invite`} onPress={go("/pray/new-circle")} testID="add-or-ask-new-circle" />
      ) : null}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
