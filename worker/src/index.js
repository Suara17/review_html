/**
 * review-cards-api — Cloudflare Worker (v2)
 *
 * API 路由:
 *   GET    /api/cards?slug=  — 全部 categories + cards（无 slug）或按 slug 筛选
 *   PUT    /api/cards/sync   — 全量替换（接受 { categories, cards } 或 { slug, cards }）
 *   DELETE /api/cards        — 清空并返回种子数据
 *   POST   /api/tts          — Edge TTS 语音合成
 */

import SEED from '../seed.js';

/* ============================
   CORS
   ============================ */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

/* ============================
   /api/cards — CRUD (v2 扁平格式)
   ============================ */
async function handleCards(request, url, method, env) {
  const slug = url.searchParams.get('slug');

  // ── GET ──
  if (method === 'GET') {
    if (slug) {
      // 旧格式：按 slug 筛选
      const { results } = await env.DB.prepare(
        'SELECT id, slug, category, title, content, sort_order, updated_at FROM cards WHERE slug = ? ORDER BY sort_order'
      ).bind(slug).all();
      return jsonResponse({ slug, cards: results });
    }

    // 新格式：返回全部 categories + cards
    const catResults = await env.DB.prepare(
      'SELECT id, slug, title, label, sort_order FROM categories ORDER BY sort_order'
    ).all();
    const cardResults = await env.DB.prepare(
      'SELECT id, slug, category, title, content, sort_order, updated_at FROM cards ORDER BY sort_order'
    ).all();

    return jsonResponse({
      success: true,
      categories: catResults.results || [],
      cards: cardResults.results || [],
    });
  }

  // ── PUT /api/cards/sync ──
  if (method === 'PUT') {
    const body = await request.json();

    // 旧格式：{ slug, cards }
    if (body.slug && Array.isArray(body.cards)) {
      const delStmt = env.DB.prepare('DELETE FROM cards WHERE slug = ?').bind(body.slug);
      const insStmts = body.cards.map((c, i) =>
        env.DB.prepare(
          'INSERT OR REPLACE INTO cards (id, slug, category, title, content, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          c.id || `${body.slug}--${i}`,
          body.slug,
          c.category || '',
          c.title || '',
          c.content || '',
          typeof c.sort_order === 'number' ? c.sort_order : i
        )
      );
      if (insStmts.length) await env.DB.batch([delStmt, ...insStmts]);
      else await delStmt.run();
      return jsonResponse({ success: true, slug: body.slug, count: body.cards.length });
    }

    // 新格式：{ categories, cards }
    if (Array.isArray(body.categories) && Array.isArray(body.cards)) {
      const cleanCats = env.DB.prepare('DELETE FROM categories');
      const cleanCards = env.DB.prepare('DELETE FROM cards');

      const catStmts = body.categories.map((c) =>
        env.DB.prepare(
          'INSERT OR REPLACE INTO categories (id, slug, title, label, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).bind(c.id, c.slug, c.title, c.label, c.order)
      );
      const cardStmts = body.cards.map((c) =>
        env.DB.prepare(
          'INSERT OR REPLACE INTO cards (id, slug, category, title, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          c.id, c.slug, c.category, c.title, c.content,
          c.order || 0, c.updatedAt || new Date().toISOString()
        )
      );

      await env.DB.batch([cleanCats, cleanCards, ...catStmts, ...cardStmts]);
      return jsonResponse({ success: true, count: { categories: body.categories.length, cards: body.cards.length } });
    }

    return errorResponse('Invalid body format');
  }

  // ── DELETE /api/cards ──
  if (method === 'DELETE') {
    // 清空数据库
    await env.DB.prepare('DELETE FROM categories').run();
    await env.DB.prepare('DELETE FROM cards').run();

    // 写入种子数据
    const catStmts = SEED.categories.map((c) =>
      env.DB.prepare(
        'INSERT INTO categories (id, slug, title, label, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).bind(c.id, c.slug, c.title, c.label, c.order)
    );
    const cardStmts = SEED.cards.map((c) =>
      env.DB.prepare(
        'INSERT INTO cards (id, slug, category, title, content, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(c.id, c.slug, c.category, c.title, c.content, c.order, c.updatedAt)
    );

    await env.DB.batch([...catStmts, ...cardStmts]);

    return jsonResponse({
      success: true,
      data: SEED,
    });
  }

  return errorResponse('Method not allowed', 405);
}

/* ============================
   Edge TTS 常量 & 工具
   ============================ */
const DEFAULT_VOICE     = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_RATE      = '+0%';
const MAX_TEXT_LENGTH   = 4000;
const EDGE_TOKEN_URL    = 'https://edge.microsoft.com/translate/auth';
const EDGE_WSS_BASE     = 'wss://speech.platform.bing.com';
const SEP               = '。\n';
const TTS_TIMEOUT_MS    = 30_000;

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function uuid() { return crypto.randomUUID(); }

function toSeconds(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 100_000) return n / 10_000_000;
  if (n > 1000)    return n / 1000;
  return n;
}

function buildEdgeMessage(path, contentType, body) {
  const header = JSON.stringify({ 'Content-Type': contentType, Path: path, 'X-RequestId': uuid() });
  const enc = new TextEncoder();
  const hb = enc.encode(header);
  const bb = enc.encode(body);
  const buf = new Uint8Array(2 + hb.length + bb.length);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, hb.length, true);
  buf.set(hb, 2);
  buf.set(bb, 2 + hb.length);
  return buf;
}

function parseEdgeMessage(buffer) {
  const buf = new Uint8Array(buffer);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const hLen = dv.getUint16(0, true);
  return { header: JSON.parse(new TextDecoder().decode(buf.slice(2, 2 + hLen))), body: buf.slice(2 + hLen) };
}

function computeSpans(segments, sep) {
  const spans = [];
  let cursor = 0;
  for (const seg of segments) {
    const start = cursor, end = start + (seg.text || '').length;
    spans.push({ index: seg.index, start_offset: start, end_offset: end });
    cursor = end + sep.length;
  }
  return spans;
}

function buildTimeline(fullText, segments, events, sep) {
  if (!segments || !segments.length) return [];
  const spans = computeSpans(segments, sep);
  const timeline = segments.map(s => ({ index: s.index, start: null, end: null }));

  for (const raw of events) {
    const data = raw.data || raw;
    const type = raw.type || data.type || '';
    if (type !== 'WordBoundary' && type !== 'wordBoundary') continue;
    const audioTime = toSeconds(data.audio_offset ?? data.offset ?? data.audioOffset);
    const textOff = data.text?.offset ?? data.text_offset ?? data.textOffset;
    const textLen = data.text?.length ?? data.word_length ?? data.length ?? 1;
    if (audioTime === null || textOff === null || textOff === undefined) continue;
    const endOff = textOff + Math.max(textLen, 1);
    const endTime = Math.max(audioTime + (toSeconds(data.duration) || 0), audioTime);

    for (const sp of spans) {
      if (endOff <= sp.start_offset) break;
      if (textOff >= sp.end_offset) continue;
      const item = timeline[sp.index];
      if (item.start === null || audioTime < item.start) item.start = audioTime;
      if (item.end === null || endTime > item.end) item.end = endTime;
    }
  }

  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].start !== null) { if (timeline[i].end === null) timeline[i].end = timeline[i].start; continue; }
    let prevEnd = null, nextStart = null;
    for (let j = i - 1; j >= 0; j--) { if (timeline[j].end !== null) { prevEnd = timeline[j].end; break; } }
    for (let j = i + 1; j < timeline.length; j++) { if (timeline[j].start !== null) { nextStart = timeline[j].start; break; } }
    if (prevEnd !== null && nextStart !== null) { timeline[i].start = prevEnd; timeline[i].end = Math.max(nextStart, prevEnd); }
    else if (prevEnd !== null) { timeline[i].start = prevEnd; timeline[i].end = prevEnd; }
    else if (nextStart !== null) { timeline[i].start = nextStart; timeline[i].end = nextStart; }
    else { timeline[i].start = 0; timeline[i].end = 0; }
  }

  for (let i = 0; i < timeline.length - 1; i++) { if (timeline[i].end < timeline[i + 1].start) timeline[i].end = timeline[i + 1].start; }
  for (let i = timeline.length - 1; i > 0; i--) { if (timeline[i - 1].end <= timeline[i - 1].start) timeline[i - 1].end = Math.max(timeline[i].start, timeline[i - 1].start); }

  return timeline;
}

