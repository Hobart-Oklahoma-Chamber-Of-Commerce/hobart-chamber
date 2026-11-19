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
