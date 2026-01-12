import { z } from "zod";

export type GtfsRepoFile = {
  fileUid: string;
  feedZipUrl: string;
  stopsGeojsonUrl: string;
  routesGeojsonUrl: string;
  licenseId: string;
  licenseUrl: string;
  fromDate: string;
  toDate: string;
  feedName: string;
  publishedAt: string;
  updatedAt: string;
};

export const GTFS_API_URL =
  "https://api.gtfs-data.jp/v2/files?org_id=chiryucity";

const GtfsApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  body: z.array(
    z.object({
      file_uid: z.string(),
      file_url: z.string().url(),
      file_stop_url: z.string().url(),
      file_route_url: z.string().url(),
      file_from_date: z.string(),
      file_to_date: z.string(),
      file_last_updated_at: z.string(),
      file_published_at: z.string(),
      feed_license_id: z.string(),
      feed_license_url: z.string().url(),
      feed_name: z.string(),
    }),
  ),
});

const dateDesc = (a: string, b: string) =>
  Date.parse(b ?? "") - Date.parse(a ?? "");

export async function fetchChiryuMiniBusFile(
  options: { signal?: AbortSignal } = {},
): Promise<GtfsRepoFile> {
  const res = await fetch(GTFS_API_URL, {
    headers: {
      accept: "application/json",
    },
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch GTFS metadata (status ${res.status} ${res.statusText})`,
    );
  }

  const parsed = GtfsApiResponseSchema.parse(await res.json());
  if (parsed.body.length === 0) {
    throw new Error("GTFS metadata body is empty");
  }

  const sorted = [...parsed.body].sort((a, b) =>
    dateDesc(a.file_published_at, b.file_published_at),
  );
  const latest = sorted[0];

  return {
    fileUid: latest.file_uid,
    feedZipUrl: latest.file_url,
    stopsGeojsonUrl: latest.file_stop_url,
    routesGeojsonUrl: latest.file_route_url,
    licenseId: latest.feed_license_id,
    licenseUrl: latest.feed_license_url,
    fromDate: latest.file_from_date,
    toDate: latest.file_to_date,
    feedName: latest.feed_name,
    publishedAt: latest.file_published_at,
    updatedAt: latest.file_last_updated_at,
  };
}
