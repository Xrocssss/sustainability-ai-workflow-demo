import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { boardApiUrl, dedupeJobs, normalizeBoardJobs, normalizeWorkdayJobs } from "../job-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, "sources.json"), "utf8"));
const catalogBase = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";
const catalogFiles = { greenhouse: "greenhouse_companies.json", lever: "lever_companies.json", ashby: "ashby_companies.json" };
const relevantBoard = /sustain|climat|carbon|decarbon|renew|energy|environmen|esg/i;
const workdayTerms = ["sustainability", "climate", "ESG", "carbon"];
const health = [];
const checkedAt = new Date().toISOString();

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(18000), ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 5_000_000) throw new Error("Response too large");
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error("Response too large");
  return JSON.parse(body);
}

async function pool(items, concurrency, visit) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) await visit(items[next++]);
  }));
}

const catalogStatus = {};
const boards = [...config.liveBoards];
for (const [ats, file] of Object.entries(catalogFiles)) {
  try {
    const slugs = await fetchJson(`${catalogBase}/${file}`);
    if (!Array.isArray(slugs)) throw new Error("Invalid catalog");
    const selected = slugs.filter((slug) => typeof slug === "string" && relevantBoard.test(slug)
      && !/test|impl|internship|gameday/i.test(slug)
      && /^[a-z0-9][a-z0-9.-]{1,79}$/i.test(slug)).slice(0, 150);
    boards.push(...selected.map((slug) => ({ ats, slug, company: `Board ${slug}` })));
    catalogStatus[ats] = `loaded ${selected.length} relevant-name boards`;
  } catch (error) {
    catalogStatus[ats] = `unavailable: ${String(error.message).slice(0, 80)}`;
  }
}

const uniqueBoards = [...new Map(boards.map((board) => [`${board.ats}:${board.slug}`, board])).values()];
// Curated names win over catalog fallback labels.
for (const board of config.liveBoards) {
  const match = uniqueBoards.find((item) => item.ats === board.ats && item.slug === board.slug);
  if (match) match.company = board.company;
}

const jobs = [];
await pool(uniqueBoards, 7, async (board) => {
  try {
    const found = normalizeBoardJobs(board, await fetchJson(boardApiUrl(board)), checkedAt);
    if (found.length && board.ats === "greenhouse" && board.company.startsWith("Board ")) {
      try {
        const metadata = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board.slug}`);
        if (typeof metadata.name === "string" && metadata.name.trim().length <= 100)
          found.forEach((job) => { job.company = metadata.name.trim(); });
      } catch { /* The board slug remains visible when metadata is unavailable. */ }
    }
    jobs.push(...found);
    health.push({ source: `${board.ats}:${board.slug}`, status: "ok", matched: found.length });
  } catch (error) {
    health.push({ source: `${board.ats}:${board.slug}`, status: "failed", error: String(error.message).slice(0, 80) });
  }
});

const workdayQueries = config.workdayBoards.flatMap((board) => workdayTerms.map((term) => ({ board, term })));
await pool(workdayQueries, 6, async ({ board, term }) => {
  try {
    if (![board.tenant, board.instance, board.site].every((x) => /^[a-z0-9_-]{1,80}$/i.test(x))) throw new Error("Invalid Workday board");
    const url = `https://${board.tenant}.${board.instance}.myworkdayjobs.com/wday/cxs/${board.tenant}/${board.site}/jobs`;
    const payload = await fetchJson(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 20, offset: 0, searchText: term, appliedFacets: {} }) });
    const found = normalizeWorkdayJobs(board, payload, checkedAt);
    jobs.push(...found);
    health.push({ source: `workday:${board.tenant}:${term}`, status: "ok", matched: found.length,
      available: Number(payload.total) || 0, pageLimit: 20 });
  } catch (error) {
    health.push({ source: `workday:${board.tenant}:${term}`, status: "failed", error: String(error.message).slice(0, 80) });
  }
});

const sorted = dedupeJobs(jobs);
if (sorted.length < 10) throw new Error(`Only ${sorted.length} live vacancies found; retaining the previous published feed`);
const failed = health.filter((item) => item.status === "failed").length;
const feed = {
  generatedAt: checkedAt,
  jobs: sorted.slice(0, 1200),
  meta: {
    boardsChecked: uniqueBoards.length + config.workdayBoards.length,
    requests: health.length,
    succeeded: health.length - failed,
    failed,
    partial: failed > 0 || sorted.length > 1200,
    scope: "Selected public ATS boards. Workday searches inspect the first 20 results per term; this is not a complete market search.",
    catalogStatus,
    sourceHealth: health,
  },
};
await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data", "jobs.json"), `${JSON.stringify(feed, null, 2)}\n`, "utf8");
console.log(`Verified public ATS feed: ${feed.jobs.length} jobs, ${feed.meta.boardsChecked} boards, ${failed} failed requests`);
