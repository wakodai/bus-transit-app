# 知立市ミニバス乗り換え案内 SPA（GTFS-JP + Minotor + 地図表示）

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md file is checked into this repo at `.agent/PLANS.md`. This ExecPlan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

ユーザーが「知立市 ミニバス」の出発地・（任意で）経由地・目的地を地図クリックまたは名称検索で指定し、出発時刻と経由地の滞在時間を考慮したバス乗り換えプランを計算できる SPA を作る。結果は、地図上で路線ごとに色分けされたルートとして分かりやすく表示し、同時に文字の旅程（どこからどこへ、何時に出て何時に着く、どの路線に乗る、乗り換えはどこか）もシンプルに表示する。

「動作している」の確認は、ローカルの devcontainer 上でアプリを起動し、実データ（GTFS-JP）で検索→地図と旅程表示が出ること、そして `lint`/`test`/`build` が全てパスすることで行う。

## Progress

- [x] (2026-01-12 06:29Z) ExecPlan を新規作成した。
- [x] (2026-01-12 06:29Z) devcontainer の雛形を追加した（Node.js 20 / docker-in-docker / CODEX_HOME）。
- [x] (2026-01-12 07:03Z) Next.js（TypeScript）SPA の雛形を作成した（Tailwind v4 / Vitest + Testing Library を導入し、`pnpm lint` / `pnpm test` / `pnpm build` を通した）。
- [x] (2026-01-12 07:14Z) GTFS-JP データ取得と前処理（stops/routes GeoJSON と minotor 用 bin）を `pnpm gtfs:sync` で自動化し、実データで動作確認した。
- [x] (2026-01-12 07:38Z) 地図 UI（路線色分け、地点選択、結果描画）を実装した。
- [x] (2026-01-12 07:39Z) 乗り換え検索（経由地と滞在時間を含む）を実装した。
- [x] (2026-01-12 07:40Z) 受け入れ条件（E2E/ユニット、lint/test/build）を満たすテストを実装し、全てパスさせた。

## Surprises & Discoveries

- Observation: 知立市「ミニバス」の GTFS-JP を、GTFSデータリポジトリ（`api.gtfs-data.jp`）から機械的に取得できる。
  Evidence: `https://api.gtfs-data.jp/v2/files?org_id=chiryucity` が `file_url`（GTFS ZIP）と `file_stop_url`（stops.geojson）と `file_route_url`（routes.geojson）を返す。
- Observation: `routes.geojson` は `route_name` とジオメトリは提供するが、色（route_color）は含まれない。
  Evidence: `https://api.gtfs-data.jp/v2/organizations/chiryucity/feeds/communitybus/files/routes.geojson?uid=57c9a2a5-dc52-4fc8-b3e4-49a1cbcaf256` の `properties` は `{ id, route_name }` のみ。
- Observation: 乗り換え検索ライブラリとして TypeScript/ブラウザ対応の `minotor`（MIT）があり、クライアントサイド実行に向いている。一方で、類似の RAPTOR 実装 `raptor-journey-planner` は GPLv3 で、アプリ全体のライセンス影響が大きい。
  Evidence: `aubryio/minotor` は `LICENSE` が MIT。`planarnetwork/raptor` は `README.md` に GPLv3 と明記されている。
- Observation: `create-next-app` は空でないディレクトリに対しては失敗するため、テンポラリディレクトリで生成してからルートへ同期する必要があった。
  Evidence: `The directory bus-transit-app contains files that could conflict: .agent/ ... Either try using a new directory name, or remove the files listed above.` というエラーが出た。
- Observation: Vitest で `@vitejs/plugin-react` を使う場合、`package.json` を ESM (`"type": "module"`) にしないと `ESM file cannot be loaded by require` で落ちる。
  Evidence: `@vitejs/plugin-react" resolved to an ESM file. ESM file cannot be loaded by require.` というエラーメッセージを受け、`"type": "module"` を追加したところ解消した。
