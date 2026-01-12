const NAMED_COLORS: { keywords: RegExp; hex: string }[] = [
  { keywords: /グリーン|緑|green/i, hex: "#16a34a" },
  { keywords: /ブルー|青|blue/i, hex: "#2563eb" },
  { keywords: /オレンジ|橙|orange/i, hex: "#f97316" },
  { keywords: /イエロー|黄|yellow/i, hex: "#eab308" },
  { keywords: /パープル|紫|purple/i, hex: "#a855f7" },
  { keywords: /レッド|赤|red/i, hex: "#ef4444" },
  { keywords: /ピンク|pink/i, hex: "#ec4899" },
  { keywords: /ブラウン|茶|brown/i, hex: "#92400e" },
  { keywords: /ブラック|黒|black/i, hex: "#111827" },
];

const clamp255 = (value: number) => Math.max(0, Math.min(255, value));

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  const r = clamp255(Math.round((r1 + m) * 255));
  const g = clamp255(Math.round((g1 + m) * 255));
  const b = clamp255(Math.round((b1 + m) * 255));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

/**
 * route_name に含まれる色名から表示色を決める。
 * 一致しない場合は文字列ハッシュから安定した HSL を生成する。
 */
export function routeNameToColorHex(routeName: string): string {
  const matched = NAMED_COLORS.find(({ keywords }) => keywords.test(routeName));
  if (matched) return matched.hex;

  const hash = hashString(routeName);
  const hue = hash % 360;
  return hslToHex(hue, 0.65, 0.52);
}
