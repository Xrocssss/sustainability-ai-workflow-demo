import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { matchesTitle, safePublishedUrl } from "../job-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const feed = JSON.parse(read("data/jobs.json"));

test("public site loads real source-linked jobs and offers a bounded live refresh", () => {
  const html = read("index.html");
  const js = read("app.js");
  assert.match(html, /Live public jobs/);
  assert.match(html, /Refresh 7 employer boards/);
  assert.match(js, /fetch\("data\/jobs\.json"/);
  assert.match(js, /boardApiUrl\(board\)/);
  assert.match(js, /Role \+ location match/);
  assert.match(html, /Used only in this tab to sort public jobs/);
  assert.doesNotMatch(html + js, /Synthetic records|Example Energy|Sample Finance|illustrative review state/);
  assert.doesNotMatch(html, /<img\b/);
});

test("published feed contains only valid public ATS links and unique relevant roles", () => {
  assert.ok(feed.jobs.length >= 20, `Only ${feed.jobs.length} published jobs`);
  assert.ok(Number.isFinite(Date.parse(feed.generatedAt)));
  assert.ok(feed.meta.boardsChecked >= 20);
  assert.equal(new Set(feed.jobs.map((job) => job.id)).size, feed.jobs.length);
  for (const job of feed.jobs) {
    assert.ok(matchesTitle(job.title), job.title);
    assert.ok(safePublishedUrl(job.url, job.ats), job.url);
    assert.ok(job.company && job.location && job.checkedAt);
    assert.ok(["posted", "updated", "source-label", "unknown"].includes(job.dateKind));
  }
});

test("public safety boundary excludes provider AI, uploads, CV generation and private paths", () => {
  const source = ["index.html", "app.js", "job-core.mjs", "styles.css", "README.md"].map(read).join("\n");
  assert.doesNotMatch(source, /\/api\/run|CAREER_OPS_ROOT|process\.env|child_process|api[_-]?key|auth[_-]?token|<input[^>]+type=["']file/i);
  assert.doesNotMatch(source, /[A-Z]:\\|localhost|127\.0\.0\.1:3000|tailscale|\bSaad\b|\bKPMG\b|\bgho_[A-Za-z0-9]+/i);
  assert.match(read("index.html"), /connect-src 'self' https:\/\/boards-api\.greenhouse\.io https:\/\/api\.lever\.co https:\/\/api\.ashbyhq\.com/);
  assert.match(read("index.html"), /CV creation is off for public visitors/);
});

test("visitor refresh is limited to seven named boards; broader scheduled scan stays separate", () => {
  const sources = JSON.parse(read("sources.json"));
  assert.equal(sources.liveBoards.length, 7);
  assert.ok(sources.workdayBoards.length >= 10);
  assert.ok(sources.liveBoards.every((board) => board.ats && board.slug && board.company));
  assert.match(read(".github/workflows/refresh-jobs.yml"), /schedule:/);
});