- Observation: GTFS メタデータの有効期間は `file_from_date=2025-12-23` から `file_to_date=2026-12-31` までで、`pnpm gtfs:sync` ではこの範囲に今日の日付をクランプして minotor で解析する必要があった。
  Evidence: メタデータレスポンスの `file_from_date`/`file_to_date` を参照し、`Using service date 2026-01-12 (today; valid 2025-12-23..2026-12-31)` とログ出力されるように実装し、minotor が 106 stops / 10 routes を解析したログを得た。
- Observation: ESLint flat config では `/* eslint-env */` コメントが非推奨となり警告になるため、gtfs:sync スクリプトではコメントを撤去してもコンソール使用で警告が出ない構成だった。
  Evidence: `ESLintEnvWarning: /* eslint-env */ comments are no longer recognized ... Found in scripts/gtfs-sync.ts` という警告が出たためコメントを削除し、警告が解消した。
- Observation: `minotor` の公開エントリは `minotor` と `minotor/parser` に限られ、`minotor/router` サブパスは Node から解決できなかった。
  Evidence: tsx 実行時に `ERR_PACKAGE_PATH_NOT_EXPORTED` が発生し、インポートをルートエントリに切り替えたところ解消した。
- Observation: Leaflet はモジュール評価時に `window` を参照するため、Next.js のビルドで SSR 評価されると `window is not defined` で落ちる。
  Evidence: `next build` のプリレンダーで `ReferenceError: window is not defined` が出たため、React Leaflet コンポーネントを `dynamic(..., { ssr: false })` で遅延読み込みしたところビルドが通った。
- Observation: minotor の `Route` には空文字の `route.name` が含まれるケースがあり、UI 表示にはフォールバックのラベルが必要だった。
  Evidence: 実データで `usedRouteNames` が空文字になったため、`Route ${type}` 形式の代替名を埋める実装を追加した。

## Decision Log

- Decision: 時刻表データは GTFSデータリポジトリ（`https://api.gtfs-data.jp/v2`）を一次取得元として利用する。
  Rationale: 知立市ミニバスの GTFS-JP ZIP と、地図表示に便利な GeoJSON（routes/stops）を安定した URL で取得できるため。自前スクレイピングや PDF 解析を避けられる。
  Date/Author: 2026-01-12 / Codex
- Decision: 乗り換え検索ロジックは `minotor` を採用し、ブラウザ（必要なら Web Worker）で検索を実行する。
  Rationale: MIT で利用しやすく、GTFS ZIP を Node 側で前処理してブラウザで高速に検索できる設計のため。Vercel/Supabase に依存せず 0 円運用に寄せやすい。
  Date/Author: 2026-01-12 / Codex
- Decision: 地図表示は Leaflet（React Leaflet）を採用し、OpenStreetMap のタイルを開発用に利用する。
  Rationale: 実装が軽く、ポリライン・マーカーの色分け/ハイライトが簡単。将来はタイル提供元差し替えで運用コスト調整が可能。
  Date/Author: 2026-01-12 / Codex
- Decision: Supabase/PostgreSQL は「将来の永続化・更新・複数日のデータ管理」の拡張点として設計に織り込むが、最初のマイルストンでは必須にしない。
  Rationale: まずはローカルで全機能を動かすことを優先し、外部 DB のセットアップやマイグレーションで詰まるリスクを下げる。クライアントサイドの前処理+静的配信で要件を満たせるため。
  Date/Author: 2026-01-12 / Codex
- Decision: ユニットテスト基盤は Vitest + React Testing Library + jest-dom（jsdom 環境）を採用し、`pnpm test` で実行する。
  Rationale: Next.js に依存しない軽量ランナーで高速にテストを回せ、React コンポーネントの振る舞い検証を開発初期から積み上げやすいため。Jest を避けて依存を減らしつつ、jsdom で DOM マッチャーを利用できる。
  Date/Author: 2026-01-12 / Codex
- Decision: GTFS 前処理 CLI は TypeScript のまま `tsx` で実行し、`pnpm gtfs:sync` で最新フィード取得・GeoJSON 保存・`minotor` のバイナリ生成まで一気通貫で行う。生成物は `public/gtfs/`、ダウンロードキャッシュは `data/gtfs/` に置き、gitignore する。
  Rationale: ESM/TS のまま高速に実行でき、依存追加が最小限。ブラウザから直接参照するデータのみ `public/gtfs` にまとまるため UI 実装とテストが簡単。
  Date/Author: 2026-01-12 / Codex
