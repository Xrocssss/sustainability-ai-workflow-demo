"use strict";

// Every item is deliberately synthetic. This file has no network or storage API.
const jobs = [
  { id: "example-energy", company: "Example Energy", role: "Climate Risk Consultant", place: "London · example", score: "4.2/5", source: "Employer ATS · example", evidence: "Relevant climate-risk and reporting experience", gap: "Managerial scope needs review", unknown: "Sponsorship and language are unconfirmed" },
  { id: "sample-finance", company: "Sample Finance", role: "Sustainable Finance Analyst", place: "Toronto · example", score: "3.9/5", source: "Employer ATS · example", evidence: "Sustainable-finance experience is relevant", gap: "Banking-specific requirements need review", unknown: "Work authorization is unconfirmed" },
  { id: "demo-advisory", company: "Demo Advisory", role: "ESG Reporting Manager", place: "Copenhagen · example", score: "—", source: "Employer ATS · example", evidence: "Not evaluated in this preview", gap: "Senior scope may be a stretch", unknown: "Language requirement is unconfirmed" },
];

const sections = ["run", "jobs", "cvs", "how"];
const $ = (id) => document.getElementById(id);
function route() {
  const page = sections.includes(location.hash.slice(1)) ? location.hash.slice(1) : "run";
  for (const name of sections) {
    $(`${name}-view`).hidden = name !== page;
    document.querySelector(`[data-nav="${name}"]`)?.classList.toggle("active", name === page);
  }
  $("menu-button").setAttribute("aria-expanded", "false");
  document.querySelector(".nav")?.classList.remove("mobile-open");
  document.title = `${page === "how" ? "How it works" : page.toUpperCase()} — Sustainability AI Workflow Preview`;
}
function renderJobs(query = "") {
  const normalized = query.trim().toLocaleLowerCase();
  const matches = jobs.filter((job) => `${job.company} ${job.role}`.toLocaleLowerCase().includes(normalized));
  $("job-list").replaceChildren(...matches.map((job) => {
    const card = document.createElement("article"); card.className = "job-card";
    const copy = document.createElement("div");
    const title = document.createElement("h2"); title.textContent = job.role;
    const sub = document.createElement("p"); sub.textContent = `${job.company} · ${job.place}`;
    const source = document.createElement("small"); source.textContent = job.source;
    copy.append(title, sub, source);
    const score = document.createElement("strong"); score.className = "score"; score.textContent = job.score;
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Review";
    button.setAttribute("aria-label", `Review ${job.role} at ${job.company}`);
    button.addEventListener("click", () => showJob(job));
    card.append(copy, score, button); return card;
  }));
  if (!matches.length) $("job-list").textContent = "No example jobs match your search.";
  $("job-detail").hidden = true;
}
function showJob(job) {
  const detail = $("job-detail"); detail.replaceChildren();
  const title = document.createElement("h2"); title.textContent = `${job.role} · ${job.company}`;
  const note = document.createElement("p"); note.textContent = "Illustrative evaluation. No live vacancy or AI call is involved.";
  const list = document.createElement("div"); list.className = "detail-list";
  for (const [label, value] of [["Evidence", job.evidence], ["Gap", job.gap], ["Unknown", job.unknown]]) {
    const item = document.createElement("div"); const heading = document.createElement("strong"); heading.textContent = label;
    const body = document.createElement("span"); body.textContent = value; item.append(heading, body); list.append(item);
  }
  detail.append(title, note, list); detail.hidden = false; detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
document.addEventListener("DOMContentLoaded", () => {
  route(); renderJobs();
  window.addEventListener("hashchange", route);
  $("job-search").addEventListener("input", (event) => renderJobs(event.target.value));
  $("demo-run").addEventListener("click", () => { $("run-message").textContent = "AI scoring is disabled in this public preview. Open Jobs to inspect synthetic examples."; });
  $("menu-button").addEventListener("click", () => {
    const menu = document.querySelector(".nav"); const open = menu.classList.toggle("mobile-open");
    $("menu-button").setAttribute("aria-expanded", String(open));
  });
});
