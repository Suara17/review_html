/**
 * review-cards-api — Cloudflare Worker
 *
 * API 路由:
 *   GET|PUT|DELETE  /api/cards         — D1 数据库 CRUD（跨设备卡片持久化）
 *   POST            /api/tts           — TTS 反向代理 → 转发到 Vercel Python API
 *
 * 部署:
 *   1. cd worker && npm install
 *   2. npx wrangler d1 create review-cards-db
 *   3. 把 database_id 填入 wrangler.toml
 *   4. npx wrangler d1 execute review-cards-db --file=schema.sql
 *   5. npx wrangler deploy
 */

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

/* ============================
   TTS — 反向代理到 Vercel Python API
   ─────────────────────────────
   Worker 无法直连 Edge TTS WebSocket（CF IP 段被屏蔽），
   改用上游 Vercel Python API 合成，Worker 只做透明转发。
   这样可以：
   ① 前端保持同一 API 入口（统一设置 __API_BASE__）
   ② 利用 Cloudflare 边缘缓存加速重复请求
   ③ TTS 合成实际由 Vercel Python + edge_tts 完成
   ============================ */
async function handleTTSProxy(request, env) {
  // 上游 TTS 地址：优先从环境变量读取
  let upstream = (env && env.TTS_UPSTREAM) || '';

  // 未配置上游时，从请求来源推断（自动回落到 Vercel 同源）
  if (!upstream) {
    const referer = request.headers.get('Referer') || '';
    const origin = request.headers.get('Origin') || '';
    upstream = origin || (referer ? new URL(referer).origin : '');
  }

  if (!upstream) {
    return errorResponse(
      'TTS upstream not configured and cannot infer from request. ' +
      'Set TTS_UPSTREAM in wrangler.toml [vars] to enable proxy, ' +
      'or set window.__API_BASE__ = "" in frontend to call Vercel directly.',
      501
    );
  }

  try {
    // 构建上游请求（透传 body + headers）
    const upstreamUrl = upstream.replace(/\/+$/, '') + '/api/tts';
    const body = await request.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await upstreamResponse.json();
    const status = upstreamResponse.ok ? 200 : (upstreamResponse.status || 502);
    return jsonResponse(data, status);
  } catch (err) {
    console.error('[TTS Proxy]', err);
    return errorResponse('TTS proxy failed: ' + err.message, 502);
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
      // TTS 合成 → 转发到上游 Vercel Python API
      if (method === 'POST' && path === '/api/tts') {
        return await handleTTSProxy(request, env);
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