- Decision: GTFS メタデータの `file_published_at` で最新フィードを選び、`file_from_date`/`file_to_date` でサービス日をクランプして minotor に渡す。
  Rationale: 配信期間外の日付で解析すると無効サービスになるリスクを避け、常に利用可能な日付でバイナリ生成を保証するため。
  Date/Author: 2026-01-12 / Codex
- Decision: Leaflet を使う地図コンポーネントは Next.js で SSR させず、`dynamic(..., { ssr: false })` でクライアント側のみ読み込む。
  Rationale: Leaflet が `window` を参照するためプリレンダーで落ちる。動作時はブラウザ限定で問題ないため SSR を無効化した。
  Date/Author: 2026-01-12 / Codex
- Decision: `planTrip` のテストでは `public/gtfs/` のバイナリを `fetch` スタブで返し、ネットワーク不要で経路探索を検証する。
  Rationale: 実データに基づくルーティングをテストしつつ、CI/ローカルで安定させるため。`resetGtfsCaches` と組み合わせてキャッシュ汚染も防ぐ。
  Date/Author: 2026-01-12 / Codex
- Decision: ルート名が欠損している場合は `Route ${type}` 形式のフォールバックを表示に使う。
  Rationale: 旅程 UI に空欄が出るのを防ぎ、利用路線のハイライト色決定にも安定したキーを提供するため。
  Date/Author: 2026-01-12 / Codex

## Outcomes & Retrospective

Next.js 16 + TypeScript + Tailwind v4 の雛形と、Vitest + React Testing Library のテスト基盤を追加し、`pnpm lint` / `pnpm test` / `pnpm build` が通る状態になった。トップページにはマイルストーンのロードマップを示すプレースホルダー UI を置き、次に着手すべき機能を示した。加えて、`pnpm gtfs:sync` で GTFS-JP を取得→routes/stops GeoJSON を保存→minotor 用 bin を生成できる CLI を実装し、実データでバイナリ出力を確認した（サービス日をメタデータ期間内でクランプ）。
React Leaflet を用いた地図 UI を追加し、路線色分け・停留所マーカー・選択モード切り替え（出発/経由/目的）・経路ハイライトを実装した。minotor をブラウザ側で復元して `planTrip` から旅程モデルを返す処理を組み込み、経由地滞在を考慮した検索と旅程テキスト表示を提供する。`routeNameToColorHex` と `planTrip` の単体テストを追加し、実データ（public/gtfs）を fetch スタブで読み込む統合テストも含めて `pnpm lint` / `pnpm test` / `pnpm build` は全て成功している。

## Context and Orientation

リポジトリには Next.js 16 + TypeScript + Tailwind v4 の雛形が配置されており、Vitest + React Testing Library のテスト基盤も整っている。GTFS 前処理用に `scripts/gtfs-sync.ts`（TypeScript + tsx 実行）を追加し、`pnpm gtfs:sync` で GTFS-JP ZIP を `data/gtfs/` にキャッシュしつつ `public/gtfs/` に GeoJSON と minotor 用バイナリを出力できる。重要な既存ファイルは `.agent/PLANS.md`（ExecPlan の書式・要件）、トップページのプレースホルダー UI（`src/app/page.tsx`）、テストセットアップ（`vitest.config.ts`, `src/test/setup.ts`）、共通コンポーネント（`src/components/FeatureCard.tsx`）、GTFS リポジトリクライアント（`src/lib/gtfsDataRepository.ts`）で、この ExecPlan は `.agent/PLANS.md` に従って維持される。

本プロジェクトで扱う重要語の定義は以下の通り。

GTFS: 公共交通の時刻表・停留所・路線などを CSV（`stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt` 等）で表現し ZIP にまとめたデータ形式。ここでは「知立市ミニバス」の GTFS-JP（日本の標準的なバス情報フォーマット）を入力として使う。

