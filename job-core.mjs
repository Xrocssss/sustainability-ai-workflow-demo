const relevant = /sustainab|climat|\besg\b|carbon|decarbon|net[\s-]?zero|energy[\s-]?transition|environmen|emission|renewab|biodivers|impact[\s-]?invest|clean[\s-]?energy|\bghg\b/i;
const irrelevant = /executive assistant|office manager/i;
const coreTopic = /sustainab|climat|\besg\b|carbon|decarbon|net[\s-]?zero|energy[\s-]?transition|emission|impact[\s-]?invest|\bghg\b|biodivers/i;
const hosts = {
  greenhouse: /^(?:job-boards(?:\.eu)?|boards)\.greenhouse\.io$/,
  lever: /^jobs\.(?:eu\.)?lever\.co$/,
  ashby: /^jobs\.ashbyhq\.com$/,
};

const clean = (value, max = 180) => String(value ?? "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, max);
export const matchesTitle = (title) => relevant.test(String(title ?? "")) && !irrelevant.test(String(title ?? ""));
export const isCoreTitle = (title) => coreTopic.test(String(title ?? ""));

export function safePublishedUrl(raw, ats) {
  if (ats !== "workday") return Boolean(canonicalUrl(raw, ats));
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && /^[a-z0-9-]+\.wd[0-9a-z-]+\.myworkdayjobs\.com$/i.test(url.hostname)
      && /^\/[^/]+\/job\//.test(url.pathname);
  } catch { return false; }
}

export function canonicalUrl(raw, ats) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !hosts[ats]?.test(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch { return null; }
}

export function boardApiUrl(board) {
  if (!/^[a-z0-9][a-z0-9.-]{1,79}$/i.test(board.slug)) throw new Error("Invalid public board slug");
  if (board.ats === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs`;
  if (board.ats === "lever") return `https://api.lever.co/v0/postings/${board.slug}`;
  if (board.ats === "ashby") return `https://api.ashbyhq.com/posting-api/job-board/${board.slug}`;
  throw new Error("Unsupported public ATS");
}

function isoDate(raw) {
  if (raw == null || raw === "") return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeBoardJobs(board, payload, checkedAt) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.jobs) ? payload.jobs : [];
  return rows.flatMap((item) => {
    if (board.ats === "ashby" && item.isListed === false) return [];
    const title = clean(board.ats === "lever" ? item.text : item.title);
    if (!matchesTitle(title)) return [];
    const rawUrl = board.ats === "greenhouse" ? item.absolute_url : board.ats === "lever" ? item.hostedUrl : item.jobUrl;
    const url = canonicalUrl(rawUrl, board.ats);
    if (!url) return [];
    const locations = board.ats === "greenhouse" ? [item.location?.name]
      : board.ats === "lever" ? [item.categories?.location, ...(item.categories?.allLocations || [])]
      : [item.location, ...(item.secondaryLocations || []).map((x) => typeof x === "string" ? x : x?.location)];
    const location = [...new Set(locations.map((x) => clean(x, 100)).filter(Boolean))].join("; ") || "Location not supplied";
    const datedAt = isoDate(board.ats === "greenhouse" ? item.updated_at : board.ats === "lever" ? item.createdAt : item.publishedAt);
    return [{ id: url, title, company: clean(board.company || `Board ${board.slug}`, 100), location,
      url, ats: board.ats, board: board.slug, datedAt,
      dateKind: datedAt ? (board.ats === "greenhouse" ? "updated" : "posted") : "unknown",
      checkedAt }];
  });
}

export function normalizeWorkdayJobs(board, payload, checkedAt) {
  if (![board.tenant, board.instance, board.site].every((x) => /^[a-z0-9_-]{1,80}$/i.test(x))) throw new Error("Invalid Workday board");
  const base = `https://${board.tenant}.${board.instance}.myworkdayjobs.com`;
  return (Array.isArray(payload?.jobPostings) ? payload.jobPostings : []).flatMap((item) => {
    const title = clean(item.title);
    if (!matchesTitle(title) || typeof item.externalPath !== "string" || !/^\/job\//.test(item.externalPath)) return [];
    const url = `${base}/${board.site}${item.externalPath}`;
    return [{ id: url, title, company: clean(board.company, 100), location: clean(item.locationsText, 180) || "Location not supplied",
      url, ats: "workday", board: `${board.tenant}|${board.instance}|${board.site}`, datedAt: null,
      dateKind: "source-label", dateLabel: clean(item.postedOn, 60) || "Freshness unknown", checkedAt }];
  });
}

export function dedupeJobs(jobs) {
  return [...new Map(jobs.map((job) => [job.id, job])).values()]
    .sort((a, b) => freshnessSortValue(b).localeCompare(freshnessSortValue(a)) || a.company.localeCompare(b.company));
}

// Use exact relative Workday labels only for ordering. Display the source label unchanged.
export function freshnessSortValue(job) {
  if (job.datedAt && Number.isFinite(Date.parse(job.datedAt))) return job.datedAt;
  if (job.dateKind !== "source-label" || !job.checkedAt || !Number.isFinite(Date.parse(job.checkedAt))) return "";
  const label = String(job.dateLabel || "").toLowerCase();
  const days = label === "posted today" ? 0 : label === "posted yesterday" ? 1
    : /^posted (\d{1,2}) days? ago$/.test(label) ? Number(label.match(/\d+/)[0]) : null;
  if (days === null || days > 29) return "";
  return new Date(Date.parse(job.checkedAt) - days * 86_400_000).toISOString();
}
