# Sustainability AI Workflow — live public job demo

This is a public, early-stage demo adapted from [Career-Ops](https://github.com/career-ops-hq/career-ops). Visitors can browse actual public job listings without signing in, filter them, open the employer's ATS page, and refresh seven named employer boards on demand. The published snapshot is refreshed twice daily by GitHub Actions. It scans selected Greenhouse, Lever, Ashby, and Workday boards; it is not a complete search of the job market.

The **Run** button checks seven public employer boards without spending AI tokens. **Jobs** shows source-linked listings and their reported posting or update information. A role/location focus can change the order in this browser tab; it is not uploaded or saved as a profile. **CVs** explains that document generation is unavailable in the public demo. No application or message is sent. AI scoring and CV creation are off for public visitors while the private backend remains in development.

Listings may close or change between scans. Open the employer listing to confirm availability, location, and eligibility. The Workday scan examines only the first 20 results for each configured search term on selected boards. Failed source requests and partial coverage are shown in the interface. Public refresh checks only seven boards to bound traffic; it does not update the scheduled snapshot for other visitors.

## Run locally

From this repository, run `python -m http.server 8765` and open the address printed by Python. A local static server is required because the page loads JavaScript modules and JSON files. Run `node --test tests/*.test.mjs` to check the public data contract. Run `node scripts/refresh-jobs.mjs` to rebuild the public snapshot from current ATS results. Node.js 22 or newer is recommended.

## Data and provenance

`data/jobs.json` contains only public employer/ATS job fields and scan health. `sources.json` contains public board identifiers. The feed collector reads a public board-name directory and the configured public ATS endpoints; it does not read the private personal Career-Ops installation. The repository contains no CV, tracker, provider credentials, or AI endpoint. See [ATTRIBUTION.md](ATTRIBUTION.md) for upstream and screenshot provenance.

This is a demo under active development, not a job-application service or a promise of current availability, fit, or employment.