GTFSデータリポジトリ: `api.gtfs-data.jp` で公開されている GTFS/GTFS-JP の配信 API。特定の自治体（組織）に紐づく GTFS ZIP と、可視化向けの GeoJSON（`stops.geojson`, `routes.geojson`）を提供する。

SourceStopId: `minotor` がクエリ指定に使う「データソース上の停留所 ID」。GTFS の `stops.txt` の `stop_id`（例: `100_01`）をそのまま渡す想定とする。

路線色: `routes.geojson` に色が無いため、路線名（例: “グリーンコース”）からアプリ側で決める表示色。知立市ミニバスはコース名に色が含まれるため、まずは文字列マッチで決定し、該当しない場合は安定ハッシュで色を割り当てる。

ライセンス: `api.gtfs-data.jp` のレスポンスにはフィードのライセンス（例: CC BY 2.1 JP）が含まれる。アプリ UI の「データ出典」欄で表示し、要件として順守する。

## Plan of Work

最初に、devcontainer 上で Next.js + TypeScript のプロジェクト雛形を作成し、lint/test/build が回る最小状態を作る（このステップは完了済み。再現手順は Concrete Steps に記載）。ここで「SPA としての UI 実装」を進めやすいよう、App Router を使い、地図と入力フォームを Client Component として設計する（地図ライブラリはブラウザ専用のため）。

次に、GTFSデータリポジトリ API から「知立市ミニバス」の最新 GTFS ZIP と GeoJSON を取得し、アプリで利用しやすい形に前処理する。前処理は Node.js で行い、成果物は `public/gtfs/` 配下に配置してブラウザから取得できるようにする。具体的には `minotor` の `GtfsParser` を使い、指定日の `Timetable` と `StopsIndex` を生成し、`serialize()` したバイナリ（`timetable.bin`, `stops.bin`）を出力する。地図表示用には `stops.geojson` と `routes.geojson` をそのまま保存し、必要に応じてアプリ内でキャッシュ/整形する。

その後、UI を実装する。画面は「地図（左/上）」「入力（出発地/経由地/目的地・時刻・滞在時間）」「結果（地図ハイライト + 旅程テキスト）」の 3 要素で構成し、学習コストが低いシンプルな導線にする。地点指定は、(1) 停留所名検索、(2) 地図クリック→近傍停留所選択、の両方を提供する。検索実行時は、（経由地が無い場合）単一クエリ、（経由地がある場合）`出発→経由` と `経由（到着+滞在）→目的` の 2 クエリを実行し、結果を結合してユーザーに提示する。

最後に、要件を満たしていることを保証するための自動テストを実装する。ネットワークに依存しないよう、テスト用の極小 GTFS フィクスチャ（数停留所・数便・乗り換え可能な構成）をリポジトリ内に同梱し、そのフィクスチャから前処理→検索→旅程生成までをテストする。さらに Playwright を用いて E2E テストを追加し、(a) 地図の路線色分け、(b) 地図クリックでの地点指定、(c) 経由地と滞在時間を含む検索、(d) 地図ハイライトと旅程テキスト表示、をブラウザ操作として検証する。受け入れ条件として `lint/test/build` の全パスを必須化する。

## Concrete Steps

作業ディレクトリは常にリポジトリルート（`bus-transit-app/`）とする。

1) devcontainer を起動する。

    VS Code の Dev Containers 機能で「Reopen in Container」を実行する。起動後、コンテナ内で `echo $CODEX_HOME` を実行し、`${containerWorkspaceFolder}/.codex` が表示されることを確認する。

2) Next.js（TypeScript）プロジェクトを雛形として作成し、lint/test/build が通る状態にする（完了済みの再現手順）。

    ルートが空でないため、一度テンポラリに生成してから同期する。

        pnpm dlx create-next-app@latest tmp-next --ts --eslint --app --src-dir --tailwind --no-import-alias --use-pnpm --yes
        rsync -a tmp-next/ .
        rm -rf tmp-next
        pnpm install

    追加調整: `package.json` を `"type": "module"` にし、`lint`/`test`/`typecheck` スクリプトを定義。Vitest + React Testing Library + jest-dom + jsdom を `vitest.config.ts` と `src/test/setup.ts` でセットアップし、`src/components/FeatureCard.test.tsx` をサンプルテストとして追加した。README はプロジェクトの起動方法に更新済み。

    完了確認として以下を実行する（全て成功することを確認済み）。

        pnpm lint
        pnpm test
        pnpm build

