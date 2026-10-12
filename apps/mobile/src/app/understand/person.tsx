import { isBookCode } from "@yada/schema";
import { useLocalSearchParams } from "expo-router";

import { ProfileScreen } from "../../components/StudyLayer";

/** A person from Understand's People rows or Search, pushed inside the Understand sheet (canvas TD-02). */
export default function Person() {
  const params = useLocalSearchParams<{ book?: string; id?: string; from?: string; via?: string }>();
  const book = params.book ?? "";
  if (!isBookCode(book)) return null;
  return <ProfileScreen book={book} id={Number(params.id ?? "0")} from={params.from ?? ""} via={params.via} />;
}
