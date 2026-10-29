---
name: agent-office
description: Report your work to the user's Agent Office, a live 3D office where each AI agent is shown at its desk. Use whenever you work as one of the office's agents - at the start of a task, at milestones, when you need the user, when you hand off, and when you finish.
---

# Agent Office: report what you're doing

The user runs **Agent Office**, a local web app that shows a team of up to eight AI
agents in a 3D office. Each agent has a desk (or a station) and a lounge seat. When
you report that you're working, your character walks to your desk and it lights up;
when you need the user, an amber ring pulses at your desk; when you finish, you go
back to the lounge. The user watches this to see at a glance who is doing what.

You are one of those agents. This skill tells you when and how to report.

## 1. Know who you are

Every agent has an **id** (lowercase, like `ada` or `research-bot`). Use, in order:

1. the id the user or your instructions gave you ("You are Cleo (agent id: cleo)"),
2. `OFFICE_AGENT` if it's set in your environment,
3. otherwise ask the office (`list_agents`, or `GET /api/team`) and ask the user
   which one you are. Don't guess, and never report as another agent.

The office runs at `http://localhost:5180` unless the user tells you otherwise
(`OFFICE_URL`).

## 2. When to report

| Moment | state | text (example) |
|---|---|---|
| You start a task | `working` | `Researching a question` |
| A meaningful milestone (at least every ~10 minutes on long work) | `working` | `First draft written` |
| You need the user's answer or approval | `waiting` | `Needs your go-ahead` |
| You pass work to another agent | `handoff` + `to` | `Draft ready for review` |
| You work together with another agent | `meeting` + `with` | `Reviewing the plan together` |
| You're stuck or something failed | `error` | `Build failing, investigating` |
| You deliver | `done` | `Delivered` |

Send the first update together with your first real step and the last one with your
final step, not as extra turns. A few updates per task is right; don't report every
small action. A `working` update older than 10 minutes shows as stale, so long tasks
need the occasional milestone.

## 3. How to report (use the first that works for you)

### A. MCP tool (if you have `report_status`)

```
report_status({ agent: "cleo", state: "working", text: "Reviewing the draft" })
report_status({ agent: "cleo", state: "handoff", to: "ada", text: "Review done" })
```

`list_agents` shows everyone and what they're doing; `get_office` gives a summary.

### B. HTTP (if you can make web requests)

```bash
curl -s -X POST http://localhost:5180/api/status \
  -H "Content-Type: application/json" \
  -d '{"agent":"cleo","state":"working","text":"Reviewing the draft"}'
```

If the office has a token, add `-H "Authorization: Bearer $OFFICE_TOKEN"`.
The same from code: `fetch(url, { method: "POST", headers: {...}, body: JSON.stringify({...}) })`.

### C. Command line (if you can run commands on the office's computer)

```bash
node <office folder>/scripts/status.mjs cleo working "Reviewing the draft"
node <office folder>/scripts/status.mjs cleo handoff "Review done" --to ada
```

### D. Inbox file (if you can only write files, e.g. through a shared folder)

Write one JSON file per update into the office's `inbox/` folder. Write it under a
temporary name first and then rename it to `*.json`, so it's never read half-written:

```json
{"agent":"cleo","state":"working","text":"Reviewing the draft","at":"2026-01-31T14:05:00Z"}
```

`at` is the current UTC time; updates older than 10 minutes are ignored. The office
reads the folder every 2 seconds and deletes each file it has read.

## 4. The fields

- `agent` (required): your id.
- `state` (required): `working`, `waiting`, `handoff`, `meeting`, `error`, `done` or `idle`.
- `text` (optional): up to 80 characters.
- `to`: for `handoff`, who receives the work (defaults to the lead).
- `with`: for `meeting`, who you're working with (required for meetings).

## 5. Rules

- **Keep `text` generic.** Say what kind of work it is, never the content: no names,
  file names, customer or private details, quotes from the conversation, or secrets.
  Good: `Drafting a document`. Bad: `Writing Jane's resignation letter to Acme`.
- **Only report what's true right now.** Don't announce work you haven't started or
  claim it's done before it is.
- **Reporting never gets in the way.** If a report fails (office not running, network
  refused), carry on with the task without retrying or mentioning it, unless the user
  asked you to fix the office connection.
- **One agent, one voice.** Report only as yourself. A lead coordinating others can
  report its own state; the others report theirs.
- Leave the office's other files alone; the inbox is the only place to write.

## 6. If something's off

- `401 missing or wrong OFFICE_TOKEN` or `locked`: the office needs a token; ask the
  user for `OFFICE_TOKEN` (they set it in the office's `.env.local`).
- `unknown agent "x"`: the id is wrong; check `list_agents` / `GET /api/team`.
- Connection refused: the office isn't running (`npm run dev` in its folder). Carry
  on with your task.
