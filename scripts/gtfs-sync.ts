import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { GtfsParser } from "minotor/parser";
import { fetchChiryuMiniBusFile } from "../src/lib/gtfsDataRepository.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT_DIR, "data", "gtfs");
const PUBLIC_GTFS_DIR = path.join(ROOT_DIR, "public", "gtfs");
const execFileAsync = promisify(execFile);

type DownloadTarget = {
  url: string;
  destination: string;
  label: string;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

function pickServiceDate(fromDate: string, toDate: string): {
  date: Date;
  reason: string;
} {
  const today = new Date();
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T23:59:59`);

  if (today < from) {
    return { date: from, reason: "clamped to feed_from_date" };
  }
  if (today > to) {
    return { date: to, reason: "clamped to feed_to_date" };
  }
  return { date: today, reason: "today" };
}

async function downloadFiles(targets: DownloadTarget[]) {
  for (const target of targets) {
    const res = await fetch(target.url);
    if (!res.ok) {
      throw new Error(
        `Failed to download ${target.label} (status ${res.status} ${res.statusText})`,
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(target.destination), { recursive: true });
    await writeFile(target.destination, buffer);
    const sizeKb = (buffer.byteLength / 1024).toFixed(1);
    console.log(
      `Saved ${target.label} -> ${path.relative(ROOT_DIR, target.destination)} (${sizeKb} KB)`,
    );
  }
}

async function patchRouteShortNames(feedZipPath: string) {
  const { stdout } = await execFileAsync("unzip", ["-p", feedZipPath, "routes.txt"]);
  const original = stdout as string;
  const lines = original.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines.shift();
  if (!header) {
    throw new Error("routes.txt is empty; cannot patch route_short_name");
  }
  const columns = header.split(",");
  const shortIdx = columns.indexOf("route_short_name");
  const longIdx = columns.indexOf("route_long_name");
  if (shortIdx === -1 || longIdx === -1) {
    console.warn("routes.txt missing route_short_name or route_long_name; skipping patch");
    return;
  }

  let patchedCount = 0;
  const patchedRows = lines.map((line) => {
    const cells = line.split(",");
    const shortName = (cells[shortIdx] ?? "").trim();
    const longName = (cells[longIdx] ?? "").trim();
    if (!shortName && longName) {
      cells[shortIdx] = longName;
      patchedCount += 1;
    }
    return cells.join(",");
  });

  if (patchedCount === 0) {
    console.log("routes.txt: route_short_name already populated; no patch applied.");
    return;
  }

  const patchedContent = [header, ...patchedRows].join("\n");
  const tmpRoutesPath = path.join(DATA_DIR, "routes.txt");
  await writeFile(tmpRoutesPath, patchedContent);
  await execFileAsync("zip", ["-j", feedZipPath, tmpRoutesPath]);
  await rm(tmpRoutesPath);
  console.log(
    `Patched ${patchedCount} empty route_short_name entries using route_long_name in ${path.basename(feedZipPath)}`,
  );
}

async function main() {
  console.log("Fetching GTFS metadata for org_id=chiryucity...");
  const meta = await fetchChiryuMiniBusFile();
  console.log(
    `Latest feed: ${meta.feedName} (uid=${meta.fileUid}, published=${meta.publishedAt})`,
  );

  const { date: serviceDate, reason } = pickServiceDate(
    meta.fromDate,
    meta.toDate,
  );
  console.log(
    `Using service date ${formatDate(serviceDate)} (${reason}; valid ${meta.fromDate}..${meta.toDate})`,
  );

  const feedZipPath = path.join(DATA_DIR, `feed-${meta.fileUid}.zip`);

  await downloadFiles([
    {
      url: meta.feedZipUrl,
      destination: feedZipPath,
      label: "feed.zip",
    },
    {
      url: meta.stopsGeojsonUrl,
      destination: path.join(PUBLIC_GTFS_DIR, "stops.geojson"),
      label: "stops.geojson",
    },
    {
      url: meta.routesGeojsonUrl,
      destination: path.join(PUBLIC_GTFS_DIR, "routes.geojson"),
      label: "routes.geojson",
    },
  ]);

  await patchRouteShortNames(feedZipPath);
  console.log("Parsing GTFS with minotor...");
  const parser = new GtfsParser(feedZipPath);
  const timetable = await parser.parseTimetable(serviceDate);
  const stopsIndex = await parser.parseStops();

  await mkdir(PUBLIC_GTFS_DIR, { recursive: true });
  await writeFile(
    path.join(PUBLIC_GTFS_DIR, "timetable.bin"),
    Buffer.from(timetable.serialize()),
  );
  await writeFile(
    path.join(PUBLIC_GTFS_DIR, "stops.bin"),
    Buffer.from(stopsIndex.serialize()),
  );
  await writeFile(
    path.join(PUBLIC_GTFS_DIR, "metadata.json"),
    JSON.stringify(
      {
        fileUid: meta.fileUid,
        feedName: meta.feedName,
        licenseId: meta.licenseId,
        licenseUrl: meta.licenseUrl,
        fromDate: meta.fromDate,
        toDate: meta.toDate,
        publishedAt: meta.publishedAt,
        updatedAt: meta.updatedAt,
        serviceDate: formatDate(serviceDate),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    `Wrote timetable.bin and stops.bin for ${formatDate(serviceDate)} to public/gtfs`,
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
