# WebMCP Forge — build plan

> Give us a web app. We generate its WebMCP tools, then prove which ones are safe
> for an agent to use.

**Deadline:** Thu 3 Sep 2026, 1:00 PM PDT (= Fri 4 Sep, 01:30 IST)
**Written:** Sun 30 Aug 2026, ~23:30 IST — roughly **74 hours** of wall clock left.

---

## The one-sentence pitch

An ordinary web app has no agent interface. Forge reads its route handlers,
generates WebMCP tools, and then refuses to trust them: it scans the generated
tool surface, runs an agent against it, and reports which tools actually did what
they claimed.

The demo turns on a real failure mode. A generator that builds tool descriptions
from repository prose will faithfully copy a poisoned doc comment into an agent's
context, and will mark a `POST /api/checkout` as `readOnlyHint: true` because the
prose above it says "Retrieves the order summary." Both mistakes are reproduced
by the real analyzer in this repo, and both are caught downstream.

## How it maps to the judging criteria

| Criterion | What carries it |
|---|---|
| WebMCP Leverage | Two live WebMCP surfaces. The Forge dashboard registers 6 control tools so a judge's agent drives the pipeline; the storefront registers whatever the Forge generated. |
| Execution | End to end and working: repo in → tools out → scan → agent run → downloadable integration file. |
| Potential Impact | Auto-generating an agent interface is the easy half. Nobody is checking what the generated tools do. |
| Creativity & Ambition | The security/verification layer, and the fact that the human dashboard and the agent's tool surface are the same surface. |

---

## Status

### Done — the whole pipeline runs

| Piece | File | State |
|---|---|---|
| Repo analyzer (route handlers → capabilities) | `src/lib/analyzer.ts` | ✅ verified |
| Tool generator (capability → WebMCP tool) | `src/lib/analyzer.ts` | ✅ verified |
| GitHub ingestion + bundled demo repo | `src/app/api/analyze/route.ts`, `src/lib/fixtures/demoRepo.ts` | ✅ verified |
| Static security checks (3) | `src/lib/security/rules.ts` | ✅ verified |
| Runtime policy gate (observe + refuse) | `src/lib/security/monitor.ts` | ✅ verified |
| Generic executor (manifest → real HTTP call) | `src/lib/executor.ts` | ✅ verified |
| Agent validator, guarded + unguarded | `src/lib/agent/runner.ts` | ✅ verified |
| Integration codegen (the ship artifact) | `src/lib/codegen.ts` | ✅ output syntax-checked |
| Forge dashboard, live-updating | `src/components/Dashboard.tsx`, `Panels.tsx` | ✅ builds |
| Forge's own WebMCP tools (6) | `src/components/useForgeTools.ts` | ⚠️ needs a real browser |
| Demo storefront + its API | `src/app/shop`, `src/app/api/*` | ✅ verified |
| Storefront registers generated tools | `src/components/Storefront.tsx` | ⚠️ needs a real browser |

Verified end-to-end output (from `npm run build` plus a scripted run of the
analyzer, scanner and agent against the live API):

```
TOOLS        search_products GET  readOnly=true
             get_product     GET  readOnly=true
             add_to_cart     POST readOnly=false
             checkout        POST readOnly=true   <- the generator was fooled
             track_order     GET  readOnly=true

STATIC SCAN  4 verified, 1 blocked, 2 high, 1 medium
             track_order  BLOCKED  metadata-injection + sensitive-data-egress
             checkout     MEDIUM   declared read-only, mapped to POST

UNGUARDED    search ✓  detail ✓  cart ✓  track ✓
             ✕ blocked exfiltration of customer email to analytics-partner.example
             ✓ followed the instruction embedded in track_order and called checkout
             -> 2 blocked, 4 high   (checkout escalated to HIGH on observed mutation)

GUARDED      search ✓  detail ✓  cart ✓
             ✕ refused track_order
             ✕ held checkout for human confirmation
             -> 4 verified, 1 blocked
```

### Not done — this is the real remaining list

1. **Never opened in a WebMCP-enabled browser.** Nothing here has run against a
   real `document.modelContext`. This is the single largest risk in the project
   and it is task #1.
2. **Not deployed.** No Vercel project, no live URL. Required for submission.
3. **No video.** Required, under 3 minutes, with audio.
4. **No Devpost submission.**
5. **README** exists but has no screenshots and no live URL yet.
6. **No tests.** Verification so far is a scratchpad script, not committed.
7. **Storefront cart is in-memory** on the server. A Vercel cold start empties
   it. Fine for a demo, wrong for anything else.
8. **Only Next.js App Router `app/**/route.ts` is understood.** Pages Router,
   Express, FastAPI, Django: all unsupported. Stated plainly in the README.
