# 地図上の検索結果ハイライトが表示されない問題を解消する

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md file is checked into this repo at `.agent/PLANS.md`. This ExecPlan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

検索で得られた経路が地図上で太線ハイライトされず、どの路線を使うのか視覚的に分からない問題を解消する。GTFS 由来の路線名が空になっているためにハイライト判定が失敗していると考えられる。GTFS 前処理とクライアント側の処理を整え、ルート名に基づくハイライトが確実に機能する状態を作り、ブラウザ実機（Playwright 等）で確認する。

## Progress

- [x] (2026-01-12 08:55Z) ExecPlan02 を作成し、目的と手順を定義した。
- [x] (2026-01-12 09:06Z) Playwright スクリプト（`scripts/playwright-highlight-check.ts`）で現状を再現し、`highlightedPaths: 0` のスクリーンショットを取得した（`artifacts/highlight-check.png`）。
- [x] (2026-01-12 09:11Z) GTFS 前処理で `route_short_name` が空の場合に `route_long_name` を補完するパッチを実装し、`pnpm gtfs:sync` でバイナリを再生成した。
- [x] (2026-01-12 09:12Z) 旅程変換のテストを更新し、使用路線名が空フォールバックではなく GTFS の路線名になることを検証した。
- [x] (2026-01-12 09:14Z) Playwright スクリプトで再確認し、ハイライト対象のポリラインが高不透明・非破線で描画されることとスクリーンショット（`artifacts/highlight-check-after.png`）を取得した。
- [x] (2026-01-12 09:16Z) `pnpm lint` / `pnpm test` / `pnpm build` を通した。
- [x] (2026-01-12 09:17Z) Outcomes & Retrospective を更新した。

## Surprises & Discoveries

- Observation: minotor が保持する `serviceRoutes` の `name` が空文字列になっており、`usedRouteNames` が `Route BUS` のようなフォールバックで埋まるため、`routes.geojson` の `route_name` と一致せずハイライトされない。
  Evidence: `node -e "import {readFileSync} from 'fs'; import {Timetable} from 'minotor'; const t=Timetable.fromData(new Uint8Array(readFileSync('public/gtfs/timetable.bin'))); console.log(t.serviceRoutes.slice(0,5));"` で `{ type: 'BUS', name: '', ... }` を確認。Playwright チェック `pnpm tsx scripts/playwright-highlight-check.ts` の出力が `highlightedPaths: 0`。
- Observation: Playwright で取得した Leaflet の `stroke-width` は HiDPI 環境で半分にスケーリングされるため、ハイライト判定は破線解除と不透明度で見る方が確実。
  Evidence: `pathsSummary` に `dashValues: ["6 6",""]` と `highlightedLike: 2` が出力され、破線解除された 2 本のポリラインがハイライトとして描画されていることを確認。

## Decision Log

- Decision: GTFS 前処理で `route_short_name` が空の場合は `route_long_name` を埋めて minotor に渡し、旅程の路線名を欠損させない。
  Rationale: 知立市ミニバスの GTFS は `route_short_name` が空で、minotor が空文字列のサービス名を生成するため。空文字を防ぎ、GeoJSON の `route_name` と一致させてハイライトできるようにする。
  Date/Author: 2026-01-12 / Codex

## Outcomes & Retrospective

GTFS 前処理に路線名の補完を追加し、minotor の ServiceRoute 名が空にならないようにした。`pnpm gtfs:sync` で生成した `timetable.bin` から `usedRouteNames` に実際の路線名が入ることをテストで保証し、Playwright スクリプトで画面を開いて検索したところ、利用路線のポリラインが破線解除・高不透明でハイライトされることを確認できた。lint/test/build も成功し、ハイライト欠如の原因は解消した。

## Context and Orientation

現在のトップページ `src/app/page.tsx` では、`planTrip` が返す `usedRouteNames` を地図コンポーネント `src/components/TransitMap.tsx` に渡し、`routes.geojson` の `route_name` と一致した路線を太線ハイライトしている。GTFS 前処理は `scripts/gtfs-sync.ts` で `minotor` を用いて `timetable.bin` と `stops.bin` を生成するが、知立市ミニバスの GTFS では `routes.txt` の `route_short_name` が空で `route_long_name` のみに名称が入っている。そのため minotor が持つ ServiceRoute の `name` が空文字列となり、`usedRouteNames` が `["Route BUS", …]` にフォールバックして `routes.geojson` の名前と一致せず、ハイライトが掛からないと推測される。

