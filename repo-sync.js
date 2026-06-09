(function () {
  'use strict';

  var TOKEN_KEY = 'repo-sync-token';
  var OWNER_KEY = 'repo-sync-owner';
  var REPO_KEY = 'repo-sync-repo';
  var SHA_KEY_PREFIX = 'repo-sync-sha:';
  var DEFAULT_OWNER = 'Suara17';
  var DEFAULT_REPO = 'review_html';
  var API_ROOT = 'https://api.github.com';
  var JSON_BASE_PATH = 'data/sidebar-state';
  var STATUS_ID = 'repo-sync-status';
  var ACTIONS_ID = 'repo-sync-actions';

  function getPageSlug() {
    return window.__PAGE_SLUG__ || document.body.getAttribute('data-page-id') || '';
  }

  function getFilePath() {
    return JSON_BASE_PATH + '/' + getPageSlug() + '.json';
  }

  function getShaStorageKey() {
    return SHA_KEY_PREFIX + getPageSlug();
  }

  function getCachedSha() {
    return localStorage.getItem(getShaStorageKey()) || '';
  }

  function setCachedSha(sha) {
    if (sha) localStorage.setItem(getShaStorageKey(), sha);
  }

  function clearCachedSha() {
    localStorage.removeItem(getShaStorageKey());
  }

  function toBase64Unicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64Unicode(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  function readConfig() {
    return {
      token: localStorage.getItem(TOKEN_KEY) || '',
      owner: localStorage.getItem(OWNER_KEY) || DEFAULT_OWNER,
      repo: localStorage.getItem(REPO_KEY) || DEFAULT_REPO
    };
  }

  function writeConfig(cfg) {
    localStorage.setItem(OWNER_KEY, cfg.owner || DEFAULT_OWNER);
    localStorage.setItem(REPO_KEY, cfg.repo || DEFAULT_REPO);
    if (cfg.token) localStorage.setItem(TOKEN_KEY, cfg.token);
  }

  function ensureConfig() {
    var cfg = readConfig();
    if (!cfg.token) {
      cfg.token = window.prompt('请输入 GitHub PAT（需要 repo 权限）', cfg.token || '');
      if (!cfg.token) return null;
    }
    if (!cfg.owner) cfg.owner = window.prompt('GitHub owner', DEFAULT_OWNER) || DEFAULT_OWNER;
    if (!cfg.repo) cfg.repo = window.prompt('GitHub repo', DEFAULT_REPO) || DEFAULT_REPO;
    writeConfig(cfg);
    return cfg;
  }

  function getStatusEl() {
    return document.getElementById(STATUS_ID);
  }

  function setStatus(message, type) {
    var el = getStatusEl();
    if (!el) return;
    el.textContent = message || '';
    el.className = 'repo-sync-status ' + (type || '');
  }

  function normalizeStateFromKnowledgePoints(knowledgePoints) {
    var items = [];
    var order = [];
    for (var i = 0; i < knowledgePoints.length; i++) {
      var kp = knowledgePoints[i] || {};
      items.push({
        id: kp.id || ('kp-' + (i + 1)),
        title: String(kp.title || '').replace(/^\s*\d+\s*[.．、]\s*/, ''),
        content: kp.content || ''
      });
      order.push(i);
    }
    return {
      page_id: getPageSlug(),
      updated_at: new Date().toISOString(),
      state: { items: items, order: order }
    };
  }

  async function parseGitHubError(res) {
    var text = await res.text();
    var payload = null;
    try { payload = JSON.parse(text); } catch (e) {}
    var message = (payload && (payload.message || payload.error)) || text || ('HTTP ' + res.status);

    if (res.status === 401) {
      return 'GitHub Token 无效或已过期，请重新填写 PAT。';
    }
    if (res.status === 403) {
      if (/rate limit/i.test(message)) return 'GitHub API 触发限流，请稍后再试。';
      return '没有权限访问该仓库，请确认 PAT 具备 repo 权限，且 owner/repo 填写正确。';
    }
    if (res.status === 404) {
      return '仓库或文件不存在，请确认 owner/repo 正确，且 PAT 对该仓库有访问权限。';
    }
    if (res.status === 409 || /sha/i.test(message)) {
      return '检测到远端文件已变更（SHA 冲突）。请先点“从 GitHub 拉取”，确认是否覆盖本地缓存后再重新保存。';
    }
    if (res.status === 422) {
      return '提交内容未通过 GitHub 校验，请检查仓库状态、分支保护或文件内容是否合法。';
    }
    return 'GitHub 请求失败：' + res.status + ' ' + message;
  }

  async function fetchRepoFile(cfg) {
    var url = API_ROOT + '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + getFilePath();
    var res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + cfg.token
      }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(await parseGitHubError(res));
    }
    var json = await res.json();
    if (json && json.sha) setCachedSha(json.sha);
    return json;
  }

  async function saveRepoFile(cfg, payload, sha) {
    var url = API_ROOT + '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + getFilePath();
    var body = {
      message: 'chore: update sidebar state for ' + getPageSlug(),
      content: toBase64Unicode(JSON.stringify(payload, null, 2) + '\n')
    };
    if (sha) body.sha = sha;
    var res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + cfg.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(await parseGitHubError(res));
    }
    return await res.json();
  }

  function applyRemoteState(payload) {
    if (!payload || !payload.state || !Array.isArray(payload.state.items)) return false;
    if (!window.knowledgePoints || !window.sidebarMgr) return false;
    var items = payload.state.items;
    var order = Array.isArray(payload.state.order) ? payload.state.order : items.map(function (_, i) { return i; });
    var mapped = [];
    for (var i = 0; i < order.length; i++) {
      var item = items[order[i]];
      if (!item) continue;
      mapped.push({ id: item.id, title: (mapped.length + 1) + '. ' + item.title, content: item.content });
    }
    window.knowledgePoints.length = 0;
    mapped.forEach(function (item) { window.knowledgePoints.push(item); });
    window.sidebarMgr.syncFromKnowledgePoints();
    if (typeof window.showKnowledge === 'function') {
      window.index = Math.min(window.index || 0, Math.max(window.knowledgePoints.length - 1, 0));
      window.showKnowledge();
    }
    return true;
  }

  async function pullFromGitHub() {
    var cfg = ensureConfig();
    if (!cfg) return;
    if (!window.confirm('从 GitHub 拉取会覆盖当前浏览器里的本地缓存。\n\n如果你本地还有未保存改动，请先点“保存到 GitHub”。\n\n确定继续拉取并覆盖吗？')) {
      setStatus('已取消拉取，保留本地缓存。', 'warn');
      return;
    }
    setStatus('正在从 GitHub 拉取...', '');
    try {
      var remote = await fetchRepoFile(cfg);
      if (!remote) {
        setStatus('GitHub 上还没有这个页面的 JSON 文件。', 'warn');
        return;
      }
      var payload = JSON.parse(fromBase64Unicode(remote.content || ''));
      var ok = applyRemoteState(payload);
      if (ok) {
        localStorage.setItem('sidebar-data:' + location.pathname, JSON.stringify(payload.state));
        if (remote.sha) setCachedSha(remote.sha);
        setStatus('已从 GitHub 拉取，并覆盖当前浏览器本地缓存。', 'success');
      } else {
        setStatus('拉取成功，但当前页面尚未完成初始化，请刷新后重试。', 'warn');
      }
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  async function pushToGitHub() {
    var cfg = ensureConfig();
    if (!cfg) return;
    if (!window.knowledgePoints || !window.knowledgePoints.length) {
      setStatus('当前没有可保存的知识点。', 'warn');
      return;
    }
    setStatus('正在保存到 GitHub...', '');
    try {
      var sha = getCachedSha() || null;
      if (!sha) {
        var current = await fetchRepoFile(cfg);
        sha = current && current.sha ? current.sha : null;
      }
      var payload = normalizeStateFromKnowledgePoints(window.knowledgePoints);
      var saved = await saveRepoFile(cfg, payload, sha);
      var savedSha = saved && saved.content && saved.content.sha ? saved.content.sha : '';
      if (savedSha) {
        setCachedSha(savedSha);
        window.__REPO_SYNC_LAST_SHA__ = savedSha;
      } else {
        clearCachedSha();
      }
      localStorage.setItem('sidebar-data:' + location.pathname, JSON.stringify(payload.state));

      // 保存成功后，再主动刷新一次远端 sha，减少下次因旧 sha 产生的冲突。
      try {
        var refreshed = await fetchRepoFile(cfg);
        if (refreshed && refreshed.sha) {
          setCachedSha(refreshed.sha);
          window.__REPO_SYNC_LAST_SHA__ = refreshed.sha;
        }
      } catch (e) {
        // 不因刷新 sha 失败而影响主保存成功结果
      }

      setStatus('已保存到 GitHub JSON，并刷新远端 SHA。', 'success');
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  async function forceResetPage() {
    var slug = getPageSlug();
    if (!slug) {
      setStatus('当前页面缺少 slug，无法重置。', 'error');
      return;
    }
    if (!window.confirm('强制重置会清空本页本地数据库、localStorage 缓存，并用页面内置知识点重新构建。\n\n此操作不会自动修改 GitHub 远端文件。\n\n确定继续吗？')) {
      setStatus('已取消强制重置。', 'warn');
      return;
    }

    setStatus('正在强制重置本页...', '');
    try {
      try { localStorage.removeItem('sidebar-data:' + location.pathname); } catch (e) {}
      try { localStorage.removeItem('knowledge-point-overrides:' + location.pathname); } catch (e) {}
      try { localStorage.removeItem('db_fallback_' + slug); } catch (e) {}
      try { clearCachedSha(); } catch (e) {}

      var seed = Array.isArray(window.PENDING_SEED) ? window.PENDING_SEED : [];
      if (!window.DbManager || typeof window.DbManager.forceReset !== 'function') {
        throw new Error('DbManager.forceReset 不可用，请刷新后重试。');
      }
      await window.DbManager.forceReset(seed, slug);

      if (Array.isArray(window.knowledgePoints)) {
        window.knowledgePoints.length = 0;
        seed.forEach(function (item) {
          window.knowledgePoints.push({
            id: item.id,
            title: item.title,
            content: item.content
          });
        });
      }

      if (window.sidebarMgr && typeof window.sidebarMgr.syncFromKnowledgePoints === 'function') {
        window.sidebarMgr.syncFromKnowledgePoints();
      }
      window.index = 0;
      if (typeof window.showKnowledge === 'function') {
        window.showKnowledge();
      }
      setStatus('已强制重置本页本地数据，并按页面种子重建。建议再手动刷新一次页面确认。', 'success');
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  function buildUi() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById(ACTIONS_ID)) return;

    var wrap = document.createElement('div');
    wrap.id = ACTIONS_ID;
    wrap.className = 'repo-sync-actions';
    wrap.innerHTML = [
      '<button type="button" class="repo-sync-btn" data-action="pull">从 GitHub 拉取</button>',
      '<button type="button" class="repo-sync-btn" data-action="push">保存到 GitHub</button>',
      '<button type="button" class="repo-sync-btn repo-sync-btn-danger" data-action="reset">强制重置本页</button>',
      '<div id="' + STATUS_ID + '" class="repo-sync-status"></div>'
    ].join('');

    wrap.addEventListener('click', function (e) {
      var action = e.target && e.target.getAttribute('data-action');
      if (action === 'pull') pullFromGitHub();
      if (action === 'push') pushToGitHub();
      if (action === 'reset') forceResetPage();
    });

    sidebar.appendChild(wrap);
  }

  function injectStyle() {
    if (document.getElementById('repo-sync-style')) return;
    var style = document.createElement('style');
    style.id = 'repo-sync-style';
    style.textContent = [
      '.repo-sync-actions{padding:12px 14px;border-top:1px solid rgba(0,255,255,0.18);display:flex;flex-direction:column;gap:8px}',
      '.repo-sync-btn{padding:9px 12px;border-radius:10px;border:1px solid rgba(0,255,255,0.35);background:rgba(0,255,255,0.08);color:#9ff;cursor:pointer}',
      '.repo-sync-btn:hover{background:rgba(0,255,255,0.16)}',
      '.repo-sync-btn-danger{border-color:rgba(255,120,120,0.45);background:rgba(255,80,80,0.10);color:#ffb3b3}',
      '.repo-sync-btn-danger:hover{background:rgba(255,80,80,0.18)}',
      '.repo-sync-status{font-size:12px;line-height:1.4;color:#9cc;white-space:pre-wrap}',
      '.repo-sync-status.success{color:#75f7b3}',
      '.repo-sync-status.warn{color:#ffd36a}',
      '.repo-sync-status.error{color:#ff8f8f}'
    ].join('');
    document.head.appendChild(style);
  }

  function init() {
    injectStyle();
    buildUi();
  }

  window.RepoSync = {
    init: init,
    pullFromGitHub: pullFromGitHub,
    pushToGitHub: pushToGitHub,
    applyRemoteState: applyRemoteState
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
