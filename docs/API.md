# UZUZ API

Base URL: `/api/v1`. All responses are JSON. Errors always have the shape:

```json
{ "error": { "code": "ROOM_FULL", "message": "…", "details": [] } }
```

The client translates `code` (see `shared/src/constants.ts → ERROR_CODES`).

## Guest session

Every `/api/v1/*` request (except `/admin/*`) runs through the session middleware. If there is no valid
`uzuz_sid` cookie, the server creates a guest session (random 256-bit token, stored hashed) and sets an
httpOnly cookie valid for 30 days (sliding). There are no player accounts.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/session` | — | Current guest profile + stats |
| PATCH | `/session` | `{ nickname?, avatar?, color?, hideFromLeaderboard? }` | |
| POST | `/session/restore-code` | — | Returns one-time `{ code: "UZ-XXXX-XXXX" }` |
| POST | `/session/restore` | `{ code }` | Moves that guest session to this browser (token rotated, code consumed) |
| GET | `/session/history` | — | Last 20 games of this guest |

## Library

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | Categories with names in uz/ru/en and public quiz counts |
| GET | `/quizzes?q&category&language&difficulty&size=short\|long&sort=popular\|new&page&limit&featured=1&ids=a,b` | Public quizzes (cards, no questions). `ids` fetches favorites |
| GET | `/quizzes/mine` | Quizzes created by this guest |
| GET | `/quizzes/by-slug/:slug` | Detail: meta, first question **without answers**, top scores, `canEdit` |
| GET | `/quizzes/:id/edit` | Full quiz with answers. Requires creator session or header `x-edit-key` |
| POST | `/quizzes` | Body = `quizInputSchema`. Returns `{ id, slug, editKey }` — edit key shown once |
| PUT | `/quizzes/:id` | Same body. Creator session or `x-edit-key` |
| DELETE | `/quizzes/:id` | Creator session or `x-edit-key` |
| POST | `/quizzes/:id/report` | `{ reason, details? }` |
| POST | `/images` | `{ data: "data:image/webp;base64,…" }` ≤ 512 KB, type verified by magic bytes → `{ url }` |
| GET | `/images/:id` | Image bytes (immutable cache) |

## Rooms (live games)

| Method | Path | Notes |
|---|---|---|
| POST | `/rooms` | `{ quizId, mode: classic\|team\|solo, settings? }` → `{ code }`. Creator becomes host |
| GET | `/rooms/public` | Open public lobbies |
| GET | `/rooms/:code` | Room info (rate-limited 30/min/IP against code guessing) |
| GET | `/rooms/:code/results` | Final results of the latest game in that room |

`settings`: `maxPlayers (1–200, default 100)`, `shuffleQuestions`, `shuffleAnswers`, `timeMultiplier (0.5|1|1.5|2)`, `autoAdvance`, `isPublic`.

## Teams

| Method | Path | Notes |
|---|---|---|
| GET | `/teams?q&subject&language&level&hasSpace=1&sort=active\|new&page&limit` | Public teams |
| GET | `/teams/mine` | Teams this guest belongs to |
| GET | `/teams/match?subject&language&level` | Top 5 matches with `score` and `reasons` |
| POST | `/teams` | `teamInputSchema` → `{ id, inviteCode }` |
| POST | `/teams/join-by-code` | `{ code: "T-XXXXXX" }` |
| GET | `/teams/:id?code=` | Detail. Private teams only for members or with invite code |
| POST | `/teams/:id/join` | `{ code? }` → `{ status: joined\|requested }` |
| POST | `/teams/:id/leave` | Owner leaving → oldest member becomes owner; empty team archived |
| PATCH | `/teams/:id` | Owner: `{ description?, capacity?, visibility?, joinPolicy? }` |
| POST | `/teams/:id/kick` | Owner: `{ pid }` |
| POST | `/teams/:id/transfer` | Owner: `{ pid }` |
| POST | `/teams/:id/invite-code` | Owner: regenerate |
| GET | `/teams/:id/requests` | Owner: pending requests |
| POST | `/teams/:id/requests/:rid` | Owner: `{ action: accept\|reject }` |

Limits enforced on the server: capacity (atomic update), one membership per team, max 3 teams per guest.

## Leaderboard

`GET /leaderboard?scope=global|weekly|teams|quiz&quizId&page` — global (all-time XP), weekly (since Monday 00:00 Asia/Tashkent), teams (total score), per-quiz best scores.

## Reports

`POST /reports` — `{ targetType: quiz|team|player, targetId, reason, details? }`

## Admin (separate cookie `uzuz_admin`, path `/api/v1/admin`)

`POST /admin/login`, `POST /admin/logout`, `GET /admin/me`, `GET /admin/stats`,
`GET /admin/quizzes`, `PATCH /admin/quizzes/:id { hidden?, featured? }`, `DELETE /admin/quizzes/:id`,
`GET /admin/reports?status`, `PATCH /admin/reports/:id { status, hideTarget? }`,
`GET /admin/categories`, `PUT /admin/categories/:slug`, `GET /admin/teams`, `PATCH /admin/teams/:id { hiddenByAdmin?, archived? }`,
`GET /admin/audit`. Every write is recorded in the audit log.

## Socket.IO

Same origin as the API, authenticated by the `uzuz_sid` cookie during the handshake. Every payload is
validated with Zod; every client event replies through an acknowledgement `{ ok: true, data } | { ok: false, code }`.

**Client → server**

| Event | Payload |
|---|---|
| `time:sync` | callback(serverNow) |
| `room:join` | `{ code, role: host\|player, nickname?, avatar?, color? }` |
| `room:leave` | `{ code }` |
| `host:start` / `host:next` / `host:playAgain` | `{ code }` |
| `host:kick` | `{ code, pid }` |
| `host:lock` | `{ code, locked }` |
| `answer:submit` | `{ code, questionIndex, option }` |
| `team:select` | `{ code, teamKey }` (`color:coral` … or `team:<id>` for a real UZUZ team) |

**Server → client:** `room:state`, `room:players`, `room:answerCount`, `room:kicked`, `room:closed`,
`room:notice`, `game:countdown`, `game:question` (no correctness), `game:reveal`, `game:leaderboard`,
`game:finished`, `game:xp`, `team:request`, `team:requestResult`. Types: `shared/src/types.ts`.

**Game state machine (server-authoritative):**
`LOBBY → COUNTDOWN (3s) → QUESTION (time limit) → REVEAL (4s) → LEADERBOARD → … → FINISHED`

Scoring: correct = `round(1000 × (1 − (responseTime / timeLimit) / 2))` (500–1000; ×2 for double points),
streak bonus +100 per consecutive correct answer (max +500), wrong/no answer = 0. Team score = average of members.
