/**
 * By need (Build 12 BN-30; John, 25 Oct 2026: "use Nave's directions and have a way to design for a page for them so we
 * don't flood it, except it remains just 6"). Every need with how many prayers it holds: the six Bible prayers shows as
 * tiles, then Keep asking and The nation, which John approved from Nave's Topical Bible the same day. One line names
 * the source at the foot.
 */

import { router } from "expo-router";

import { ListRow, PageScreen } from "../../../components/Page";
import { Chrome } from "../../../components/Type";
import { ALL_NEEDS, prayersFor } from "../../../data/prayersOfTheBible";

export default function Needs() {
  return (
    <PageScreen title="By need" back="Bible prayers" clearTabBar testID="pray-needs">
      {ALL_NEEDS.map((need, i) => {
        const n = prayersFor(need).length;
        return (
          <ListRow
            key={need}
            first={i === 0}
            book
            title={need}
            subtitle={`${n} ${n === 1 ? "prayer" : "prayers"}`}
            onPress={() => router.push({ pathname: "/pray/need", params: { need, from: "needs" } })}
            testID={`needs-${need}`}
          />
        );
      })}
      <Chrome step="note" tone="muted" style={{ marginTop: 18 }}>
        From Nave’s Topical Bible
      </Chrome>
    </PageScreen>
  );
}
