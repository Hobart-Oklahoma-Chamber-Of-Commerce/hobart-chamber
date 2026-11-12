# Hobart Happenings: the Chamber's Facebook worker

Turns events on the community calendar into on-brand Facebook posts, on its own.

**What it does every day (7:15 AM and 7:15 PM Central)**

1. Reads the calendar (the built-in events in `index.html` plus anything added in the admin panel).
2. Works out which posts are due:
   - an **announcement** once an event is 7 days out or less,
   - a **reminder** the day before.
   - Multi-date runs (a play with four shows) get one announcement that lists every date.
   - Sports, school and holiday entries stay on the calendar but don't get their own post.
3. Draws a "Hobart Happenings" graphic for each one (the event's real flyer is taped on as a polaroid when there is one, otherwise a hand-drawn icon) and writes the caption.
4. **Schedules** the post on the Facebook Page. It does not post instantly. Scheduled posts sit in **Meta Business Suite → Planner → Scheduled**, where Jessica can read, edit, reschedule or delete any of them before they go out.
5. Records every post in `state/ledger.json`, so nothing is ever posted twice.

At most 3 posts a day, sent at 10:00, 12:30, 3:30 or 6:00 (Central).

## The look (so it stays consistent)

Every post is a page from a Main Street scrapbook: paper grain and sunburst, the date as a tear-off ticket stub with a hand-lettered "This Saturday!", a colored sticker, and the Chamber logo and navy/gold from the water-tower mark. Fonts are open-licensed and live in `fonts/`. All art is drawn vector (`src/icons.js`), with no AI-generated imagery. Captions use the Chamber's own event description almost word for word, with no emoji bullets, hashtag piles or em dashes.

Look and feel lives in `src/template.js` and `src/icons.js`. Wording lives in `src/caption.js`. Timing rules live at the top of `src/plan.js`.

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
- Wrong sticker or icon for an event: adjust the word rules at the top of `src/icons.js`.
- Facebook token stopped working: repeat step 3 and replace the `FB_PAGE_TOKEN` secret.