async function synthesizeSpeech(fullText, voice, rate, textSegments) {
  const tokenResp = await fetch(EDGE_TOKEN_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://edge.microsoft.com/',
    },
  });
  if (!tokenResp.ok) throw new Error(`Edge token error: HTTP ${tokenResp.status}`);
  const token = await tokenResp.text();

  const connId = uuid();
  const wsUrl = `${EDGE_WSS_BASE}/?trustedclienttoken=${encodeURIComponent(token)}&connectionId=${connId}`;
  const ws = new WebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    const boundaryEvents = [];
    let timeoutId;

    const done = (err, result) => {
      clearTimeout(timeoutId);
      try { ws.close(1000, 'OK'); } catch (_) {}
      if (err) reject(err); else resolve(result);
    };

    timeoutId = setTimeout(() => done(new Error('TTS timeout')), TTS_TIMEOUT_MS);

    ws.onopen = () => {
      try {
        ws.send(buildEdgeMessage('synthesis.context', 'application/json; charset=utf-8', JSON.stringify({
          context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: true }, outputFormat: 'audio-24khz-96kbitrate-mono-mp3' } } },
        })));
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(fullText)}</prosody></voice></speak>`;
        ws.send(buildEdgeMessage('ssml', 'application/ssml+xml', ssml));
      } catch (err) { done(err); }
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') return;
        const { header, body } = parseEdgeMessage(event.data);
        const path = header.Path;
        if (path === 'audio') { audioChunks.push(body); }
        else if (path === 'WordBoundary' || path === 'word.boundary') { try { boundaryEvents.push(JSON.parse(new TextDecoder().decode(body))); } catch (_) {} }
      } catch (_) {}
    };

    ws.onerror = () => done(new Error('WebSocket connection failed'));
    ws.onclose = () => {
      clearTimeout(timeoutId);
      if (audioChunks.length === 0) return done(new Error('No audio received'));
      try {
        const total = audioChunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const chunk of audioChunks) { merged.set(chunk, off); off += chunk.length; }
        let bin = '';
        for (let i = 0; i < merged.length; i++) bin += String.fromCharCode(merged[i]);
        const timeline = buildTimeline(fullText, textSegments || [], boundaryEvents, SEP);
        done(null, { audioBase64: btoa(bin), audioMime: 'audio/mpeg', segments: timeline });
      } catch (err) { done(err); }
    };
  });
}

/* ============================
   /api/tts — POST
   ============================ */
async function handleTTS(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body'); }

  const text = (body.text || '').trim();
  if (!text) return errorResponse('text is required');
  if (text.length > MAX_TEXT_LENGTH) return errorResponse(`text too long (max ${MAX_TEXT_LENGTH})`);

  const voice = body.voice || DEFAULT_VOICE;
  const rate = (typeof body.rate === 'string' && /^[+-]\d+%$/.test(body.rate)) ? body.rate : DEFAULT_RATE;
  const segments = Array.isArray(body.segments) ? body.segments : [];

  try {
    const result = await synthesizeSpeech(text, voice, rate, segments);
    return jsonResponse(result);
  } catch (err) {
    console.error('[TTS]', err);
    return errorResponse('TTS failed: ' + err.message, 500);
  }
}

/* ============================
   入口
   ============================ */
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/api/tts') return await handleTTS(request);
      if (path === '/api/cards' || path === '/api/cards/sync') return await handleCards(request, url, method, env);
      return errorResponse('Not found', 404);
    } catch (err) {
      console.error('[Worker]', err);
      return errorResponse(err.message || 'Internal server error', 500);
    }
  },
};
