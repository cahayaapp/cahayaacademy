const DB_DEFAULT = 'https://cahayaacademy-f8787-default-rtdb.firebaseio.com';
const TICKET_TTL_MS = 90_000;
const BUFFER_LIMIT = 64 * 1024 * 1024;

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin') || '';
      const allowed = allowedOrigins(env);

      if (request.method === 'OPTIONS') {
        return corsResponse(new Response(null, { status: 204 }), origin, allowed);
      }

      if (url.pathname === '/health') {
        return json({ ok: true, service: 'belajarislam-download-gateway' }, 200, origin, allowed);
      }

      if (url.pathname === '/prepare' && request.method === 'POST') {
        if (!origin || !allowed.has(origin)) return json({ error: 'Origin tidak diizinkan.' }, 403, origin, allowed);
        const authHeader = request.headers.get('Authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (!idToken) return json({ error: 'Sesi login tidak valid.' }, 401, origin, allowed);

        const body = await request.json().catch(() => ({}));
        const ebookId = safeId(body.ebookId);
        if (!ebookId) return json({ error: 'Ebook tidak valid.' }, 400, origin, allowed);

        const uid = decodeFirebaseUid(idToken);
        if (!uid) return json({ error: 'Token login tidak valid.' }, 401, origin, allowed);

        const dbUrl = String(env.FIREBASE_DB_URL || DB_DEFAULT).replace(/\/+$/, '');
        const [profile, access, ebook] = await Promise.all([
          firebaseGet(dbUrl, `users/${uid}`, idToken),
          firebaseGet(dbUrl, `ebookAccess/${uid}/${ebookId}`, idToken),
          firebaseGet(dbUrl, `ebooks/${ebookId}`, idToken)
        ]);

        const privileged = profile?.role === 'admin' || profile?.role === 'mentor';
        if (!privileged && access?.status !== 'active') {
          return json({ error: 'Ebook belum menjadi milik akun ini.' }, 403, origin, allowed);
        }

        const source = await firebaseGet(dbUrl, `ebookSources/${ebookId}`, idToken);
        if (!source || source.mode !== 'gdrive' || !source.fileId) {
          return json({ error: 'Sumber file ebook belum siap.' }, 404, origin, allowed);
        }

        const ticketPayload = {
          fileId: String(source.fileId),
          resourceKey: String(source.resourceKey || ''),
          fileName: safePdfName(ebook?.fileName || ebook?.title || 'ebook.pdf'),
          exp: Date.now() + TICKET_TTL_MS
        };
        const ticket = await encryptTicket(ticketPayload, env.DOWNLOAD_SECRET);
        const downloadUrl = `${url.origin}/download?t=${encodeURIComponent(ticket)}`;
        return json({ downloadUrl, expiresIn: Math.floor(TICKET_TTL_MS / 1000) }, 200, origin, allowed);
      }

      if (url.pathname === '/download' && request.method === 'GET') {
        const ticket = url.searchParams.get('t') || '';
        if (!ticket) return plain('Ticket download tidak tersedia.', 400);
        const payload = await decryptTicket(ticket, env.DOWNLOAD_SECRET);
        if (!payload || Number(payload.exp || 0) < Date.now()) return plain('Link download sudah kedaluwarsa. Silakan klik Download Ebook lagi.', 410);

        const upstream = await fetchDriveFile(payload.fileId, payload.resourceKey);
        if (!upstream.ok) return plain(`File tidak dapat diunduh (${upstream.status}).`, 502);

        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.includes('text/html')) return plain('Google Drive tidak mengirim file PDF. Pastikan file dapat diakses melalui link.', 502);

        const headers = new Headers();
        headers.set('Content-Type', contentType.includes('application/pdf') ? contentType : 'application/pdf');
        headers.set('Content-Disposition', contentDisposition(payload.fileName));
        headers.set('Cache-Control', 'private, no-store, max-age=0');
        headers.set('Pragma', 'no-cache');
        headers.set('X-Content-Type-Options', 'nosniff');

        const len = Number(upstream.headers.get('content-length') || 0);
        if (len > 0 && len <= BUFFER_LIMIT) {
          const bytes = await upstream.arrayBuffer();
          return new Response(bytes, { status: 200, headers });
        }
        return new Response(upstream.body, { status: 200, headers });
      }

      return plain('Not found', 404);
    } catch (err) {
      return json({ error: friendlyError(err) }, 500, request.headers.get('Origin') || '', allowedOrigins(env));
    }
  }
};

function allowedOrigins(env) {
  const values = String(env.ALLOWED_ORIGINS || 'https://belajarislam.online,https://www.belajarislam.online')
    .split(',').map(v => v.trim()).filter(Boolean);
  return new Set(values);
}

