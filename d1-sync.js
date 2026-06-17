/* d1-sync.js — 前端 ↔ Cloudflare D1 数据库同步层
 *
 * 职责:
 *   - 页面加载时优先从 D1 拉取数据（作为 source of truth）
 *   - 用户增删改后自动推送变更到 D1
 *   - 离线时静默降级到本地 IndexedDB
 *
 * 使用方式（在模板中已集成）:
 *   1. 在 inline script 中设置 window.__D1_API_URL__（Worker 部署地址）
 *   2. 确认 <script src="./d1-sync.js"> 在 db-manager.js 之后加载
 *
 * 数据优先级: D1 云端 > IndexedDB 本地缓存 > 页面内置种子数据
 */
(function () {
  'use strict';

  var API_URL = '';            // 从 script data-api-url 或全局变量读取
  var _pushTimer = null;
  var _pushInFlight = false;

  /* ── 配置读取 ── */
  function resolveApiUrl() {
    if (API_URL) return API_URL;
    // 优先从全局变量读取（可在模板 inline script 中设置）
    if (window.__D1_API_URL__) {
      API_URL = window.__D1_API_URL__;
      return API_URL;
    }
    // 其次从 <script data-api-url> 属性读取
    var script = document.querySelector('script[src*="d1-sync"]');
    if (script) {
      var url = script.getAttribute('data-api-url');
      if (url) {
        API_URL = url;
        return API_URL;
      }
    }
    return '';
  }

  function getSlug() {
    return window.__PAGE_SLUG__ || '';
  }

  /* ── 从 D1 获取卡片 ── */
  async function fetchCards(slug) {
    var baseUrl = resolveApiUrl();
    if (!baseUrl) return null;

    var url = baseUrl.replace(/\/+$/, '') + '/api/cards?slug=' + encodeURIComponent(slug);
    var res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('D1 fetch failed: HTTP ' + res.status);
    var data = await res.json();
    return data.cards || [];
  }

  /* ── 推送全部卡片到 D1 ── */
  async function pushCards(slug, cards) {
    var baseUrl = resolveApiUrl();
    if (!baseUrl) return;

    var url = baseUrl.replace(/\/+$/, '') + '/api/cards/sync';
    var payload = cards.map(function (c, i) {
      return {
        title: c.title || '',
        content: c.content || '',
        card_key: c.id || null,
        sort_order: typeof c.sort_order === 'number' ? c.sort_order : i,
      };
    });

    var res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug, cards: payload }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('D1 push failed: HTTP ' + res.status);
  }

  /* ── 删除某页面的全部 D1 数据（强制重置时调用） ── */
  async function resetCards(slug) {
    var baseUrl = resolveApiUrl();
    if (!baseUrl) return;

    var url = baseUrl.replace(/\/+$/, '') + '/api/cards?slug=' + encodeURIComponent(slug);
    var res = await fetch(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('D1 reset failed: HTTP ' + res.status);
  }

  /* ── 防抖推送 ── */
  function schedulePush() {
    if (_pushTimer) clearTimeout(_pushTimer);
    _pushTimer = setTimeout(function () {
      _pushTimer = null;
      if (_pushInFlight) return;
      _pushInFlight = true;

      var slug = getSlug();
      var kp = window.knowledgePoints;
      if (!slug || !kp || !kp.length) {
        _pushInFlight = false;
        return;
      }

      var cards = [];
      for (var i = 0; i < kp.length; i++) {
        cards.push({
          id: kp[i].id,
          title: kp[i].title,
          content: kp[i].content,
          sort_order: i,
        });
      }

      pushCards(slug, cards).catch(function (err) {
        console.warn('[D1Sync] push failed (will retry on next change):', err);
      }).finally(function () {
        _pushInFlight = false;
      });
    }, 1200); // 1.2 秒防抖
  }

  /* ── 包装 DbManager 的突变方法，自动触发推送 ── */
  function patchDbManager() {
    if (typeof DbManager === 'undefined') return false;
    if (window.__D1_PATCHED__) return true;

    var methodsToPatch = ['updateCard', 'syncFromArray', 'addCard', 'deleteCard', 'reorderCards'];
    methodsToPatch.forEach(function (name) {
      var orig = DbManager[name];
      if (!orig || orig.__d1patched) return;
      DbManager[name] = function () {
        var result = orig.apply(this, arguments);
        schedulePush();
        return result;
      };
      DbManager[name].__d1patched = true;
    });

    window.__D1_PATCHED__ = true;
    return true;
  }

  /* ── 公开接口 ── */
  window.D1Sync = {

    /** 初始化：尝试从 D1 拉取该 slug 的卡片，成功则返回数组，失败返回 null */
    init: async function (slug) {
      try {
        var cards = await fetchCards(slug);
        if (cards && cards.length > 0) return cards;
      } catch (e) {
        console.info('[D1Sync] D1 unavailable, using local cache:', e.message);
      }
      return null;
    },

    /** 获取当前配置的 API URL */
    getApiUrl: function () {
      return resolveApiUrl();
    },

    /** 检查 D1 是否已配置 */
    isConfigured: function () {
      return !!resolveApiUrl();
    },

    /** 手动触发推送 */
    flush: function () {
      schedulePush();
    },

    /** 强制重置 D1 数据 */
    reset: async function (slug) {
      await resetCards(slug);
    },

    /** 启动自动同步（包装 DbManager 方法） */
    startAutoSync: function () {
      if (resolveApiUrl()) {
        patchDbManager();
      }
    },
  };

  /* ── 自动启动（等待 DbManager 就绪） ── */
  function tryPatch() {
    if (patchDbManager()) return;
    setTimeout(tryPatch, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryPatch);
  } else {
    setTimeout(tryPatch, 200);
  }
})();
