# PRD: Daily Challenge and Leaderboards

**Status:** proposed · **Owner:** Michael Tan · **Last updated:** 2026-10-20

## Summary

One memory challenge a day, the same for everyone. Memorize a fresh random sequence, recall it once, and see where you rank. Results can be shared to a group chat or social media as a small spoiler-free card, and friends can compete in private groups.

The format borrows from daily puzzles like [enclose.horse](https://enclose.horse/) and Wordle: one shared puzzle, one attempt, then a look at how everyone else did. That makes it a ritual and a conversation, not a grind.

## Problem

The current app is useful but quiet. You learn your passport number, review it a few times, and you're done. There's no reason to open it daily, and no way for someone to find out about it except word of mouth.

Memory is also secretly competitive. People love finding out they can remember 40 digits after a minute, and love telling their friends even more. Typing-test sites like Monkeytype grew through exactly that loop: practice, a score, a screenshot.

## Goals

- Give users a reason to come back every day, measured by retention.
- Create a share loop that brings in new users without paid acquisition.
- Keep the personal vault fully private and local. Competition data is separate and never touches personal numbers.
- Stay fair enough that the leaderboard means something, without heavy anti-cheat machinery.

## Non-goals

- Real-time head-to-head matches (maybe later).
- Prizes or money.
- Sharing or syncing personal vault items. Never.

## Users

- **Primary:** existing users looking for a daily habit, especially those who've finished learning their own numbers.
- **Secondary:** friends who receive a share in a group chat and tap through to beat the score.

## Experience

### The daily run

1. **Lobby.** "Daily #42 · digits · 60 seconds to memorize". It shows the current streak, a countdown to tomorrow's challenge, and whether you've already played today.
2. **Memorize.** A random sequence (40 digits for the default mode) appears in chunks, with optional hooks, in the same Graphite style. A timer runs. You can end early to bank time as a tiebreaker.
3. **Recall.** Everything fades out and you type the whole sequence from memory. There are no restarts in this mode. It's a single attempt, and a wrong digit is marked but you keep going.
4. **Results.** Your score, your percentile, a histogram of everyone's scores today with your position marked, the correct sequence revealed with your errors, and your streak.
5. **Share.** One tap to copy, or the native share sheet on phones.

One attempt per day. After playing you can keep practising with unranked random sequences of the same format.

### Scoring

- **Score:** correctly recalled digits, counted in order. A row (chunk) with one error scores half; a row with more than one error scores zero. This mirrors World Memory Championships scoring, is easy to explain, and rewards accuracy over guessing.
- **Tiebreak:** memorization time used (less is better).
- **Rotating modes** (later): Monday digits, Wednesday words, Friday names and faces, Sunday a long-form π-style challenge.

### Sharing

The share never reveals the sequence, so it can't spoil the challenge for anyone who hasn't played. Text version, for group chats:

```
rememberanyth.ing · daily #42 · digits
🟩🟩🟩🟩 🟩🟩🟩🟩 🟩🟩🟨⬛ ⬛⬛⬛⬛
34/40 · top 12% · 🔥 6 days
rememberanyth.ing/daily
```

One square per chunk: 🟩 perfect, 🟨 one error, ⬛ missed.

Image version, for social media: a 1080×1350 card rendered on a canvas in the Graphite theme. It shows the date, the score in large mint digits, the chunk grid and the wordmark. It goes through the Web Share API with files on phones, with copy and download as fallbacks.

Shares include a referral token (`?r=abc123`) so we can measure which shares bring new players. The token identifies the sharer's anonymous handle, nothing more.

### Leaderboards

- **Global daily:** top 100 plus your own rank. It resets every day.
- **Groups:** create a group, get an invite link (`rememberanyth.ing/g/xyz`), and drop it in a group chat. Members see a daily board and a weekly total. This is the feature most likely to drive retention, because the competition is with people you know.
- **Streaks:** your current and longest daily streak, shown on your profile and in shares.

### Identity

The core app has no accounts, and that should mostly stay true:

- Playing the daily challenge needs no account. You get an **anonymous handle** ("quiet-otter-42") tied to a device key in IndexedDB.
- To appear on leaderboards or join a group, you pick a display name. No email is needed.
- To keep your streak across devices, you can add a passkey. That's the only "account" there is.

## Requirements

### Must have (v1)

- A daily sequence generated server-side, identical for everyone, revealed only when you press start.
- The memorize, recall and results flow, with one ranked attempt per day per device or handle.
- Scoring and tiebreak as above, computed server-side from the submitted keystrokes.
- A histogram of today's scores and your percentile.
- Text share with the chunk grid, plus a share image card.
- Streaks.
- Unranked practice mode.

### Should have (v1.1)

- Groups with invite links and daily or weekly boards.
- A global daily top 100.
- Passkeys for cross-device streaks.
- Referral attribution on shares.

### Could have (later)

- Rotating modes (words, names and faces, cards).
- A weekly long-form challenge.
- Optional reminder notifications at your usual time.
- Head-to-head live races.

## Technical approach

### Backend

This is the first server component, so keep it tiny and separate:

- **Cloudflare Workers + D1** (or Durable Objects for per-day counters) on `api.rememberanyth.ing`. Static app hosting stays where it is.
- Endpoints:
  - `GET /daily`: today's metadata (number, mode, length, time limit), with no sequence.
  - `POST /daily/start`: returns the sequence and a signed attempt token, and records the start time.
  - `POST /daily/submit`: the attempt token, typed answer and keystroke timings. Returns score, rank and percentile.
  - `GET /daily/:n/stats`: the histogram.
  - `POST /groups`, `GET /groups/:id/board`.
- The daily sequence is derived from a server secret and the date (HMAC), so it can't be predicted in advance.
- **Reset time:** midnight UTC, so everyone shares the same puzzle number. (Open question below.)

### Privacy

- The challenge data is random public sequences, so it's not sensitive. Personal vault items never touch this code path.
- The CSP gains `connect-src https://api.rememberanyth.ing`, used only on the daily routes. The rest of the app keeps working fully offline.
- What we store: anonymous handle, optional display name, scores, timings, group memberships. No email, no IP retention beyond abuse logs.
- The README's "nothing is sent anywhere" line gets an honest qualifier: "Your numbers never leave your device. The daily challenge is online."

### Fairness (light-touch anti-cheat)

Perfect anti-cheat is impossible here (anyone can photograph their screen), so the goal is a believable leaderboard, not an airtight one:

- The server records start time and enforces the memorize time limit and a minimum plausible recall time.
- Keystroke timings are checked for paste-like or superhuman patterns, and outliers are hidden from the global board pending review.
- Groups self-police. They're friends, and the stakes are bragging rights.
- Recall happens with the sequence hidden and focus required. Switching tabs during recall voids the ranked attempt (practice is unaffected).

## Success metrics

| Metric | Target (first 90 days) |
|---|---|
| D1 / D7 retention for daily players | 40% / 20% |
| Share rate (shares per completed daily) | > 15% |
| New players per 100 shares (via referral token) | > 10 |
| Median streak among weekly actives | ≥ 4 days |
| Group adoption | 25% of weekly actives in at least one group |

## Risks

- **Cheating at the top** makes the global board meaningless. Mitigation: outlier hiding, and emphasizing percentile and groups over the global top 100.
- **Too hard for beginners.** 40 digits in 60 seconds is hard for a first-timer. Mitigation: the histogram makes a modest score feel fine, the share emphasizes streaks, and difficulty is tuned from real data in week one.
- **Privacy story confusion.** Adding a server could make people distrust the vault. Mitigation: a clear separation in the UI and copy, and the vault working fully offline.
- **Spam names in groups and leaderboards.** Mitigation: a name filter and reporting. Groups are private by link.

## Open questions

1. Midnight UTC (one shared puzzle number worldwide) or local midnight (fairer, but numbering gets messy)? enclose.horse-style shared numbering is better for group chats.
2. One length for everyone, or a few difficulty tiers each with its own board?
3. Should practice-mode scores count toward anything, or stay purely private?
4. Do we show the hooks during the daily challenge, or is it hooks-off to keep it pure?

## Milestones

| Phase | Scope | Rough size |
|---|---|---|
| **0. Local daily** | Daily sequence seeded by date on the client, memorize/recall/results, text share, streaks. No server, no rankings. Tests whether people come back and share | 1 week |
| **1. Online daily** | Worker + D1, server-revealed sequence, percentiles, histogram, share image card | 2 weeks |
| **2. Groups** | Invite links, group boards, referral tokens | 1–2 weeks |
| **3. Modes** | Rotating modes, weekly challenge, passkeys | ongoing |
