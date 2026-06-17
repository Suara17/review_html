/**
 * review-cards-api — Cloudflare Worker
 *
 * API 路由:
 *   GET|PUT|DELETE  /api/cards         — D1 数据库 CRUD（跨设备卡片持久化）
 *   POST            /api/tts           — Edge TTS 语音合成（与 Python edge_tts 相同协议）
 *
 * 部署:
 *   1. cd worker && npm install
 *   2. npx wrangler d1 create review-cards-db
 *   3. 把 database_id 填入 wrangler.toml
 *   4. npx wrangler d1 execute review-cards-db --file=schema.sql
 *   5. npx wrangler deploy
 */

// 出站 WebSocket 连接（用于 Edge TTS 协议）

/* ============================
   CORS
   ============================ */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/* ============================
   Edge TTS 常量
   ============================ */
const DEFAULT_VOICE        = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_RATE         = '+0%';
const MAX_TEXT_LENGTH      = 4000;
const EDGE_TOKEN_URL      = 'https://edge.microsoft.com/translate/auth';
const EDGE_WSS_BASE       = 'wss://speech.platform.bing.com';
const SEGMENT_SEPARATOR   = '。\n';
const TTS_TIMEOUT_MS      = 30_000;

/* ============================
   工具函数
   ============================ */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function uuid() {
  return crypto.randomUUID();
}

function toSeconds(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 100_000) return n / 10_000_000;   // 100-nanosecond → sec
  if (n > 1000)    return n / 1000;           // ms → sec
  return n;
}

/* ============================
   Edge TTS 二进制协议
   ────────────────────────────
  每条消息:
     2B (uint16 LE) = header 长度
     N bytes        = JSON header (UTF-8)
     M bytes        = body (audio = binary; JSON/SSML = UTF-8)
   ============================ */
function buildEdgeMessage(path, contentType, body) {
  const header = JSON.stringify({
    'Content-Type': contentType,
    Path: path,
    'X-RequestId': uuid(),
  });
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
  const header = JSON.parse(new TextDecoder().decode(buf.slice(2, 2 + hLen)));
  return { header, body: buf.slice(2 + hLen) };
}

/* ============================
   段跨度 → 时间线
   ============================ */
function computeSpans(segments, sep) {
  const spans = [];
  let cursor = 0;
  for (const seg of segments) {
    const start = cursor;
    const end   = start + (seg.text || '').length;
    spans.push({ index: seg.index, start_offset: start, end_offset: end });
    cursor = end + sep.length;
  }
  return spans;
}

function buildTimeline(text, segments, events, sep) {
  if (!segments || !segments.length) return [];

  const spans     = computeSpans(segments, sep);
  const timeline  = segments.map(s => ({ index: s.index, start: null, end: null }));
  const hasEvents = events.length > 0;

  // ── 从 word boundary 事件推算各段时间 ──
  if (hasEvents) {
    for (const raw of events) {
      const data = raw.data || raw;
      const type = raw.type || data.type || '';
      if (type !== 'WordBoundary' && type !== 'wordBoundary') continue;

      const audioTime = toSeconds(data.audio_offset ?? data.offset ?? data.audioOffset);
      const textOff   = data.text?.offset ?? data.text_offset ?? data.textOffset;
      const textLen   = data.text?.length ?? data.word_length ?? data.length ?? 1;
      if (audioTime === null || textOff === null || textOff === undefined) continue;

      const endOff  = textOff + Math.max(textLen, 1);
      const endTime = Math.max(audioTime + (toSeconds(data.duration) || 0), audioTime);

      for (const sp of spans) {
        if (endOff <= sp.start_offset) break;
        if (textOff >= sp.end_offset)  continue;
        const item = timeline[sp.index];
        if (item.start === null || audioTime < item.start) item.start = audioTime;
        if (item.end   === null || endTime  > item.end)    item.end   = endTime;
      }
    }
  }

  // ── 填充缺时间段的 ──
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].start !== null) {
      if (timeline[i].end === null) timeline[i].end = timeline[i].start;
      continue;
    }
    // 前后插值
    let prevEnd = null, nextStart = null;
    for (let j = i - 1; j >= 0; j--) { if (timeline[j].end !== null) { prevEnd = timeline[j].end; break; } }
    for (let j = i + 1; j < timeline.length; j++) { if (timeline[j].start !== null) { nextStart = timeline[j].start; break; } }
    if (prevEnd !== null && nextStart !== null) {
      timeline[i].start = prevEnd;
      timeline[i].end   = Math.max(nextStart, prevEnd);
    } else if (prevEnd !== null) {
      timeline[i].start = prevEnd;
      timeline[i].end   = prevEnd;
    } else if (nextStart !== null) {
      timeline[i].start = nextStart;
      timeline[i].end   = nextStart;
    } else {
      timeline[i].start = 0;
      timeline[i].end   = 0;
    }
  }

  // ── 修正间隙 ──
  for (let i = 0; i < timeline.length - 1; i++) {
    if (timeline[i].end < timeline[i + 1].start) timeline[i].end = timeline[i + 1].start;
  }
  for (let i = timeline.length - 1; i > 0; i--) {
    if (timeline[i - 1].end <= timeline[i - 1].start) {
      timeline[i - 1].end = Math.max(timeline[i].start, timeline[i - 1].start);
    }
  }

  return timeline;
}

/* ============================
   Edge TTS WebSocket 合成
   ============================ */
