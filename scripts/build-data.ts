import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DateTime } from "luxon";
import { buildDashboardData } from "../src/lib/threats";
import type { DashboardData, SourceStore } from "../src/types";

const STORE_PATH = resolve("data/source-posts.json");
const OUTPUT_PATH = resolve("public/data/kyiv-threats-dashboard.json");

async function main() {
  const store = JSON.parse(await readFile(STORE_PATH, "utf8")) as SourceStore;
  const collectionComplete = store.queryState.archive?.complete === true;
  const dashboardData = buildDashboardData(store.posts, DateTime.utc().toISO() ?? new Date().toISOString(), collectionComplete);

  const existingData = await readExistingDashboardData();

  if (existingData && isDashboardDataUnchanged(existingData, dashboardData)) {
    console.log(`Dashboard data is unchanged; keeping ${OUTPUT_PATH}.`);
    return;
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(dashboardData, null, 2)}\n`, "utf8");
  await rename(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);

  console.log(
    `Generated ${OUTPUT_PATH} from ${dashboardData.metadata.totalEpisodes.toLocaleString("en-US")} Kyiv City threat episodes and ${dashboardData.metadata.totalObservations.toLocaleString("en-US")} source observations.`,
  );
}

async function readExistingDashboardData(): Promise<DashboardData | null> {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as DashboardData;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isDashboardDataUnchanged(existing: DashboardData, next: DashboardData): boolean {
  const { generatedAt: existingGeneratedAt, ...existingMetadata } = existing.metadata;
  const { generatedAt: nextGeneratedAt, ...nextMetadata } = next.metadata;

  return JSON.stringify({ ...existing, metadata: existingMetadata }) === JSON.stringify({ ...next, metadata: nextMetadata });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