3) GTFS 取得・前処理スクリプトを追加する（実装済み）。

    `scripts/gtfs-sync.ts` を `pnpm gtfs:sync` で実行し、`api.gtfs-data.jp` から `org_id=chiryucity` のメタデータを取得→`file_published_at` の最新を選択→`file_from_date`/`file_to_date` でサービス日をクランプ→ZIP/GeoJSON をダウンロード→`minotor` の `GtfsParser` で `StopsIndex` と `Timetable` を生成する。成果物は `public/gtfs/` に `stops.bin` / `timetable.bin` / `stops.geojson` / `routes.geojson` / `metadata.json` として出力し、ZIP は `data/gtfs/` にキャッシュする（いずれも gitignore）。

    例:

        pnpm gtfs:sync
        Using service date 2026-01-12 (today; valid 2025-12-23..2026-12-31)
        Saved feed.zip -> data/gtfs/feed-<uid>.zip
        Saved stops.geojson -> public/gtfs/stops.geojson
        Saved routes.geojson -> public/gtfs/routes.geojson
        Wrote timetable.bin and stops.bin for 2026-01-12 to public/gtfs
        Done.

4) 地図表示（路線色分け）と地点指定 UI を実装する。

    `public/gtfs/routes.geojson` を読み込み、`route_name` から色を決めて描画する。`public/gtfs/stops.geojson` を読み込み、停留所をマーカー表示し、クリックで「出発/経由/目的」を設定できるようにする（どれを設定するかは UI 側で現在の選択モードを持つ）。

5) 乗り換え検索を実装する。

    ブラウザ側で `public/gtfs/stops.bin` と `public/gtfs/timetable.bin` をロードし、`StopsIndex.fromData(...)` と `Timetable.fromData(...)` で復元して `Router` を作成する。入力（出発停留所、目的停留所集合、出発時刻、最大乗換回数など）から `Query.Builder()` を組み立て `router.route(query)` を実行する。経由地がある場合は 2 回実行し、経由地での滞在時間（分）を「到着時刻に加算して次クエリの出発時刻にする」ことで反映する。

6) 結果の地図ハイライトと旅程テキスト表示を実装する。

    `Result.bestRoute()` で得られる `Route` の `Leg`（乗車/徒歩）を、ユーザー向けの旅程モデルに変換する。地図では「利用した路線だけ強調（太線・高彩度）」「未利用路線は薄く表示」を行い、旅程テキストでは「出発→（徒歩/乗車）→到着」「路線名」「出発/到着時刻」「乗換地点」を列挙する。

7) テストを実装して受け入れ条件を固定する。

    - ユニット/統合: 小さな GTFS フィクスチャから前処理し、経由地滞在を含む探索結果が期待通りになることを検証する。
    - E2E: Playwright で画面を開き、地図クリックで地点指定→検索→地図とテキストが更新されることを検証する。

## Validation and Acceptance

受け入れ条件は「機能要件を満たすこと」と「ローカル動作確認でテストが全てパスすること」の両方を満たすこととする。

機能要件の合否は、少なくとも以下の観測可能な挙動で判定する。

出発地・経由地・目的地が、(1) 地図クリック、(2) 停留所名検索、の両方で指定できる。経由地の滞在時間（分）を入力すると、経由地到着後にその時間だけ待つ計画になり、次の便の出発時刻に反映される。

路線は地図上で路線ごとに色分けされて表示され、検索結果は「利用路線がハイライトされる」「乗り換え地点が分かる」「旅程テキストがシンプルに読める」形で提示される。

時刻表データは GTFS 形式で入手・利用している（GTFS ZIP を取得し、前処理して検索に使用している）。データの出典とライセンス表示（例: CC BY 2.1 JP）が UI 上に存在する。

自動テストは以下のコマンドで実行でき、全て成功する。

    pnpm lint
    pnpm test
    pnpm build

