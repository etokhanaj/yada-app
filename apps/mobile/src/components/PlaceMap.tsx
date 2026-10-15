/**
 * MS-01's map (canvas WM-06): drawn on the phone from Natural Earth's outlines (public domain;
 * data/basemap.generated.ts) in Yada's tokens: sage sea, paper land, hairline rivers, one accent ring
 * for the place. No map service and no native module: it works offline, the same in every state.
 * Patterns: Fly Delta's static map with one pin, https://mobbin.com/screens/63d05eda-3a07-4136-a493-35d962a28089;
 * Rodeo's map set on paper, https://mobbin.com/screens/8d8a9f02-bb21-4372-b031-c4c9538afa2f.
 *
 * Labels are the data's own names; nothing is drawn that the data does not place (rule 4).
 */

import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

import { LAKES, LAND, RIVERS } from "../data/basemap.generated";
import { useAXLevel, usePalette } from "../design/tokens";
import { type PlaceRow, placesToDraw, ringPath, viewFor } from "../lib/wordsAndPlaces";

const HEIGHT_RATIO = 2 / 3;

export function PlaceMap({ place, others }: { place: PlaceRow; others: readonly PlaceRow[] }) {
  const palette = usePalette();
  const ax = useAXLevel() >= 3;
  const [width, setWidth] = useState(0);
  const height = Math.round(width * HEIGHT_RATIO);
  const view = width === 0 ? null : viewFor(place, others, width, height);
  const label = ax ? 20 : 13;
  const shown = view === null ? [] : placesToDraw(view, place.name, others, label);
  const named = shown.map(({ place: o }) => o.name);
  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Map: ${place.name}${named.length > 0 ? `, with ${named.join(", ")}` : ""}`}
      style={{ width: "100%", aspectRatio: 1 / HEIGHT_RATIO, borderRadius: 20, overflow: "hidden", boxShadow: `0 0 0 1px ${palette.divider}`, marginBottom: 14 }}
      testID="place-map"
    >
      {view !== null ? (
        <Svg width={width} height={height}>
          <Rect width={width} height={height} fill={palette.selection} />
          {LAND.map((r, i) => {
            const d = ringPath(view, r, true);
            return d === null ? null : <Path key={`l${i}`} d={d} fill={palette.paper} />;
          })}
          {LAKES.map((r, i) => {
            const d = ringPath(view, r, true);
            return d === null ? null : <Path key={`k${i}`} d={d} fill={palette.selection} />;
          })}
          {RIVERS.map((r, i) => {
            const d = ringPath(view, r, false);
            return d === null ? null : <Path key={`r${i}`} d={d} fill="none" stroke={palette.mutedInk} strokeWidth={1.5} />;
          })}
          {shown.map(({ place: o, x, y }) => (
            <PlaceDot key={o.id} x={x} y={y} name={o.name} size={label} ink={palette.ink} />
          ))}
          <Circle cx={width / 2} cy={height / 2} r={8} fill="none" stroke={palette.accent} strokeWidth={2.5} />
          <Circle cx={width / 2} cy={height / 2} r={3.5} fill={palette.ink} />
          <SvgText x={width / 2 + 13} y={height / 2 + 5} fontSize={label + 2} fontWeight="600" fontFamily="Literata" fill={palette.ink}>
            {place.name}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

function PlaceDot({ x, y, name, size, ink }: { x: number; y: number; name: string; size: number; ink: string }) {
  return (
    <>
      <Circle cx={x} cy={y} r={4} fill={ink} />
      <SvgText x={x - 8} y={y + 4} fontSize={size} fontFamily="Literata" fill={ink} textAnchor="end">
        {name}
      </SvgText>
    </>
  );
}
