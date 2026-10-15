/**
 * "Hear this passage" (canvas UL-01, UL-02; John, 15 Oct 2026): from a verse's Understand or a passage's guide,
 * Listen starts at the passage's first verse and the sheet closes, so the words being read are in view. Under a
 * licensed page it reads the BSB, as Listen does (EG-03); where no voice can read, the row is not offered.
 * Speechify keeps its listen control beside the text it reads,
 * https://mobbin.com/screens/c3343a61-2e32-4e5d-a061-39cd80573727.
 */

import { type BookCode, ordToParts } from "@yada/schema";

import { audioTranslation, listen } from "../data/audio";
import { useAudio } from "../state/audio";
import { useSettings } from "../state/settings";
import { MediaIcon } from "./audio/MediaIcon";
import { useSheetNav } from "./navigation";
import { Row, RowNote } from "./Sheet";
import { Chrome } from "./Type";

export function HearPassage({ book, startOrd, range, first = true }: { book: BookCode; startOrd: number; range: string; first?: boolean }) {
  const { closeSheet } = useSheetNav();
  const translation = useSettings((s) => s.translation);
  const voice = useAudio((s) => s.voice);
  // As the reader's Listen: a text a voice may read, and a voice to read it.
  if (audioTranslation(translation) === null || voice === null) return null;
  const start = ordToParts(startOrd);
  return (
    <Row
      first={first}
      chevron={false}
      trailing={<MediaIcon name="play" size={18} maxScale={1} />}
      onPress={() => {
        closeSheet();
        void listen(book, start.chapter, start.verse === 0 ? 1 : start.verse);
      }}
      label={`Hear this passage, ${range}`}
      hint="Plays from its first verse"
      testID="hear-passage"
    >
      <Chrome tone="ink" style={{ fontWeight: "500" }}>
        Hear this passage
      </Chrome>
      <RowNote>{range}</RowNote>
    </Row>
  );
}
