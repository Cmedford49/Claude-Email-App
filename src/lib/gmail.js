const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function api(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return {};
  return res.json();
}

export async function fetchThreads(token, query = 'in:inbox', maxResults = 50) {
  const data = await api(`${BASE}/threads?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, token);
  if (!data.threads?.length) return [];
  const threads = await Promise.allSettled(data.threads.map(t => fetchThread(token, t.id)));
  return threads.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
}

export async function fetchThread(token, threadId) {
  try {
    const data = await api(`${BASE}/threads/${threadId}?format=full`, token);
    return parseThread(data);
  } catch (e) { console.error('Thread fetch failed', threadId, e); return null; }
}

export async function fetchLabels(token) {
  const data = await api(`${BASE}/labels`, token);
  return (data.labels || []).filter(l => !['CATEGORY_SOCIAL','CATEGORY_PROMOTIONS','CATEGORY_UPDATES','CATEGORY_FORUMS'].includes(l.id));
}

export async function deleteThread(token, threadId) {
  await api(`${BASE}/threads/${threadId}/trash`, token, { method: 'POST', body: '{}' });
}

export async function archiveThread(token, threadId) {
  await api(`${BASE}/threads/${threadId}/modify`, token, {
    method: 'POST', body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
  });
}

export async function markRead(token, threadId) {
  await api(`${BASE}/threads/${threadId}/modify`, token, {
    method: 'POST', body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
}

export async function markUnread(token, threadId) {
  await api(`${BASE}/threads/${threadId}/modify`, token, {
    method: 'POST', body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
  });
}

export async function starThread(token, threadId) {
  await api(`${BASE}/threads/${threadId}/modify`, token, {
    method: 'POST', body: JSON.stringify({ addLabelIds: ['STARRED'] }),
  });
}

export async function moveThread(token, threadId, addLabelId, removeLabelId) {
  await api(`${BASE}/threads/${threadId}/modify`, token, {
    method: 'POST',
    body: JSON.stringify({
      addLabelIds: addLabelId ? [addLabelId] : [],
      removeLabelIds: removeLabelId ? [removeLabelId] : ['INBOX'],
    }),
  });
}

export async function sendEmail(token, { to, cc, bcc, subject, body, replyToMessageId, threadId }) {
  const headers = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    body,
  ].filter(Boolean).join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(headers))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return api(`${BASE}/messages/send`, token, {
    method: 'POST',
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  });
}

export async function saveDraft(token, { to, cc, subject, body, replyToMessageId, threadId }) {
  const headers = [
    `To: ${to || ''}`,
    cc ? `Cc: ${cc}` : '',
    `Subject: ${subject || ''}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    body || '',
  ].filter(Boolean).join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(headers))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return api(`${BASE}/drafts`, token, {
    method: 'POST',
    body: JSON.stringify({ message: { raw, ...(threadId ? { threadId } : {}) } }),
  });
}

function parseThread(thread) {
  if (!thread?.messages?.length) return null;
  const messages = thread.messages.map(parseMessage).filter(Boolean);
  if (!messages.length) return null;
  const latest = messages[messages.length - 1];
  const isUnread = thread.messages.some(m => m.labelIds?.includes('UNREAD'));
  const isStarred = thread.messages.some(m => m.labelIds?.includes('STARRED'));
  return {
    id: thread.id,
    messages,
    subject: latest.subject,
    from: latest.from,
    fromEmail: latest.fromEmail,
    fromInitials: latest.fromInitials,
    to: latest.to,
    date: latest.date,
    snippet: latest.snippet,
    body: latest.body,
    isUnread,
    isStarred,
    labelIds: thread.messages.flatMap(m => m.labelIds || []),
    messageCount: messages.length,
  };
}

function parseMessage(msg) {
  if (!msg?.payload) return null;
  const headers = msg.payload.headers || [];
  const h = (name) => headers.find(x => x.name.toLowerCase() === name.toLowerCase())?.value || '';
  const from = h('From');
  const fromName = from.includes('<') ? from.split('<')[0].trim().replace(/"/g,'') : from.split('@')[0];
  const fromEmail = from.match(/<(.+)>/)?.[1] || from;
  const ini = fromName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return {
    id: msg.id,
    subject: h('Subject') || '(no subject)',
    from: fromName || fromEmail,
    fromEmail,
    fromInitials: ini,
    to: h('To'),
    cc: h('Cc'),
    date: h('Date') ? new Date(h('Date')).toISOString() : new Date().toISOString(),
    snippet: decodeEntities(msg.snippet || ''),
    body: extractBody(msg.payload),
    labelIds: msg.labelIds || [],
  };
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/html' && payload.body?.data) return decode64(payload.body.data);
  if (payload.mimeType === 'text/plain' && payload.body?.data) return `<pre style="font-family:inherit;white-space:pre-wrap">${decode64(payload.body.data)}</pre>`;
  if (payload.parts) {
    const html = payload.parts.find(p => p.mimeType === 'text/html');
    if (html?.body?.data) return decode64(html.body.data);
    const plain = payload.parts.find(p => p.mimeType === 'text/plain');
    if (plain?.body?.data) return `<pre style="font-family:inherit;white-space:pre-wrap">${decode64(plain.body.data)}</pre>`;
    for (const part of payload.parts) { const b = extractBody(part); if (b) return b; }
  }
  return '';
}

function decode64(data) {
  try { return decodeURIComponent(escape(atob(data.replace(/-/g,'+').replace(/_/g,'/')))); }
  catch { return ''; }
}

function decodeEntities(str) {
  return str.replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n))
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();
}
