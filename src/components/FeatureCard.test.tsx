import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureCard } from "./FeatureCard";

describe("FeatureCard", () => {
  it("renders title and description", () => {
    render(
      <FeatureCard
        title="地図と旅程 UI"
        description="地図、停留所、旅程テキストの枠組みを表現するカード"
      />,
    );

    expect(screen.getByText("地図と旅程 UI")).toBeInTheDocument();
    expect(
      screen.getByText("地図、停留所、旅程テキストの枠組みを表現するカード"),
    ).toBeInTheDocument();
  });

  it("shows badge when provided", () => {
    render(
      <FeatureCard
        title="GTFS 処理"
        description="フィード前処理と minotor の準備"
        badge="Next milestone"
      />,
    );

    expect(screen.getByText("Next milestone")).toBeInTheDocument();
  });
});
