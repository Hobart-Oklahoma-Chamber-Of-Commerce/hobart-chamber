// Facebook Page posting through the Graph API.
// Posts are SCHEDULED (published=false + scheduled_publish_time) so they land in the
// Page's "Scheduled" list in Meta Business Suite, where Jessica can read, edit,
// reschedule or delete any of them before they go live. Nothing posts the instant
// the worker runs. Set FB_MODE=publish later if the Chamber wants straight-to-feed.

import fs from 'node:fs';

const API = 'https://graph.facebook.com/v21.0';

export function fbConfig(env = process.env) {
  const pageId = env.FB_PAGE_ID, token = env.FB_PAGE_TOKEN;
  return { pageId, token, mode: env.FB_MODE === 'publish' ? 'publish' : 'schedule', ready: Boolean(pageId && token) };
}

async function call(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || json.error) {
    const e = json.error || {};
    const err = new Error(`Facebook API ${res.status}: ${e.message || text}`);
    err.code = e.code; err.subcode = e.error_subcode; err.fbtrace = e.fbtrace_id;
    throw err;
  }
  return json;
}

// Quick "is the token good?" check used by `npm run check`.
export async function checkPage({ pageId, token }) {
  return call(`${API}/${pageId}?fields=name,link&access_token=${encodeURIComponent(token)}`);
}

export async function postPhoto({ pageId, token, mode }, { imagePath, caption, altText, publishAtEpoch }) {
  const form = new FormData();
  form.append('access_token', token);
  form.append('message', caption);
  if (altText) form.append('alt_text_custom', altText);
  form.append('source', new Blob([fs.readFileSync(imagePath)], { type: 'image/png' }), 'post.png');
  if (mode === 'schedule') {
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(publishAtEpoch));
    form.append('unpublished_content_type', 'SCHEDULED');
  }
  return call(`${API}/${pageId}/photos`, { method: 'POST', body: form });
}
