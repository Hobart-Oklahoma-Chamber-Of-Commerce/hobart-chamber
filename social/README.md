# Hobart Happenings: the Chamber's Facebook worker

Turns events on the community calendar into on-brand Facebook posts, on its own.

**What it does: a full week of posts, planned a week ahead (Central time)**

Twice a day it reads the calendar and schedules the next 8 days of posts on the Page. Jessica reviews them each Sunday in **Meta Business Suite > Planner > Scheduled** and edits, moves or deletes anything.

| Day | Time | Post | Where it comes from |
|---|---|---|---|
| Sunday | 9:30 AM | **This week in Hobart** | the calendar |
| Sunday | 3:30 PM | **Member spotlight** on what the business does for the community | member directory + `data/member-notes.json` |
| Mon to Fri | 7:30 AM | **Today in Hobart** | the calendar |
| Mon to Fri | 10:30 AM | **Member spotlight** (morning look) | member directory |
| Mon to Fri | 2:45 PM | **Event post** (announcement 7 days out, reminder the day before, or a save-the-date) | the calendar |
| Mon to Fri | 7:30 PM | **Engagement post** that asks for comments: Mon/Wed Hobart history, Tue fun question, Thu "a year ago" (only if the calendar has something from last year), Fri weekend plans | `data/history.json`, `data/prompts.json` |
| Saturday | 7:30 AM | **Today in Hobart** | the calendar |
| Saturday | 2:00 PM | **The week in Hobart** recap (made the day before so it can use real results) | the calendar + `data/results.json` |
| Saturday | 6:00 PM | **Event post** | the calendar |

Edit the times in `src/plan.js` (`WEEK`) and nowhere else.

**Game scores:** there is no automatic source for local game scores. To include them, add real results to `data/results.json`, for example `{ "date": "2026-11-17", "text": "5/6th Basketball: Hobart 24, Hollis 18" }`. The recap uses only what is in that file.

**History posts** use facts from the Oklahoma Historical Society's Encyclopedia of Oklahoma History and Culture (Hobart entry) and cite it in the caption. Add more to `data/history.json` only with a real source.

Nothing is invented: every name, address, phone and hour comes from the website or a verified listing. If the calendar is quiet, the slot falls back to a true "how to use the Chamber" post instead of filler.

Posts are **scheduled**, not instant. They sit in **Meta Business Suite > Planner > Scheduled**, where Jessica can read, edit, move or delete any of them. `state/ledger.json` records every post so nothing is made twice.

## The look (so it stays consistent)

Every graphic uses the website's own fonts (Playfair Display and Inter) and exact colors (royal blue `#1a3ea8`, gold `#c49a3e`, navy `#0e2056`). On top of that each post gets two theme layers:

- **Season** (by date): fall leaves on warm paper, winter snowflakes on cool paper, spring blossoms, summer sun.
- **Event** (by words in the title): football, basketball, band/music, market, harvest, Halloween, golf, Christmas, stage, food, shopping, giving. This sets the sticker color, header strip pattern, hero icon and a few motifs.

So a November football post and a January basketball post share the same bones but look clearly different. Themes live in `src/themes.js`, icons in `src/icons.js`, layout in `src/template.js`, wording in `src/caption.js` and `src/content.js`, timing in `src/plan.js` (`WEEK`).

## Setup checklist (about 20 minutes)

- [ ] Merge this pull request.
- [ ] Meta developer app created under the **Chamber's** Facebook admin login (steps 1-3 below).
- [ ] Repo secrets `FB_PAGE_ID` and `FB_PAGE_TOKEN` saved (step 4). Never paste them in chat.
- [ ] Actions > "Hobart Happenings social worker" > Run workflow with **dry run checked**. Open the `drafts` download and look at the graphics.
- [ ] Run it again with dry run **unchecked**. Open Meta Business Suite > Planner and confirm the posts are in Scheduled.
- [ ] Jessica checks Scheduled for a week before anyone trusts it blind.
- [ ] Optional: set repo variable `FB_MODE` = `publish` once everyone is happy.

## One-time setup (about 20 minutes, needs the Chamber's Facebook admin login)

The worker lives in the **Chamber's** GitHub organization on purpose, and the Facebook connection should belong to the **Chamber's** Meta Business account, not to any one person. That way it keeps running when volunteers change.

1. **Meta developer app.** Go to <https://developers.facebook.com/apps>, log in with the Chamber's admin Facebook account, and create an app (type: Business). Add the **Facebook Login for Business** or "Pages API" use case.
2. **Permissions.** The app needs `pages_manage_posts`, `pages_read_engagement` and `pages_show_list` for the Chamber's Page. While the app is in Development mode and you are an admin of both the app and the Page, these work without app review.
3. **Page access token.** In Graph API Explorer, pick the app, choose "Get Page Access Token", select the Chamber's Page, grant the three permissions, then exchange the token for a long-lived one and request the Page token from `/me/accounts`. A Page token made from a long-lived user token does not expire. Note the Page's numeric **Page ID**.
4. **Store them as secrets** (never paste them in chat or commit them): GitHub repo → Settings → Secrets and variables → Actions → *New repository secret*:
   - `FB_PAGE_ID`
   - `FB_PAGE_TOKEN`
5. **Check the connection.** Actions → "Hobart Happenings social worker" → Run workflow with *dry run* checked, to see the drafts. When the drafts look right, run it again with dry run unchecked. (Or locally: `FB_PAGE_ID=... FB_PAGE_TOKEN=... npm run check`.)
6. Look in Meta Business Suite → Planner. The scheduled posts should be there.

To switch from "schedule for review" to "publish straight away", add a repository **variable** `FB_MODE` = `publish`. Leave it unset to keep the review queue.

## Running it by hand

```
cd social
npm ci && npx playwright install chromium
npm run samples                       # the six sample posts in out/
node src/run.js --dry-run             # drafts for whatever is due today
node src/run.js --dry-run --now 2026-11-22T08:30   # pretend it's another day
```

## When something looks off

- A post is wrong: delete it in Meta Business Suite → Scheduled. Fix the event on the calendar. The ledger remembers it was made, so to re-make it, remove its line from `state/ledger.json`.
- A restaurant changed hours or phone: edit `data/restaurants.json`. Members come straight from the website directory.
- Wrong sticker or icon for an event: adjust the word rules at the top of `src/icons.js`.
- Facebook token stopped working: repeat step 3 and replace the `FB_PAGE_TOKEN` secret.
