import assert from "node:assert/strict";
import test from "node:test";
import { boardApiUrl, canonicalUrl, dedupeJobs, freshnessSortValue, isCoreTitle, matchesTitle, normalizeBoardJobs, normalizeWorkdayJobs, safePublishedUrl } from "../job-core.mjs";

test("only relevant titles pass; climate-office assistant does not", () => {
  assert.equal(matchesTitle("Climate Risk Consultant"), true);
  assert.equal(matchesTitle("Sustainability Analyst"), true);
  assert.equal(matchesTitle("Executive Assistant & Office Manager (Climate Tech)"), false);
  assert.equal(matchesTitle("Backend Engineer"), false);
  assert.equal(isCoreTitle("Climate Risk Consultant"), true);
  assert.equal(isCoreTitle("Environmental Technician"), false);
});

test("board URLs are fixed-host and job links reject non-ATS destinations", () => {
  assert.equal(boardApiUrl({ ats: "ashby", slug: "seismic-change.com" }), "https://api.ashbyhq.com/posting-api/job-board/seismic-change.com");
  assert.throws(() => boardApiUrl({ ats: "greenhouse", slug: "../internal" }));
  assert.equal(canonicalUrl("https://jobs.lever.co/example/123?utm_source=x", "lever"), "https://jobs.lever.co/example/123");
  assert.equal(canonicalUrl("https://127.0.0.1/private", "lever"), null);
  assert.equal(safePublishedUrl("https://erm.wd3.myworkdayjobs.com/erm_careers/job/Example_R1", "workday"), true);
  assert.equal(safePublishedUrl("https://example.com/private", "workday"), false);
});

test("public ATS normalization preserves evidence and deduplicates tracking variants", () => {
  const source = { ats: "greenhouse", slug: "example", company: "Example" };
  const rows = normalizeBoardJobs(source, { jobs: [
    { title: "ESG Reporting Lead", absolute_url: "https://job-boards.greenhouse.io/example/jobs/123?gh_src=abc", location: { name: "Toronto" }, updated_at: "2026-09-30" },
    { title: "ESG Reporting Lead", absolute_url: "https://job-boards.greenhouse.io/example/jobs/123?gh_src=xyz", location: { name: "Toronto" }, updated_at: "2026-09-30" },
    { title: "Office Manager Climate", absolute_url: "https://job-boards.greenhouse.io/example/jobs/456" },
  ] }, "2026-10-01T00:00:00.000Z");
  assert.equal(rows.length, 2);
  assert.equal(dedupeJobs(rows).length, 1);
  assert.equal(rows[0].dateKind, "updated");
  assert.equal(rows[0].location, "Toronto");
});

test("Workday result keeps employer path and source date wording without inventing a date", () => {
  const board = { tenant: "erm", instance: "wd3", site: "erm_careers", company: "ERM" };
  const rows = normalizeWorkdayJobs(board, { jobPostings: [
    { title: "Climate Consultant", externalPath: "/job/London/Climate-Consultant_R123", locationsText: "London", postedOn: "Posted Today" },
    { title: "Climate Consultant", externalPath: "https://internal.example/test", locationsText: "London" },
  ] }, "2026-10-01T00:00:00.000Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, "https://erm.wd3.myworkdayjobs.com/erm_careers/job/London/Climate-Consultant_R123");
  assert.equal(rows[0].datedAt, null);
  assert.equal(rows[0].dateLabel, "Posted Today");
});

test("exact Workday recency labels sort above older dated roles; 30+ remains unknown", () => {
  const checkedAt = "2026-10-01T12:00:00.000Z";
  const today = { id: "today", company: "A", datedAt: null, dateKind: "source-label", dateLabel: "Posted Today", checkedAt };
  const lastWeek = { id: "week", company: "B", datedAt: null, dateKind: "source-label", dateLabel: "Posted 8 Days Ago", checkedAt };
  const old = { id: "old", company: "C", datedAt: "2024-01-01T00:00:00.000Z", dateKind: "posted", checkedAt };
  const unknown = { id: "unknown", company: "D", datedAt: null, dateKind: "source-label", dateLabel: "Posted 30+ Days Ago", checkedAt };
  assert.deepEqual(dedupeJobs([unknown, old, lastWeek, today]).map((job) => job.id), ["today", "week", "old", "unknown"]);
  assert.equal(freshnessSortValue(unknown), "");
  assert.equal(today.datedAt, null);
});
