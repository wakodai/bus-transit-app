import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GTFS_API_URL,
  fetchChiryuMiniBusFile,
} from "./gtfsDataRepository";

const baseEntry = {
  file_uid: "uid-old",
  file_url: "https://example.com/feed.zip",
  file_stop_url: "https://example.com/stops.geojson",
  file_route_url: "https://example.com/routes.geojson",
  file_from_date: "2024-01-01",
  file_to_date: "2024-12-31",
  file_last_updated_at: "2024-01-02T00:00:00Z",
  file_published_at: "2024-01-02T00:00:00Z",
  feed_license_id: "CC BY 4.0",
  feed_license_url: "https://example.com/license",
  feed_name: "Example Feed",
};

const buildResponse = (body: unknown) =>
  new Response(
    JSON.stringify({
      code: 200,
      message: "ok",
      body,
    }),
    { status: 200 },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchChiryuMiniBusFile", () => {
  it("最新の published_at を持つフィードを選ぶ", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        buildResponse([
          { ...baseEntry, file_uid: "old", file_published_at: "2024-01-01T00:00:00Z" },
          { ...baseEntry, file_uid: "new", file_published_at: "2025-02-01T00:00:00Z" },
        ]),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const latest = await fetchChiryuMiniBusFile();

    expect(fetchSpy).toHaveBeenCalledWith(
      GTFS_API_URL,
      expect.objectContaining({ headers: expect.anything() }),
    );
    expect(latest.fileUid).toBe("new");
    expect(latest.feedZipUrl).toBe(baseEntry.file_url);
    expect(latest.licenseId).toBe(baseEntry.feed_license_id);
  });

  it("レスポンス body が空ならエラーを投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildResponse([])));

    await expect(fetchChiryuMiniBusFile()).rejects.toThrow(
      /metadata body is empty/i,
    );
  });
});
