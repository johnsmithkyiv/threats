import { DateTime } from "luxon";
import { THREAT_CATEGORIES, type DashboardData, type PeriodStats, type SourcePost, type ThreatCategory, type ThreatEpisode, type ThreatObservation } from "../types";

export const KYIV_ZONE = "Europe/Kyiv";
export const COVERAGE_START = "2022-02-24T00:00:00.000+02:00";
export const TELEGRAM_SOURCE_URL = "https://t.me/kpszsu";

export const threatCategoryLabels: Record<ThreatCategory, string> = {
  "attack-drone": "Angrepsdroner",
  "jet-drone": "Jetdroner",
  banderol: "Banderol",
  "cruise-missile": "Kryssermissiler",
  "ballistic-missile": "Ballistiske missiler",
};

const KYIV_DIRECTION = /(?:на|до|курс(?:ом)?\s+на|у\s+напрямку(?:\s+до)?|повз|над)\s+(?:м\.\s*)?(?:київ|києва|києві|києву)(?![а-яіїєґ])/iu;
const KYIV_CITY_LOCATION = /(?:м\.\s*)?київ(?![а-яіїєґ])\s*[-—–:]/iu;
const KYIV_IN_CITY = /(?:у|в)\s+(?:м\.\s*)?києві(?![а-яіїєґ])/iu;
const JET_DRONE = /реактивн(?:ий|і|а)?\s+(?:бпла|безпілот)/iu;
const BANDEROL = /бандерол/iu;
const CRUISE_MISSILE = /(?:крилат[а-яіїєґ]*\s+ракет[а-яіїєґ]*|калібр|х[- ]?(?:101|555|59|69)|іскандер[- ]?к)/iu;
const BALLISTIC_MISSILE = /(?:баліст|кинджал|іскандер[- ]?м)/iu;
const ATTACK_DRONE = /(?:шахед|shahed|герань|ударн[а-яіїєґ]*\s+(?:бпла|безпілот)|(?<!реактивн\s)(?:бпла|безпілотник))/iu;
const EPISODE_WINDOW_MS = 2 * 60 * 60 * 1000;

type Period = "day" | "week" | "month";

export function isKyivCityTarget(text: string): boolean {
  return KYIV_DIRECTION.test(text) || KYIV_CITY_LOCATION.test(text) || KYIV_IN_CITY.test(text);
}

export function classifyThreatTypes(text: string): ThreatCategory[] {
  const categories = new Set<ThreatCategory>();

  if (JET_DRONE.test(text)) {
    categories.add("jet-drone");
  }

  if (BANDEROL.test(text)) {
    categories.add("banderol");
  }

  if (CRUISE_MISSILE.test(text)) {
    categories.add("cruise-missile");
  }

  if (BALLISTIC_MISSILE.test(text)) {
    categories.add("ballistic-missile");
  }

  if (ATTACK_DRONE.test(text) && !JET_DRONE.test(text)) {
    categories.add("attack-drone");
  }

  return Array.from(categories);
}

export function getThreatObservations(posts: SourcePost[]): ThreatObservation[] {
  const observations = new Map<string, ThreatObservation>();
  const coverageStart = DateTime.fromISO(COVERAGE_START);

  for (const sourcePost of posts) {
    const publishedAt = DateTime.fromISO(sourcePost.publishedAt);

    if (!publishedAt.isValid || publishedAt < coverageStart) {
      continue;
    }

    for (const sourceLine of sourcePost.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
      if (!isKyivCityTarget(sourceLine)) {
        continue;
      }

      for (const category of classifyThreatTypes(sourceLine)) {
        const key = `${sourcePost.id}:${category}`;
        observations.set(key, { category, sourcePost, sourceLine });
      }
    }
  }

  return Array.from(observations.values()).sort((a, b) => a.sourcePost.publishedAt.localeCompare(b.sourcePost.publishedAt));
}

export function getThreatEpisodes(observations: ThreatObservation[]): ThreatEpisode[] {
  const episodes: ThreatEpisode[] = [];
  const latestEpisodeByCategory = new Map<ThreatCategory, ThreatEpisode>();

  for (const observation of observations) {
    const startedAt = DateTime.fromISO(observation.sourcePost.publishedAt).toMillis();
    const previous = latestEpisodeByCategory.get(observation.category);

    if (
      previous &&
      previous.category === observation.category &&
      startedAt - DateTime.fromISO(previous.endedAt).toMillis() <= EPISODE_WINDOW_MS
    ) {
      previous.endedAt = observation.sourcePost.publishedAt;

      if (!previous.sourcePosts.some((sourcePost) => sourcePost.id === observation.sourcePost.id)) {
        previous.sourcePosts.push(observation.sourcePost);
      }

      continue;
    }

    const episode = {
      id: `${observation.category}-${observation.sourcePost.id}`,
      category: observation.category,
      startedAt: observation.sourcePost.publishedAt,
      endedAt: observation.sourcePost.publishedAt,
      sourcePosts: [observation.sourcePost],
    };
    episodes.push(episode);
    latestEpisodeByCategory.set(observation.category, episode);
  }

  return episodes.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function buildDashboardData(posts: SourcePost[], generatedAt: string, collectionComplete: boolean): DashboardData {
  const observations = getThreatObservations(posts);
  const episodes = getThreatEpisodes(observations);

  return {
    metadata: {
      generatedAt,
      coverageStart: COVERAGE_START,
      sourceName: "Ukrainian Air Force official Telegram channel",
      sourceUrl: TELEGRAM_SOURCE_URL,
      totalSourcePosts: posts.length,
      totalObservations: observations.length,
      totalEpisodes: episodes.length,
      latestSourceAt: posts.at(-1)?.publishedAt ?? null,
      collectionComplete,
    },
    daily: aggregateEpisodes(episodes, "day"),
    weekly: aggregateEpisodes(episodes, "week"),
    monthly: aggregateEpisodes(episodes, "month"),
    recentEpisodes: episodes.slice(-30).reverse(),
  };
}

function aggregateEpisodes(episodes: ThreatEpisode[], period: Period): PeriodStats[] {
  const periods = new Map<string, PeriodStats>();

  for (const episode of episodes) {
    const start = DateTime.fromISO(episode.startedAt, { setZone: true }).setZone(KYIV_ZONE).startOf(period);
    const id = period === "day" ? start.toISODate() : period === "week" ? start.toFormat("kkkk-'W'WW") : start.toFormat("yyyy-MM");

    if (!id) {
      continue;
    }

    const stats = periods.get(id) ?? createPeriodStats(start, period, id);
    stats.total += 1;
    stats.categories[episode.category] += 1;
    periods.set(id, stats);
  }

  return Array.from(periods.values()).sort((a, b) => a.start.localeCompare(b.start));
}

function createPeriodStats(start: DateTime, period: Period, id: string): PeriodStats {
  const end = period === "day" ? start.plus({ days: 1 }) : period === "week" ? start.plus({ weeks: 1 }) : start.plus({ months: 1 });

  return {
    id,
    label: period === "day" ? start.toFormat("d LLL yyyy") : period === "week" ? `Uke ${start.toFormat("WW, yyyy")}` : start.toFormat("LLLL yyyy"),
    start: start.toISODate() ?? id,
    end: end.minus({ milliseconds: 1 }).toISODate() ?? id,
    total: 0,
    categories: emptyCategories(),
  };
}

function emptyCategories(): Record<ThreatCategory, number> {
  return Object.fromEntries(THREAT_CATEGORIES.map((category) => [category, 0])) as Record<ThreatCategory, number>;
}
