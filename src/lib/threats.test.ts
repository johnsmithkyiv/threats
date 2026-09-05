import { describe, expect, it } from "vitest";
import { buildDashboardData, classifyThreatTypes, getThreatEpisodes, getThreatObservations, isKyivCityTarget } from "./threats";
import type { SourcePost } from "../types";

function sourcePost(id: number, publishedAt: string, text: string): SourcePost {
  return { id, publishedAt, text, url: `https://t.me/kpszsu/${id}` };
}

describe("Kyiv City threat classifier", () => {
  it("includes an explicit direction toward Kyiv City", () => {
    expect(isKyivCityTarget("Реактивний БпЛА курсом на Київ з півдня.")).toBe(true);
  });

  it("excludes Kyiv Oblast without a direction to the city", () => {
    expect(isKyivCityTarget("БпЛА на Київщині, курс на Бровари.")).toBe(false);
  });

  it("classifies the requested weapon categories", () => {
    expect(classifyThreatTypes("Реактивний БпЛА курсом на Київ.")).toEqual(["jet-drone"]);
    expect(classifyThreatTypes("Ударні БпЛА курсом на Київ.")).toEqual(["attack-drone"]);
    expect(classifyThreatTypes("Баражуючі боєприпаси Бандероль на Київ.")).toEqual(["banderol"]);
    expect(classifyThreatTypes("Крилата ракета курсом на Київ.")).toEqual(["cruise-missile"]);
    expect(classifyThreatTypes("Балістика в напрямку Києва.")).toEqual(["ballistic-missile"]);
  });

  it("groups repeated reports of one type into an episode", () => {
    const observations = getThreatObservations([
      sourcePost(1, "2026-09-05T01:00:00.000Z", "БпЛА курсом на Київ."),
      sourcePost(2, "2026-09-05T02:30:00.000Z", "БпЛА курсом на Київ."),
    ]);

    expect(getThreatEpisodes(observations)).toHaveLength(1);
  });

  it("aggregates episodes by Kyiv calendar day", () => {
    const dashboard = buildDashboardData([sourcePost(1, "2026-09-05T01:00:00.000Z", "БпЛА курсом на Київ.")], "2026-09-05T02:00:00.000Z", false);

    expect(dashboard.daily[0]?.categories["attack-drone"]).toBe(1);
  });
});
