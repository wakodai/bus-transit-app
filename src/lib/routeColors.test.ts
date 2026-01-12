import { describe, expect, it } from "vitest";
import { routeNameToColorHex } from "./routeColors";

describe("routeNameToColorHex", () => {
  it("色名を含む路線名から定義済みの色を返す", () => {
    expect(routeNameToColorHex("ミニバス１コース（グリーンコース）")).toBe(
      "#16a34a",
    );
    expect(routeNameToColorHex("ミニバス５コース（イエローコース）")).toBe(
      "#eab308",
    );
  });

  it("未知の名前でも安定した色を返す", () => {
    const color1 = routeNameToColorHex("テスト路線A");
    const color2 = routeNameToColorHex("テスト路線A");
    const color3 = routeNameToColorHex("別の路線");
    expect(color1).toBe(color2);
    expect(color1).not.toBe(color3);
  });
});