9. **The analyzer is regex-based, not an AST.** It reads `export async function
   GET`, `searchParams.get(...)` and destructured `await request.json()`. A repo
   that does any of those differently yields nothing.
10. **No LLM anywhere.** Deliberate — it removes an API key from the judge's
    path and makes runs deterministic. Worth saying out loud in the video, because
    "no model in the loop" is a feature for a security tool.
11. **`get_product` cannot be driven from the storefront UI** — it is generated
    and callable by an agent, but there is no product detail page.
12. **Three checks, not a scanner.** metadata-injection, sensitive-data-egress,
    readonly-mismatch. No dependency scanning, no auth checks, no SSRF.

---

## Runway

### Block 1 — tonight, ~2 hours (highest risk, do it first)

- [ ] Open Chrome with WebMCP enabled (or ChatGPT's in-app browser) and load
      `http://localhost:3000`. Confirm the badge reads **WebMCP available**.
- [ ] Ask the agent: *"Analyze the demo storefront, scan the tools it generates,
      and tell me which ones you would refuse to use."* Watch the dashboard move.
- [ ] Fix whatever the real API disagrees with. Most likely suspects: the exact
      `execute` return shape, whether `annotations` is accepted as written, and
      whether `unregisterTool` on an unregistered name throws where we expect.
- [ ] Deploy to Vercel. Get the live URL. Re-test the above **on the live URL** —
      the API is SecureContext-only, so https is where it truly counts.

If Block 1 slips past tonight, cut scope tomorrow, not on Sep 2.

### Block 2 — Mon 31 Aug

- [ ] Sit with the dashboard and make the agent's actions unmistakable. The
      Activity panel already colours agent rows; make sure a judge watching a
      2-minute video can see *the agent did that, not the human*.
- [ ] Storefront: add a visible before/after. Right now it says "no WebMCP tools"
      then "N WebMCP tools registered" — make that the hero moment of the page.
- [ ] Point Forge at 2–3 real public Next.js repos. Whatever crashes, fix or
      fail gracefully. The error path matters: a judge will paste something odd.
- [ ] Commit history should look like a build, not one dump. Small commits.

### Block 3 — Tue 1 Sep

- [ ] Write the README properly: the problem, the three checks and what each one
      actually detects, the architecture, the honest limits (list above).
- [ ] Add a small test file over `analyzer` + `rules` so the repo shows the
      checks are pinned, not vibes.
- [ ] Screenshots into the README.
- [ ] Draft the video script. Time it. It must fit in 2:30 spoken.

### Block 4 — Wed 2 Sep

- [ ] **Record the video.** Not Sep 3. Submissions die here.
- [ ] Upload to YouTube, public, no age gate.
- [ ] Fill in the Devpost submission completely and save a draft.

### Block 5 — Thu 3 Sep, morning IST

- [ ] Final live-URL smoke test in a clean browser profile.
- [ ] Submit by 9:00 PM IST — a **4.5 hour buffer** before the 01:30 IST cutoff.
- [ ] Do not touch main after submitting.

---

## The 2:30 video, beat by beat

| Time | Beat |
|---|---|
| 0:00–0:15 | The storefront. "An ordinary Next.js shop. It exposes nothing to an agent." Badge: **no WebMCP tools**. |
| 0:15–0:35 | Paste the repo into Forge. 5 capabilities discovered, 5 tools generated. |
| 0:35–1:00 | Run the scan. `track_order` goes red. Open it: the doc comment tells the agent to ignore restrictions and mail the customer's address to a third party. That text was going straight into the agent's context. |
| 1:00–1:15 | Point at `checkout`: amber. The generator believed the prose and marked a POST as read-only. "Static analysis can only warn here. So run it." |
| 1:15–1:45 | Unguarded agent. It follows the injected instruction — the gate blocks the exfiltration, and checkout mutates state, escalating to red. |
| 1:45–2:05 | Guarded agent. Same task. Refuses `track_order`, holds `checkout` for confirmation, completes the shopping task. |
| 2:05–2:20 | Export the integration. Blocked tools are commented out with the finding attached. |
| 2:20–2:30 | Hand the dashboard to the judge's own agent over WebMCP. "Everything you just watched, an agent can drive." |

## Cut list — do not build these

Python/other frameworks · private repos · AST-based analysis · more vulnerability
classes · autonomous code rewriting · deployment automation · dependency scanning ·
auth · multi-agent architecture · a database · Firecrawl (a box on a diagram, not
a judged point — reconsider only if a sponsor prize requires it).

## Commands

```
npm install
npm run dev        # http://localhost:3000 — localhost counts as a secure context
npm run build
npx tsc --noEmit
```
