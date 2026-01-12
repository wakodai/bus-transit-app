# クリック地点に対する停留所候補を路線接続性で最適化する

この ExecPlan は生きた文書であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を作業に合わせて更新し続ける必要があります。

このリポジトリには `.agent/PLANS.md` があるため、この文書は同ファイルの要件に従って維持します。

## Purpose / Big Picture

地図クリックで出発地・目的地・経由地を選ぶ際、単純な最寄り距離ではなく路線接続性（乗れる経路があるか、所要時間や乗り換え回数が妥当か）を考慮して停留所を選べるようにします。これにより、橋の反対側や逆方向の停留所が選ばれて大回りになる、経由地が路線外になり経路が見つからない、といったユーザーの懸念を軽減します。変更後は、地図上の任意の地点をクリックしても、既に指定済みの出発地・目的地との接続性を評価した上で候補停留所が選定されることを、UI上の選択結果と経路検索の成功率で確認できます。

## Progress

- [x] (2025-02-14 01:00Z) 現状の停留所選択ロジックとルーティング API を調査し、導入ポイントを整理する。
- [x] (2025-02-14 01:10Z) ルーターの再利用とクエリ生成を共通化し、選定ロジックで使える形にする。
- [x] (2025-02-14 01:25Z) 距離と路線接続性を組み合わせた停留所候補のスコアリング関数を実装する。
- [x] (2025-02-14 01:40Z) 地図クリック時の選定処理とUI表示を更新し、失敗時のフォールバックを整える。
- [x] (2025-02-14 02:10Z) 変更内容を検証し、必要ならスクリーンショットとテスト結果を記録する。

## Surprises & Discoveries

- Observation: 時刻の加算は `Time.plus` に `Duration` を渡す必要があり、`plusMinutes` のようなヘルパーは存在しなかった。
  Evidence: `node_modules/minotor/src/timetable/time.ts` に `plus` メソッドのみが定義されていた。

## Decision Log

- Decision: 地図クリック時の候補は「近い停留所の中から路線接続性スコアで選ぶ」方式にする。
  Rationale: 距離と接続性の両方を考慮しつつ、計算量を抑えて体感速度を維持できるため。
  Date/Author: 2025-02-14 / ChatGPT
- Decision: スコアは所要時間 + 乗り換え回数ペナルティ + 距離係数で構成し、経路が見つからない場合は距離ベースにフォールバックする。
  Rationale: 接続性がある候補を優先しつつ、経路が存在しない場合でも最寄り停留所を返すことで UX を破綻させないため。
  Date/Author: 2025-02-14 / ChatGPT

## Outcomes & Retrospective

地図クリック時に複数停留所を評価して接続性の高い候補を選ぶロジックを導入し、選定中の UI 表示も追加できた。ルーター共有化により計算コストを抑えつつ、経路が見つからない場合の距離フォールバックで安全性を担保した。残作業はなく、今後はスコア係数の調整や UI で候補一覧を出す拡張が検討余地として残る。

## Context and Orientation

停留所選択は `src/app/page.tsx` の `handleMapPick` で行われており、現在は `StopsIndex.findStopsByLocation` の最寄り 1 件だけを採用しています。経路検索は `src/lib/planner/planTrip.ts` が `minotor` の `Router` と `Query` を用いて実施しています。GTFS データの読み込みは `src/lib/gtfsLocalClient.ts` にあり、`loadStopsIndex` と `loadTimetable` がバイナリを読み込んでキャッシュしています。今回の変更では、地図クリック時に複数候補を取得し、既存の経路計算を使ってスコアリングしたうえで採用する停留所を決めます。

## Plan of Work

まずルーティングに必要な共通処理（Router のキャッシュ、時刻文字列のパース、クエリ生成）を `src/lib/planner` 配下に切り出し、`planTrip` と新しい選定ロジックの双方で使えるようにします。次に、地図クリック地点の近傍停留所を複数取得し、既存の出発地・目的地・経由地の指定状況に応じて経路が成立するかを評価するスコアリング関数を実装します。スコアは所要時間、乗り換え回数、クリック地点からの距離を組み合わせ、経路が見つからない場合は距離のみでフォールバックするルールにします。最後に `src/app/page.tsx` で地図クリック時の非同期選定を行い、選定中の状態表示やエラーメッセージを整理します。

## Concrete Steps

作業はすべてリポジトリのルート `/workspace/bus-transit-app` で行います。

1) `src/lib/planner/routingUtils.ts` を作成し、`loadRouter`（Router のキャッシュを返す関数）、`parseHHmm`、`buildQuery`、`DEFAULT_MIN_TRANSFER_MINUTES` を実装する。
2) `src/lib/planner/planTrip.ts` を更新し、上記ユーティリティを利用するよう置き換える。
3) `src/lib/planner/selectStopCandidate.ts` を作成し、複数候補のスコアリングと最適停留所の選択ロジックを実装する。
4) `src/app/page.tsx` の `handleMapPick` を非同期にし、選定ロジックを呼び出すよう変更する。必要に応じて UI に選定中の表示を追加する。
5) ローカルで lint/test を実行する場合は `pnpm test` または `pnpm lint` を使い、結果を記録する。スクリーンショットが必要なら開発サーバー起動後に取得する。

## Validation and Acceptance

地図クリックで停留所を指定した際、すでに指定済みの出発地・目的地と接続できる候補が優先され、経路検索が失敗しにくくなることを確認します。具体的には、出発地と目的地が決まっている状態で中間地点をクリックし、クリック位置から近い複数停留所のうち経路が成立する停留所が選択されることを UI の選択結果で確認します。テストを実施する場合は `pnpm test` を実行し、全テストが成功することを期待します。

## Idempotence and Recovery

`loadRouter` はキャッシュ済みの Router を再利用するため、複数回呼び出しても安全です。停留所選定ロジックが期待通り動かない場合は、地図クリック時に距離ベースの選択に戻すだけで安全に巻き戻せます。

## Artifacts and Notes

- 変更点は `src/lib/planner/selectStopCandidate.ts` と `src/app/page.tsx` に集約される。

## Interfaces and Dependencies

`src/lib/planner/routingUtils.ts` に以下の関数と定数を定義する。

  export const DEFAULT_MIN_TRANSFER_MINUTES: number

  export async function loadRouter(): Promise<Router>

  export function parseHHmm(value: string): Time

  export function buildQuery(params: {
    from: string;
    to: string;
    departure: Time;
    maxTransfers: number;
    minTransferMinutes: number;
  }): Query

`src/lib/planner/selectStopCandidate.ts` に以下の関数を定義する。

  export async function selectStopByConnectivity(params: {
    lat: number;
    lon: number;
    stopsIndex: StopsIndex;
    selectionMode: "from" | "via" | "to";
    fromStopId?: string;
    toStopId?: string;
    departAtHHmm: string;
    viaStayMinutes: number;
    maxTransfers: number;
  }): Promise<Stop | null>


変更メモ: 実装完了に合わせて Progress を完了に更新し、成果・決定事項・発見事項を追記した。