async function synthesizeSpeech(fullText, voice, rate, textSegments) {
  // 1. 获取令牌
  const tokenResp = await fetch(EDGE_TOKEN_URL);
  if (!tokenResp.ok) throw new Error(`Edge token error: HTTP ${tokenResp.status}`);
  const token = await tokenResp.text();

  // 2. 连接 WebSocket
  const connId = uuid();
  const wsUrl  = `${EDGE_WSS_BASE}/?trustedclienttoken=${encodeURIComponent(token)}&connectionId=${connId}`;
  const ws     = new WebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    const audioChunks    = [];
    const boundaryEvents = [];
    let   timeoutId;

    const done = (err, result) => {
      clearTimeout(timeoutId);
      try { ws.close(1000, 'OK'); } catch (_) { /* noop */ }
      if (err) reject(err);
      else     resolve(result);
    };

    timeoutId = setTimeout(() => done(new Error('TTS timeout')), TTS_TIMEOUT_MS);

    ws.onopen = () => {
      try {
        // 合成配置
        ws.send(buildEdgeMessage('synthesis.context', 'application/json; charset=utf-8', JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: true },
                outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
              },
            },
          },
        })));

        // SSML
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
          <voice name="${escapeXml(voice)}">
            <prosody rate="${escapeXml(rate)}">${escapeXml(fullText)}</prosody>
          </voice>
        </speak>`;
        ws.send(buildEdgeMessage('ssml', 'application/ssml+xml', ssml));
      } catch (err) {
        done(err);
      }
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          // turn.start / turn.end 等文本消息
          if (event.data.includes('turn.end')) {
            // 标记完成，但等 onclose 再处理（确保 audio 全部到达）
          }
          return;
        }

        const { header, body } = parseEdgeMessage(event.data);
        const path = header.Path;

        if (path === 'audio') {
          audioChunks.push(body);
        } else if (path === 'WordBoundary' || path === 'word.boundary') {
          try {
            const json = JSON.parse(new TextDecoder().decode(body));
            boundaryEvents.push(json);
          } catch (_) { /* skip malformed */ }
        }
        // turn.start / turn.end 等可忽略
      } catch (_) { /* per-message error */ }
    };

    ws.onerror = () => done(new Error('WebSocket connection failed'));

    ws.onclose = () => {
      clearTimeout(timeoutId);

      if (audioChunks.length === 0) {
        return done(new Error('No audio received from Edge TTS'));
      }

      try {
        // ── 合并音频 ──
        const total = audioChunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const chunk of audioChunks) { merged.set(chunk, off); off += chunk.length; }

        // ── base64 ──
        let bin = '';
        for (let i = 0; i < merged.length; i++) bin += String.fromCharCode(merged[i]);
        const audioBase64 = btoa(bin);

        // ── 时间线 ──
        const timeline = buildTimeline(fullText, textSegments || [], boundaryEvents, SEGMENT_SEPARATOR);

        done(null, { audioBase64, audioMime: 'audio/mpeg', segments: timeline });
      } catch (err) {
        done(err);
      }
    };
  });
}

/* ============================
   /api/tts — POST
   ============================ */
async function handleTTS(request) {
  let body;
  try { body = await request.json(); }
  catch { return errorResponse('Invalid JSON body'); }

  const text = (body.text || '').trim();
  if (!text)                          return errorResponse('text is required');
  if (text.length > MAX_TEXT_LENGTH)  return errorResponse(`text too long (max ${MAX_TEXT_LENGTH})`);

  const voice    = body.voice || DEFAULT_VOICE;
  const rate     = (typeof body.rate === 'string' && /^[+-]\d+%$/.test(body.rate)) ? body.rate : DEFAULT_RATE;
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
   /api/cards — CRUD
   ============================ */
async function handleCards(request, url, method, env) {
  // GET   /api/cards?slug=xxx
  if (method === 'GET') {
    const slug = url.searchParams.get('slug');
    if (!slug) return errorResponse('Missing slug parameter');

    const { results } = await env.DB.prepare(
      'SELECT id, title, content, sort_order, card_key FROM cards WHERE page_slug = ? ORDER BY sort_order, id'
    ).bind(slug).all();
    return jsonResponse({ slug, cards: results });
  }

  // PUT   /api/cards/sync
  if (method === 'PUT') {
    const body = await request.json();
    const { slug, cards } = body;
    if (!slug || !Array.isArray(cards)) return errorResponse('Missing slug or cards array');

    const delStmt  = env.DB.prepare('DELETE FROM cards WHERE page_slug = ?').bind(slug);
    const insStmts = cards.map((c, i) =>
      env.DB.prepare(
        'INSERT INTO cards (page_slug, card_key, title, content, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).bind(slug, c.card_key || null, c.title || '', c.content || '', typeof c.sort_order === 'number' ? c.sort_order : i)
    );

    await env.DB.batch([delStmt, ...insStmts]);
    return jsonResponse({ success: true, slug, count: cards.length });
  }

  // DELETE /api/cards?slug=xxx
  if (method === 'DELETE') {
    const slug = url.searchParams.get('slug');
    if (!slug) return errorResponse('Missing slug parameter');

    await env.DB.prepare('DELETE FROM cards WHERE page_slug = ?').bind(slug).run();
    return jsonResponse({ success: true, slug });
  }

  return errorResponse('Method not allowed for /api/cards', 405);
}

/* ============================
   入口
   ============================ */
export default {
  async fetch(request, env, ctx) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    try {
      // TTS 合成
      if (method === 'POST' && path === '/api/tts') {
        return await handleTTS(request);
      }

      // D1 数据库 CRUD
      if (path === '/api/cards' || path.startsWith('/api/cards/')) {
        return await handleCards(request, url, method, env);
      }

      return errorResponse('Not found', 404);
    } catch (err) {
      console.error('[Worker]', err);
      return errorResponse(err.message || 'Internal server error', 500);
    }
  },
};
