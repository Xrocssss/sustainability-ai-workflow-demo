# Sustainability AI Workflow — public walkthrough

This is a **static, read-only preview** of a personal side project based on the open-source [Career-Ops](https://github.com/career-ops-hq/career-ops) system. It lets visitors walk through Run, Jobs, CVs, and the workflow design while the public backend is still being configured. The working personal installation is separate and private.

The two images under `assets/` are **unaltered pixel crops of real Career-Ops UI screenshots**; the crops exclude personal job counts and records. All job names, employers, scores, and CV states rendered by this site are synthetic examples. They are not live postings or results.

## Boundaries

- Static HTML/CSS/JavaScript only; no API routes, server, provider keys, AI calls, uploads, analytics, cookies, or local storage.
- The Run button explains why AI scoring is unavailable. CV generation, applications, and messages are unavailable.
- Do not use this preview to submit personal information. The working tool remains local and human-controlled.
- This repository does **not** contain the personal CV, tracker, reports, provider configuration, or full modified backend. It is a public walkthrough, not a fork of the full working installation.

## Local check

```powershell
node --test tests/*.test.mjs
node --check app.js
python -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`. Stop the server with Ctrl+C.

## Source and attribution

The working prototype was adapted from Career-Ops. See [ATTRIBUTION.md](ATTRIBUTION.md) for screenshot provenance and upstream credit. This project is not affiliated with or endorsed by the Career-Ops maintainers.
