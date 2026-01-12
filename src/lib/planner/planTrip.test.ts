import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planTrip } from "./planTrip";
import { resetGtfsCaches } from "../gtfsLocalClient";

const fetchLocalFile = async (url: string) => {
  const filename = url.replace(/^\/?gtfs\//, "");
  const filePath = path.join(process.cwd(), "public", "gtfs", filename);
  const buffer = await fs.readFile(filePath);
  return new Response(buffer);
};

describe("planTrip", () => {
  beforeEach(() => {
    resetGtfsCaches();
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      return fetchLocalFile(url);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("知立駅から牛田駅北までの旅程を返す", async () => {
    const itinerary = await planTrip({
      fromStopId: "600_01",
      toStopId: "603_01",
      departAtHHmm: "09:00",
      maxTransfers: 2,
    });

    expect(itinerary.legs.length).toBeGreaterThan(0);
    expect(itinerary.usedRouteNames).toContain("ミニバス２コース（パープルコース）");
    expect(itinerary.usedRouteNames.every((name) => !name.startsWith("Route "))).toBe(true);
  });
});
