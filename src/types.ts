export const THREAT_CATEGORIES = ["attack-drone", "jet-drone", "banderol", "cruise-missile", "ballistic-missile"] as const;

export type ThreatCategory = (typeof THREAT_CATEGORIES)[number];

export type SourcePost = {
  id: number;
  publishedAt: string;
  text: string;
  url: string;
};

export type QueryState = {
  nextBefore?: number;
  complete?: boolean;
};

export type SourceStore = {
  version: 1;
  queryState: Record<string, QueryState>;
  posts: SourcePost[];
};

export type ThreatObservation = {
  category: ThreatCategory;
  sourcePost: SourcePost;
  sourceLine: string;
};

export type ThreatEpisode = {
  id: string;
  category: ThreatCategory;
  startedAt: string;
  endedAt: string;
  sourcePosts: SourcePost[];
};

export type PeriodStats = {
  id: string;
  label: string;
  start: string;
  end: string;
  total: number;
  categories: Record<ThreatCategory, number>;
};

export type DashboardData = {
  metadata: {
    generatedAt: string;
    coverageStart: string;
    sourceName: string;
    sourceUrl: string;
    totalSourcePosts: number;
    totalObservations: number;
    totalEpisodes: number;
    latestSourceAt: string | null;
    collectionComplete: boolean;
  };
  daily: PeriodStats[];
  weekly: PeriodStats[];
  monthly: PeriodStats[];
  recentEpisodes: ThreatEpisode[];
};
