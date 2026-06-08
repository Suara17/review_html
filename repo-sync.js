(function () {
  'use strict';

  var TOKEN_KEY = 'repo-sync-token';
  var OWNER_KEY = 'repo-sync-owner';
  var REPO_KEY = 'repo-sync-repo';
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
    if (!cfg.owner) {
      cfg.owner = window.prompt('GitHub owner', DEFAULT_OWNER) || DEFAULT_OWNER;
    }
    if (!cfg.repo) {
      cfg.repo = window.prompt('GitHub repo', DEFAULT_REPO) || DEFAULT_REPO;
    }
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
      throw new Error('读取 GitHub 文件失败：' + res.status);
    }
    return await res.json();
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
      var text = await res.text();
      throw new Error('保存到 GitHub 失败：' + res.status + ' ' + text);
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
    setStatus('正在从 GitHub 拉取...', '');
    try {
      var remote = await fetchRepoFile(cfg);
      if (!remote) {
        setStatus('GitHub 上还没有这个页面的 JSON 文件', 'warn');
        return;
      }
      var payload = JSON.parse(fromBase64Unicode(remote.content || ''));
      var ok = applyRemoteState(payload);
      if (ok) {
        localStorage.setItem('sidebar-data:' + location.pathname, JSON.stringify(payload.state));
        setStatus('已从 GitHub 拉取并覆盖本地缓存', 'success');
      } else {
        setStatus('拉取成功，但当前页面未就绪', 'warn');
      }
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  async function pushToGitHub() {
    var cfg = ensureConfig();
    if (!cfg) return;
    if (!window.knowledgePoints || !window.knowledgePoints.length) {
      setStatus('当前没有可保存的知识点', 'warn');
      return;
    }
    setStatus('正在保存到 GitHub...', '');
    try {
      var current = await fetchRepoFile(cfg);
      var sha = current && current.sha ? current.sha : null;
      var payload = normalizeStateFromKnowledgePoints(window.knowledgePoints);
      var saved = await saveRepoFile(cfg, payload, sha);
      if (saved && saved.content && saved.content.sha) {
        window.__REPO_SYNC_LAST_SHA__ = saved.content.sha;
      }
      localStorage.setItem('sidebar-data:' + location.pathname, JSON.stringify(payload.state));
      setStatus('已保存到 GitHub JSON', 'success');
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
      '<div id="' + STATUS_ID + '" class="repo-sync-status"></div>'
    ].join('');

    wrap.addEventListener('click', function (e) {
      var action = e.target && e.target.getAttribute('data-action');
      if (action === 'pull') pullFromGitHub();
      if (action === 'push') pushToGitHub();
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
