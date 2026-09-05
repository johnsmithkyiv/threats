import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { load } from "cheerio";
import { COVERAGE_START, TELEGRAM_SOURCE_URL } from "../src/lib/threats";
import type { SourcePost, SourceStore } from "../src/types";

const STORE_PATH = resolve("data/source-posts.json");
const SEARCH_TERMS = ["Київ", "Києва", "Києві", "Києву"];
const RECENT_PAGE_LIMIT = 3;
const BACKFILL_PAGE_LIMIT = 80;
const REQUEST_DELAY_MS = 400;

type TelegramPage = {
  posts: SourcePost[];
  nextBefore: number | null;
};

async function main() {
  const backfill = process.argv.includes("--backfill");
  const store = await readStore();
  const postsById = new Map(store.posts.map((post) => [post.id, post]));
  let fetchedPages = 0;

  for (const query of SEARCH_TERMS) {
    if (backfill && store.queryState[query]?.complete) {
      continue;
    }

    let before = backfill ? store.queryState[query]?.nextBefore : undefined;
    const pageLimit = backfill ? BACKFILL_PAGE_LIMIT : RECENT_PAGE_LIMIT;

    for (let pageNumber = 0; pageNumber < pageLimit; pageNumber += 1) {
      const page = await fetchTelegramPage(query, before);
      fetchedPages += 1;

      for (const post of page.posts) {
        postsById.set(post.id, post);
      }

      if (!backfill) {
        if (!page.nextBefore) {
          break;
        }

        before = page.nextBefore;
        await delay(REQUEST_DELAY_MS);
        continue;
      }

      const oldestPost = page.posts.at(-1);
      const reachedCoverageStart = oldestPost ? oldestPost.publishedAt <= COVERAGE_START : true;

      if (!page.nextBefore || reachedCoverageStart) {
        store.queryState[query] = { complete: true };
        break;
      }

      store.queryState[query] = { nextBefore: page.nextBefore, complete: false };
      before = page.nextBefore;
      await delay(REQUEST_DELAY_MS);
    }
  }

  store.posts = Array.from(postsById.values()).sort((a, b) => a.id - b.id);
  await writeStore(store);

  console.log(`Collected ${store.posts.length.toLocaleString("en-US")} source posts across ${fetchedPages} Telegram pages.`);
}

async function fetchTelegramPage(query: string, before?: number): Promise<TelegramPage> {
  const url = new URL(`${TELEGRAM_SOURCE_URL}/s`);
  url.pathname = "/s/kpszsu";
  url.searchParams.set("q", query);

  if (before) {
    url.searchParams.set("before", String(before));
  }

  let response: Response | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KyivThreatReports/1.0)",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await delay(attempt * 1_000);
        continue;
      }

      break;
    }

    if (response.ok) {
      break;
    }

    if (attempt === 3) {
      throw new Error(`Telegram search failed for ${query}: ${response.status} ${response.statusText}`);
    }

    await delay(attempt * 1_000);
  }

  if (!response?.ok) {
    throw new Error(`Telegram search failed for ${query}.${lastError instanceof Error ? ` ${lastError.message}` : ""}`);
  }

  return parseTelegramPage(await response.text());
}

function parseTelegramPage(html: string): TelegramPage {
  const $ = load(html);
  const posts: SourcePost[] = [];

  $(".js-widget_message").each((_, element) => {
    const postReference = $(element).attr("data-post");
    const id = Number(postReference?.split("/").at(-1));
    const publishedAt = $(element).find("time").last().attr("datetime");
    const textElement = $(element).find(".media_supported_cont .js-message_text").first().length
      ? $(element).find(".media_supported_cont .js-message_text").first()
      : $(element).find(".js-message_text").not(".js-message_reply_text").first();
    const text = getTextWithLineBreaks($, textElement);

    if (!Number.isInteger(id) || !publishedAt || !text) {
      return;
    }

    posts.push({
      id,
      publishedAt,
      text,
      url: `${TELEGRAM_SOURCE_URL}/${id}`,
    });
  });

  const beforeHref = $("a.js-messages_more").first().attr("href");
  const nextBefore = beforeHref ? Number(new URL(beforeHref, TELEGRAM_SOURCE_URL).searchParams.get("before")) : NaN;

  return {
    posts: posts.sort((a, b) => b.id - a.id),
    nextBefore: Number.isInteger(nextBefore) ? nextBefore : null,
  };
}

function getTextWithLineBreaks($: ReturnType<typeof load>, element: ReturnType<ReturnType<typeof load>>): string {
  const copy = element.clone();
  copy.find("br").replaceWith("\n");
  return copy.text().replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function readStore(): Promise<SourceStore> {
  const parsed = JSON.parse(await readFile(STORE_PATH, "utf8")) as Partial<SourceStore>;

  if (parsed.version !== 1 || !Array.isArray(parsed.posts) || typeof parsed.queryState !== "object" || !parsed.queryState) {
    throw new Error("Unexpected source-post store format.");
  }

  return {
    version: 1,
    posts: parsed.posts,
    queryState: parsed.queryState,
  };
}

async function writeStore(store: SourceStore): Promise<void> {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(`${STORE_PATH}.tmp`, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(`${STORE_PATH}.tmp`, STORE_PATH);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
