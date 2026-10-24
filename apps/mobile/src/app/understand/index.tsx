import { useLocalSearchParams } from "expo-router";

import { type UnderstandSection, UnderstandRoute } from "../../components/UnderstandViews";

/** From the reader: one verse or a range; Original and Compare land on their section, the Readers differ mark on its readings (RU-8). */
export default function Understand() {
  const params = useLocalSearchParams<{ ref?: string; section?: string }>();
  const section: UnderstandSection | undefined =
    params.section === "original" || params.section === "compare" || params.section === "differ" ? params.section : undefined;
  return <UnderstandRoute refText={params.ref ?? ""} section={section} />;
}
