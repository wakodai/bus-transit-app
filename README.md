# 知立市ミニバス乗り換え案内（開発版）

Next.js 16 + TypeScript + Tailwind CSS v4 で作る知立市ミニバス向け乗り換え案内 SPA のリポジトリです。GTFS-JP を前処理して地図と旅程を表示することを目指し、`ExecPlan` に沿ってマイルストーンごとに進めます。

## セットアップ

リポジトリ直下で依存をインストールします。

    pnpm install

開発サーバーを起動します。

    pnpm dev

ブラウザで http://localhost:3000 を開くとプレースホルダー UI が表示されます。

## 品質チェック

    pnpm lint   # ESLint
    pnpm test   # Vitest + React Testing Library
    pnpm build  # Next.js 本番ビルド

## GTFS データ同期

知立市ミニバスの GTFS-JP を取得し、minotor 用のバイナリと GeoJSON を生成するスクリプトを用意しています。

    pnpm gtfs:sync

`public/gtfs/` 配下に `timetable.bin` / `stops.bin` / `routes.geojson` / `stops.geojson` / `metadata.json` を出力します。ダウンロード済みの ZIP は `data/gtfs/` にキャッシュされます（どちらも `.gitignore` 済み）。

## ディレクトリ

- `src/app` — Next.js App Router のルート。トップページはここにあります。
- `src/components` — UI コンポーネント。FeatureCard など。
- `src/test` — テストのセットアップ（jest-dom などの拡張を読み込み）。
- `.agent/ExecPlan01.md` — 作業計画。常に最新状態に更新します。

## これから実装すること（抜粋）

- GTFSデータリポジトリからのフィード取得と `minotor` 用バイナリ生成スクリプト
- React Leaflet を使った停留所選択と路線色分け表示
- 経由地と滞在時間を含む乗り換え検索ロジックと旅程表示