E2E テストがある場合は以下も成功する。

    pnpm test:e2e

## Idempotence and Recovery

GTFS 取得と前処理（`pnpm gtfs:sync`）は複数回実行しても安全に同じ出力を更新するようにする。失敗時は `public/gtfs/` を削除して再実行できるようにし、途中生成物（ダウンロードした ZIP 等）は `data/` 配下に置いて `gitignore` 対象にする。

Next.js の生成物（`.next/`）やテスト成果物は常に再生成可能であることを前提とし、リポジトリにコミットしない。

## Artifacts and Notes

知立市ミニバスの GTFS メタデータ取得（最新 UID と各種 URL を含む）:

    curl --compressed -sL 'https://api.gtfs-data.jp/v2/files?org_id=chiryucity'

上のレスポンスに含まれる `file_url` / `file_stop_url` / `file_route_url` をそのままダウンロードに使える。

## Interfaces and Dependencies

このマイルストンで採用する依存関係と、リポジトリ内で安定して存在させるインターフェースを明確にする。

依存ライブラリ（候補を含む）:

`minotor`（MIT）: GTFS の前処理（Node.js）と、経路探索（Browser/Node）に利用する。アプリ側は `GtfsParser`, `StopsIndex`, `Timetable`, `Router`, `Query`, `Time` を主に使う。

`react-leaflet` + `leaflet`: ルートのポリライン表示、停留所マーカー、地図クリック座標取得に利用する。

`zod`（任意）: GTFSデータリポジトリ API のレスポンスを型安全に扱うために利用する（壊れたレスポンス時のエラーを明確化）。

アプリ内インターフェース（実装時に作成する。パスは Next.js の `src/` 構成を前提とする）:

`src/lib/gtfsDataRepository.ts` に、知立市ミニバスの「最新ファイル情報」を取得する関数を定義する。

    export type GtfsRepoFile = {
      fileUid: string;
      feedZipUrl: string;
      stopsGeojsonUrl: string;
      routesGeojsonUrl: string;
      licenseId: string;
      licenseUrl: string;
      fromDate: string;
      toDate: string;
    };

    export async function fetchChiryuMiniBusFile(): Promise<GtfsRepoFile>;

`src/lib/routeColors.ts` に、`route_name` から表示色を決定する関数を定義する。

    export function routeNameToColorHex(routeName: string): string;

`src/lib/planner/itinerary.ts` に、UI 表示のための旅程モデルを定義する。

    export type ItineraryLeg =
      | {
          kind: 'vehicle';
          routeName: string;
          fromStopName: string;
          toStopName: string;
          departureTimeHHmm: string;
          arrivalTimeHHmm: string;
        }
      | {
          kind: 'transfer';
          fromStopName: string;
          toStopName: string;
          minTransferMinutes: number;
        };

    export type Itinerary = {
      legs: ItineraryLeg[];
      usedRouteNames: string[];
    };

`src/lib/planner/planTrip.ts` に、入力（出発/経由/目的、出発時刻、滞在時間）から `minotor` を使って `Itinerary` を返す関数を定義する。

    export type PlanTripInput = {
      fromStopId: string;
      viaStopId?: string;
      viaStayMinutes?: number;
      toStopId: string;
      departAtHHmm: string;
      maxTransfers: number;
    };

    export async function planTrip(input: PlanTripInput): Promise<Itinerary>;

この設計により、UI（React）と探索ロジック（planner）を分離し、ユニットテストで探索を検証しやすくする。

Update note (2026-01-12 07:03Z): Next.js 雛形とテスト基盤を構築し、Progress/Concrete Steps/Decision Log/Outcomes を更新した。
Update note (2026-01-12 07:14Z): GTFS 取得・前処理スクリプトを実装し、`pnpm gtfs:sync` で実データから GeoJSON/bin を生成できることを確認、各セクションを更新した。
Update note (2026-01-12 07:40Z): 地図 UI・旅程計算・テストを実装し、Leaflet の SSR 回避やルート名フォールバックを含む設計を確定、Progress/Surprises/Decision/Outcomes を更新した。