function corsResponse(response, origin, allowed) {
  const out = new Response(response.body, response);
  if (origin && allowed.has(origin)) {
    out.headers.set('Access-Control-Allow-Origin', origin);
    out.headers.set('Vary', 'Origin');
    out.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    out.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    out.headers.set('Access-Control-Max-Age', '86400');
  }
  return out;
}

function json(value, status = 200, origin = '', allowed = new Set()) {
  const res = new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  return corsResponse(res, origin, allowed);
}

function plain(text, status = 200) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function firebaseGet(dbUrl, path, idToken) {
  const endpoint = `${dbUrl}/${path}.json?auth=${encodeURIComponent(idToken)}`;
  const res = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new Error('Firebase menolak sesi pengguna atau Rules belum sesuai.');
  if (!res.ok) throw new Error(`Firebase error ${res.status}`);
  return await res.json();
}

function decodeFirebaseUid(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const data = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
    return String(data.user_id || data.sub || '');
  } catch (_) { return ''; }
}

async function fetchDriveFile(fileId, resourceKey = '') {
  const urls = [];
  const u1 = new URL('https://drive.usercontent.google.com/download');
  u1.searchParams.set('id', fileId);
  u1.searchParams.set('export', 'download');
  u1.searchParams.set('confirm', 't');
  if (resourceKey) u1.searchParams.set('resourcekey', resourceKey);
  urls.push(u1);

  const u2 = new URL('https://drive.google.com/uc');
  u2.searchParams.set('export', 'download');
  u2.searchParams.set('id', fileId);
  u2.searchParams.set('confirm', 't');
  if (resourceKey) u2.searchParams.set('resourcekey', resourceKey);
  urls.push(u2);

  let last;
  for (const url of urls) {
    let res = await fetch(url.toString(), { redirect: 'follow', headers: { 'Accept': 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8' } });
    last = res;
    const type = res.headers.get('content-type') || '';
    if (res.ok && !type.includes('text/html')) return res;
    if (res.ok && type.includes('text/html')) {
      const html = await res.text();
      const confirmedUrl = parseDriveConfirmForm(html, res.url);
      if (confirmedUrl) {
        res = await fetch(confirmedUrl, { redirect: 'follow', headers: { 'Accept': 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8' } });
        last = res;
        const type2 = res.headers.get('content-type') || '';
        if (res.ok && !type2.includes('text/html')) return res;
      }
    }
  }
  return last || new Response(null, { status: 502 });
}

function parseDriveConfirmForm(html, baseUrl) {
  try {
    const formMatch = html.match(/<form[^>]+(?:id=["']download-form["'][^>]*|action=["'][^"']+["'][^>]*)>/i);
    if (!formMatch) return '';
    const actionMatch = formMatch[0].match(/action=["']([^"']+)["']/i);
    if (!actionMatch) return '';
    const url = new URL(actionMatch[1].replace(/&amp;/g, '&'), baseUrl);
    const inputRe = /<input[^>]+type=["']hidden["'][^>]*>/gi;
    for (const tag of html.match(inputRe) || []) {
      const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
      const value = tag.match(/value=["']([^"']*)["']/i)?.[1] || '';
      if (name) url.searchParams.set(name, value.replace(/&amp;/g, '&'));
    }
    return url.toString();
  } catch (_) { return ''; }
}

async function encryptTicket(payload, secret) {
  if (!secret || String(secret).length < 32) throw new Error('DOWNLOAD_SECRET Worker belum diatur atau terlalu pendek.');
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(secret))), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv); combined.set(encrypted, iv.length);
  return base64urlEncode(combined);
}

async function decryptTicket(ticket, secret) {
  if (!secret || String(secret).length < 32) throw new Error('DOWNLOAD_SECRET Worker belum diatur.');
  const raw = base64urlDecode(ticket);
  if (raw.length < 13) throw new Error('Ticket download tidak valid.');
  const iv = raw.slice(0, 12), encrypted = raw.slice(12);
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(secret))), 'AES-GCM', false, ['decrypt']);
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return JSON.parse(new TextDecoder().decode(data));
}

function base64urlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function safeId(value) { return /^[A-Za-z0-9_-]{1,160}$/.test(String(value || '')) ? String(value) : ''; }
function safePdfName(value) {
  let name = String(value || 'ebook.pdf').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 160);
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  return name || 'ebook.pdf';
}
function contentDisposition(name) {
  const ascii = name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
function friendlyError(err) {
  if (String(err?.name) === 'AbortError') return 'Proses download timeout.';
  return String(err?.message || err || 'Terjadi kesalahan pada download gateway.').slice(0, 220);
}