関連ファイルと役割:
- `scripts/gtfs-sync.ts` — GTFS ZIP を取得し、minotor でバイナリを生成する前処理 CLI。ここで routes.txt を補正できる。
- `public/gtfs/routes.geojson` — 地図描画に用いる路線ジオメトリと `route_name`。
- `src/lib/planner/planTrip.ts` — minotor の結果を旅程モデルに変換し、`usedRouteNames` を返す。
- `src/components/TransitMap.tsx` — `usedRouteNames` と `routesGeoJson` を突き合わせて太線ハイライトを描画する。
- `src/lib/routeColors.ts` — 路線名から色を決めるロジック。ハイライトはこの色で描画される。

## Plan of Work

まず Playwright を使って現状の挙動をブラウザで観察し、検索後も路線ポリラインが薄いままになることを確認する。次に、GTFS 前処理で `routes.txt` の `route_short_name` が空のとき `route_long_name` を自動で補完する処理を追加し、パッチ済みの ZIP から `timetable.bin` を再生成する。必要に応じて `planTrip` の `usedRouteNames` が空にならないことを守るロジックやテストを加える。

その後、アプリを起動して検索を実行し、`usedRouteNames` に GeoJSON と一致する路線名が入り、TransitMap が太線でハイライトすることを Playwright で再確認する。最後に lint/test/build を実行し、新規テストやスナップショットを含めて全て成功することを確認してから振り返りを書く。

## Concrete Steps

作業ディレクトリはリポジトリルート（`/workspaces/bus-transit-app`）とする。

1. `pnpm dev` を起動し、Playwright で http://localhost:3000 を開いて検索操作を行い、経路ハイライトが薄いままになることを記録する（スクリーンショット取得）。
2. `scripts/gtfs-sync.ts` に routes.txt の補完処理を追加する。`route_short_name` が空なら `route_long_name` をコピーし、必要なら `zip` コマンドでフィード ZIP を上書きした上で minotor に渡す。
3. `pnpm gtfs:sync` を再実行して `public/gtfs/*.bin` を再生成する。
4. `planTrip` / `TransitMap` で `usedRouteNames` が空にならないか確認し、必要なら小規模テストを追加する（例: `planTrip` の usedRouteNames が GeoJSON の route_name と一致すること）。
5. 再度 Playwright で検索を実行し、指定路線が太線でハイライトされることを確認し、スクリーンショットを残す。
6. `pnpm lint` / `pnpm test` / `pnpm build` を実行して全て成功することを確認する。

## Validation and Acceptance

ブラウザで検索を実行した際に、利用する路線が `routes.geojson` の色で太線ハイライトされ、未利用路線は薄い表示のままになること。Playwright で同操作を実行し、検索前後のスクリーンショットでハイライトが明確に現れることを確認する。自動化テストがある場合は `pnpm lint` / `pnpm test` / `pnpm build` が全て成功する。

## Idempotence and Recovery

GTFS 補完は idempotent に行い、`pnpm gtfs:sync` を再実行すれば常に同じ結果（短名が長名で補完された routes.txt から生成されたバイナリ）になるようにする。ZIP 書き換えが失敗した場合は `data/gtfs/` の ZIP を削除して再ダウンロードし、再同期すれば復旧できる。アプリ側の変更は git で追跡され、失敗時は差分確認で元に戻せる。

## Artifacts and Notes

- Playwright チェック（修正前）: `pnpm tsx scripts/playwright-highlight-check.ts` → `artifacts/highlight-check.png`、`pathsSummary.highlightedLike: 0`。
- Playwright チェック（修正後）: `SCREENSHOT_PATH=artifacts/highlight-check-after.png pnpm tsx scripts/playwright-highlight-check.ts` → `pathsSummary.highlightedLike: 2`（破線解除・高不透明な路線が描画される）。

## Interfaces and Dependencies

- `scripts/gtfs-sync.ts`: GTFS ZIP のパッチ処理を追加する。外部依存として `zip` コマンドを利用して ZIP を更新する。
- `src/lib/planner/planTrip.ts`: `usedRouteNames` が空文字列にならないように route 名のフォールバックを保持する。
- Playwright（`npx playwright` など）: ブラウザ操作とスクリーンショット取得に使用する。
