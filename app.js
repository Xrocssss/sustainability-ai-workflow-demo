import { boardApiUrl, dedupeJobs, freshnessSortValue, isCoreTitle, normalizeBoardJobs, safePublishedUrl } from "./job-core.mjs";

const $ = (id) => document.getElementById(id);
const sections = ["run", "jobs", "cvs", "how"];
const state = { jobs: [], feed: null, boards: [], shown: 50, running: null, lastRefresh: 0,
  profile: { role: "", location: "" } };

function route() {
  const page = sections.includes(location.hash.slice(1)) ? location.hash.slice(1) : "run";
  for (const name of sections) {
    $(`${name}-view`).hidden = name !== page;
    document.querySelector(`[data-nav="${name}"]`)?.classList.toggle("active", name === page);
  }
  $("menu-button").setAttribute("aria-expanded", "false");
  document.querySelector(".nav")?.classList.remove("mobile-open");
  document.title = `${page === "how" ? "How it works" : page.toUpperCase()} — Sustainability AI Workflow`;
}

function dateText(job) {
  if (job.dateKind === "source-label") return job.dateLabel || "Freshness unknown";
  if (!job.datedAt) return "Freshness unknown";
  const date = new Date(job.datedAt);
  if (!Number.isFinite(date.getTime())) return "Freshness unknown";
  return `${job.dateKind === "updated" ? "Updated" : "Posted"} ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

function ageText(iso) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "Unknown";
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 3_600_000));
  if (hours < 1) return "<1 hour";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function focusScore(job) {
  const words = state.profile.role.toLowerCase().split(/\W+/).filter((word) => word.length >= 3);
  const title = job.title.toLowerCase();
  const role = words.reduce((score, word) => score + (title.includes(word) ? 2 : 0), 0);
  const place = state.profile.location.trim().toLowerCase();
  return role + (place && job.location.toLowerCase().includes(place) ? 1 : 0);
}

function focusLabel(job) {
  const roleWords = state.profile.role.toLowerCase().split(/\W+/).filter((word) => word.length >= 3);
  const role = roleWords.some((word) => job.title.toLowerCase().includes(word));
  const place = state.profile.location.trim().toLowerCase();
  const location = Boolean(place && job.location.toLowerCase().includes(place));
  return role && location ? "Role + location match" : role ? "Role match" : location ? "Location match" : "";
}

function matchingJobs() {
  const query = $("job-search").value.trim().toLowerCase();
  const coreOnly = $("job-scope").value === "core";
  return state.jobs.filter((job) => (!coreOnly || isCoreTitle(job.title))
    && `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(query))
    .sort((a, b) => focusScore(b) - focusScore(a)
      || freshnessSortValue(b).localeCompare(freshnessSortValue(a)) || a.company.localeCompare(b.company));
}

function renderJobs() {
  const matches = matchingJobs();
  const visible = matches.slice(0, state.shown);
  $("result-count").textContent = `${matches.length} source-linked jobs · showing ${visible.length}`;
  const cards = visible.map((job) => {
    const card = document.createElement("article"); card.className = "job-card";
    const copy = document.createElement("div");
    const title = document.createElement("h2"); title.textContent = job.title;
    const sub = document.createElement("p"); sub.textContent = `${job.company} · ${job.location}`;
    const evidence = document.createElement("small"); evidence.textContent = `${job.ats.toUpperCase()} · ${dateText(job)}`;
    copy.append(title, sub, evidence);
    const matchLabel = focusLabel(job);
    if (matchLabel) {
      const badge = document.createElement("span"); badge.className = "focus-badge";
      badge.textContent = matchLabel; copy.append(badge);
    }
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Review";
    button.setAttribute("aria-label", `Review ${job.title} at ${job.company}`);
    button.addEventListener("click", () => showJob(job));
    card.append(copy, button); return card;
  });
  $("job-list").replaceChildren(...cards);
  if (!visible.length) $("job-list").textContent = state.feed ? "No jobs match this view. Try another search or show adjacent roles." : "No published jobs are available yet.";
  $("show-more").hidden = visible.length >= matches.length;
  $("job-detail").hidden = true;
}

function showJob(job) {
  const detail = $("job-detail"); detail.replaceChildren();
  const title = document.createElement("h2"); title.textContent = `${job.title} · ${job.company}`;
  const note = document.createElement("p"); note.textContent = "Public ATS listing. Eligibility and fit are not verified by AI in this demo.";
  const facts = document.createElement("div"); facts.className = "detail-list";
  for (const [label, value] of [["Location", job.location], ["Source", `${job.ats.toUpperCase()} · ${job.board}`],
    ["Freshness", dateText(job)], ["Last checked", new Date(job.checkedAt).toLocaleString()]]) {
    const box = document.createElement("div"); const heading = document.createElement("strong"); heading.textContent = label;
    const body = document.createElement("span"); body.textContent = value; box.append(heading, body); facts.append(box);
  }
  const link = document.createElement("a"); link.className = "source-link"; link.textContent = "Open employer listing ↗";
  link.href = job.url; link.target = "_blank"; link.rel = "noopener noreferrer";
  detail.append(title, note, facts, link); detail.hidden = false;
  detail.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
}

