/**
 * The credit under a source's words, as short as the source's name ("Tyndale", "unfoldingWord, adapted"), opening
 * Sources and licences, which carries each full notice, licence and what Yada changed (John, 22 Oct 2026: the long
 * credit lines read as clutter). CC BY 4.0 and BY-SA 4.0 §3(a)(2) allow the attribution to be given by a link to a
 * page holding it. Sources opens inside the sheet the credit is in, so no sheet stacks on a sheet.
 */

import { router, useSegments } from "expo-router";
import { Pressable, type StyleProp, type TextStyle } from "react-native";

import { Chrome } from "./Type";

/** The sheets that keep their own Sources page; anywhere else it is the full page. */
const IN_SHEET = new Set(["understand", "guide", "about"]);

export function SourceLine({ children, style, center = false, testID }: { children: string; style?: StyleProp<TextStyle>; center?: boolean; testID?: string }) {
  const sheet = useSegments()[0];
  const to = sheet !== undefined && IN_SHEET.has(sheet) ? `/${sheet}/sources` : "/sources";
  return (
    <Pressable onPress={() => router.push(to)} accessibilityRole="link" accessibilityLabel={`${children}. Opens Sources and licences`} hitSlop={8} style={{ alignSelf: center ? "center" : "flex-start", minHeight: 44, justifyContent: "center" }} testID={testID}>
      <Chrome step="note" tone="muted" style={style}>
        {children}
      </Chrome>
    </Pressable>
  );
}
