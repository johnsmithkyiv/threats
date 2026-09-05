import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DateTime } from "luxon";
import { buildDashboardData } from "../src/lib/threats";
import type { SourceStore } from "../src/types";

const STORE_PATH = resolve("data/source-posts.json");
const OUTPUT_PATH = resolve("public/data/kyiv-threats-dashboard.json");

async function main() {
  const store = JSON.parse(await readFile(STORE_PATH, "utf8")) as SourceStore;
  const collectionComplete = store.queryState.archive?.complete === true;
  const dashboardData = buildDashboardData(store.posts, DateTime.utc().toISO() ?? new Date().toISOString(), collectionComplete);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(dashboardData, null, 2)}\n`, "utf8");
  await rename(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);

  console.log(
    `Generated ${OUTPUT_PATH} from ${dashboardData.metadata.totalEpisodes.toLocaleString("en-US")} Kyiv City threat episodes and ${dashboardData.metadata.totalObservations.toLocaleString("en-US")} source observations.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