function renderSummary() {
  $("job-count").textContent = String(state.jobs.length);
  $("core-count").textContent = String(state.jobs.filter((job) => isCoreTitle(job.title)).length);
  $("scan-age").textContent = ageText(state.feed?.generatedAt);
  const meta = state.feed?.meta;
  $("scan-coverage").textContent = meta ? `${meta.boardsChecked} boards checked` : "selected public boards";
  $("feed-note").textContent = meta
    ? `${state.jobs.length} real ATS listings · snapshot ${new Date(state.feed.generatedAt).toLocaleString()} · ${meta.failed} source requests unavailable. Listings may change; open the employer link to verify.`
    : "The public feed is unavailable. Use Run to check selected boards live.";
  $("source-health").textContent = meta
    ? `${meta.scope} ${meta.partial ? "Coverage is partial." : ""}`
    : "Selected public boards only; this is not a complete market search.";
  renderJobs();
}

async function loadFeed() {
  try {
    const [feedResponse, sourceResponse] = await Promise.all([
      fetch("data/jobs.json", { cache: "no-store" }), fetch("sources.json", { cache: "no-store" }),
    ]);
    if (!feedResponse.ok || !sourceResponse.ok) throw new Error("Published feed or source list unavailable");
    const [feed, source] = await Promise.all([feedResponse.json(), sourceResponse.json()]);
    if (!Array.isArray(feed.jobs) || !Array.isArray(source.liveBoards)) throw new Error("Published feed is malformed");
    state.feed = feed;
    state.boards = source.liveBoards.slice(0, 7);
    state.jobs = dedupeJobs(feed.jobs.filter((job) => job && typeof job.title === "string"
      && typeof job.company === "string" && typeof job.location === "string"
      && safePublishedUrl(job.url, job.ats))).slice(0, 1200);
    $("demo-run").textContent = `Refresh ${state.boards.length} employer boards`;
    $("run-message").textContent = `${state.jobs.length} real vacancies loaded. Source scan: ${ageText(feed.generatedAt)}. Live refresh checks ${state.boards.length} boards.`;
    renderSummary();
  } catch (error) {
    $("run-message").textContent = `Could not load the published jobs: ${error.message}. Try the live refresh.`;
    renderSummary();
  }
}

async function refreshBoards() {
  if (state.running) return;
  if (!state.boards.length) {
    $("run-message").textContent = "Source list unavailable. Reload this page before refreshing.";
    return;
  }
  if (Date.now() - state.lastRefresh < 45_000) {
    $("run-message").textContent = "Please wait 45 seconds between live refreshes.";
    return;
  }
  state.lastRefresh = Date.now();
  const controller = new AbortController(); state.running = controller;
  $("demo-run").disabled = true; $("stop-run").hidden = false;
  const timer = setTimeout(() => controller.abort(), 25_000);
  let next = 0, checked = 0, succeeded = 0, failed = 0;
  const fresh = [];
  $("run-message").textContent = `Checking ${state.boards.length} public employer boards…`;
  await Promise.all(Array.from({ length: Math.min(3, state.boards.length) }, async () => {
    while (next < state.boards.length && !controller.signal.aborted) {
      const board = state.boards[next++];
      try {
        const response = await fetch(boardApiUrl(board), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        fresh.push(...normalizeBoardJobs(board, await response.json(), new Date().toISOString()));
        succeeded++;
      } catch { failed++; }
      checked++;
      $("run-message").textContent = `Checked ${checked}/${state.boards.length} boards · ${succeeded} responded · ${fresh.length} relevant jobs`;
    }
  }));
  clearTimeout(timer);
  const stopped = controller.signal.aborted;
  if (fresh.length) state.jobs = dedupeJobs([...state.jobs, ...fresh]);
  renderSummary();
  $("run-message").textContent = stopped
    ? `Stopped after ${checked}/${state.boards.length} boards. ${fresh.length} live results retained.`
    : succeeded ? `Live refresh: ${succeeded}/${state.boards.length} boards responded · ${fresh.length} relevant roles · ${failed} failed. Other jobs remain from the published scan.`
      : "Live boards did not respond. The last published scan remains visible.";
  state.running = null; $("demo-run").disabled = false; $("stop-run").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  route(); renderJobs(); loadFeed();
  window.addEventListener("hashchange", route);
  $("menu-button").addEventListener("click", () => {
    const menu = document.querySelector(".nav"); const open = menu.classList.toggle("mobile-open");
    $("menu-button").setAttribute("aria-expanded", String(open));
  });
  $("job-search").addEventListener("input", () => { state.shown = 50; renderJobs(); });
  $("job-scope").addEventListener("change", () => { state.shown = 50; renderJobs(); });
  $("show-more").addEventListener("click", () => { state.shown += 50; renderJobs(); });
  for (const [id, key] of [["profile-role", "role"], ["profile-location", "location"]])
    $(id).addEventListener("input", (event) => { state.profile[key] = event.target.value; renderJobs(); });
  $("demo-run").addEventListener("click", refreshBoards);
  $("stop-run").addEventListener("click", () => state.running?.abort());
});
