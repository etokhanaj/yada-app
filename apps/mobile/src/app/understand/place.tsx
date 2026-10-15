import { isBookCode } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";

import { PlaceScreen } from "../../components/PlaceScreen";

/** A place from a verse or a passage's guide, pushed inside the sheet (canvas WM-06). */
export default function Place() {
  const params = useLocalSearchParams<{ book?: string; id?: string; from?: string }>();
  const book = params.book ?? "";
  if (!isBookCode(book) || params.id === undefined) return null;
  return <PlaceScreen book={book} id={params.id} from={Number(params.from)} />;
}
