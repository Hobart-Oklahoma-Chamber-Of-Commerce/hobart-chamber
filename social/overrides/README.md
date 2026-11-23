# Chamber graphics (overrides)

Use this folder when the Chamber has its own picture for one of the worker's time slots.

1. Name the picture for the date and time it should go out (Central time): `2026-11-19-0730.jpg` (or `.png`).
2. Put its caption in a text file with the same name: `2026-11-19-0730.txt`.
3. Optional: alt text for screen readers in `2026-11-19-0730.alt.txt`.

On its next run the worker deletes its own scheduled post for that time (if it made one) and
schedules the Chamber's picture in its place. It does this once, and it records the swap in
`state/ledger.json`. If the picture or caption is changed later, the next run swaps the post again.
A time with no worker post just gets the Chamber's post added.

The worker will not swap anything less than 15 minutes before post time, and old files can be
left here; their time has passed, so the worker ignores them.

## Re-making one of the worker's own posts

When the calendar changes after a week is planned (a new event, a new location), list the slot in
`social/redo.json`, optionally with the calendar event to post about:

```json
[{ "slot": "2026-11-25 14:45", "event": "ev-hometown-christmas-1128", "why": "added after the week was planned" }]
```

The next run deletes the worker's post in that slot and plans the slot again from today's calendar.
Each entry runs once (it is recorded in `state/ledger.json`). Slots holding a Chamber graphic are never
touched, and nothing is changed less than 30 minutes before post time.
