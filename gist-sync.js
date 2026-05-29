(function () {
  'use strict';

  var TOKEN_KEY = 'gist-sync-token';
  var GIST_ID_KEY = 'gist-sync-gist-id';
  var GIST_DESC = 'review-html-sidebar-data';
  var FILE_NAME = 'review-html-data.json';
  var DATA_PREFIX = 'sidebar-data:';
  var API = 'https://api.github.com';

  var _token = '';
  var _gistId = '';
  var _debounceTimer = null;
  var _statusEl = null;
  var _initialized = false;
  var _syncButtonMounted = false;
  var _pendingConflictQueue = [];
  var _conflictMap = {};
  var _isShowingConflict = false;

  function ghHeaders() {
    return {
      'Authorization': 'token ' + _token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  function collectAllData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(DATA_PREFIX) === 0) {
        data[key] = readLocalValue(key);
      }
    }
    return data;
  }

  function readLocalValue(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function normalizeSidebarValue(value) {
    var src = value && typeof value === 'object' ? value : {};
    var items = Array.isArray(src.items) ? src.items : [];
    var order = Array.isArray(src.order) ? src.order : [];
    return {
      items: items.map(function (item) {
        return {
          title: item && item.title != null ? String(item.title) : '',
          content: item && item.content != null ? String(item.content) : ''
        };
      }),
      order: order.map(function (idx) {
        return typeof idx === 'number' ? idx : Number(idx) || 0;
      })
    };
  }

  function serializeSidebarValue(value) {
    return JSON.stringify(normalizeSidebarValue(value));
  }

  function valuesEqual(left, right) {
    return serializeSidebarValue(left) === serializeSidebarValue(right);
  }

  function storageKeyLabel(key) {
    return (key || '').replace(DATA_PREFIX, '') || '当前页面';
  }

  function hasPendingConflicts() {
    return Object.keys(_conflictMap).length > 0;
  }

  function setStatus(msg) {
    if (_statusEl) _statusEl.textContent = msg;
  }

  function setConflictStatus() {
    if (hasPendingConflicts()) {
      setStatus('存在同步冲突，请先处理');
      return true;
    }
    return false;
  }

  function findGistByDescription() {
    return fetch(API + '/gists?per_page=100', { headers: ghHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (gists) {
        for (var i = 0; i < gists.length; i++) {
          if (gists[i].description === GIST_DESC) {
            _gistId = gists[i].id;
            try { localStorage.setItem(GIST_ID_KEY, _gistId); } catch (e) {}
            return true;
          }
        }
        return false;
      });
  }

  function fetchRemoteData() {
    if (!_token) return Promise.resolve(null);
    if (!_gistId) {
      return findGistByDescription().then(function (found) {
        return found ? fetchRemoteData() : null;
      });
    }
    return fetch(API + '/gists/' + _gistId, { headers: ghHeaders() })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (gist) {
        if (!gist || !gist.files || !gist.files[FILE_NAME]) return {};
        try { return JSON.parse(gist.files[FILE_NAME].content); } catch (e) { return {}; }
      });
  }

  function enqueueConflict(conflict) {
    if (_conflictMap[conflict.key]) return;
    _conflictMap[conflict.key] = conflict;
    _pendingConflictQueue.push(conflict);
  }

  function removeConflict(key) {
    delete _conflictMap[key];
    _pendingConflictQueue = _pendingConflictQueue.filter(function (item) {
      return item.key !== key;
    });
  }

  function refreshCurrentPageIfNeeded(key) {
    var mgr = window.__sidebarManagerCurrent;
    if (!mgr || typeof mgr.getStorageKey !== 'function' || typeof mgr.reloadFromStorage !== 'function') return;
    if (mgr.getStorageKey() !== key) return;
    mgr.reloadFromStorage();
  }

  function reconcileRemoteData(remoteAll) {
    remoteAll = remoteAll || {};
    var localAll = collectAllData();
    Object.keys(remoteAll).forEach(function (key) {
      if (key.indexOf(DATA_PREFIX) !== 0) return;
      var remoteValue = remoteAll[key];
      var localValue = localAll[key];
      if (localValue == null) {
        try { localStorage.setItem(key, JSON.stringify(remoteValue)); } catch (e) {}
        refreshCurrentPageIfNeeded(key);
        return;
      }
      if (valuesEqual(localValue, remoteValue)) {
        removeConflict(key);
        return;
      }
      enqueueConflict({
        key: key,
        localValue: localValue,
        remoteValue: remoteValue
      });
    });
    if (hasPendingConflicts()) {
      setConflictStatus();
      showNextConflictDialog();
    }
  }

  function fetchAll() {
    if (!_token) return Promise.resolve();
    return fetchRemoteData().then(function (remoteAll) {
      if (!remoteAll) return;
      reconcileRemoteData(remoteAll);
    });
  }

  function sync() {
    if (!_token) return Promise.resolve();
    if (setConflictStatus()) return Promise.resolve();

    var body = {};
    body.description = GIST_DESC;
    body.files = {};
    body.files[FILE_NAME] = { content: JSON.stringify(collectAllData()) };

    var url = _gistId ? (API + '/gists/' + _gistId) : (API + '/gists');
    var method = _gistId ? 'PATCH' : 'POST';

    return fetch(url, {
      method: method,
      headers: ghHeaders(),
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('GitHub API ' + r.status);
        return r.json();
      })
      .then(function (gist) {
        if (!_gistId && gist.id) {
          _gistId = gist.id;
          try { localStorage.setItem(GIST_ID_KEY, _gistId); } catch (e) {}
        }
        setStatus('已同步');
      })
      .catch(function (err) {
        setStatus('同步失败: ' + err.message);
      });
  }

  function debouncedSync() {
    if (hasPendingConflicts()) {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = null;
      setConflictStatus();
      return;
    }
    if (_debounceTimer) clearTimeout(_debounceTimer);
    setStatus('等待同步...');
    _debounceTimer = setTimeout(function () {
      _debounceTimer = null;
      setStatus('同步中...');
      sync();
    }, 2000);
  }

  function closeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function showNextConflictDialog() {
    if (_isShowingConflict) return;
    var nextConflict = _pendingConflictQueue[0];
    if (!nextConflict) return;
    _isShowingConflict = true;

    var overlay = document.createElement('div');
    overlay.className = 'gs-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'gs-dialog';
    dialog.innerHTML =
      '<h4>检测到同步冲突</h4>' +
      '<div class="gs-hint">页面 <strong>' + storageKeyLabel(nextConflict.key) + '</strong> 的本地知识点与云端 Gist 内容不同。</div>' +
      '<div class="gs-hint">请选择要保留哪一份数据：</div>' +
      '<div class="gs-actions gs-conflict-actions">' +
        '<button class="gs-btn gs-save" id="gs-keep-local-btn">同步本地到 Gist</button>' +
        '<button class="gs-btn gs-clear" id="gs-pull-remote-btn">从 Gist 拉取到本地</button>' +
      '</div>' +
      '<div class="gs-actions">' +
        '<button class="gs-btn gs-later" id="gs-later-btn">稍后处理</button>' +
      '</div>' +
      '<div class="gs-status" id="gs-conflict-status">存在同步冲突，请先处理</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var keepLocalBtn = dialog.querySelector('#gs-keep-local-btn');
    var pullRemoteBtn = dialog.querySelector('#gs-pull-remote-btn');
    var laterBtn = dialog.querySelector('#gs-later-btn');

    function finishResolution() {
      closeOverlay(overlay);
      _isShowingConflict = false;
      if (hasPendingConflicts()) {
        setConflictStatus();
        showNextConflictDialog();
      } else {
        setStatus('冲突已处理');
      }
    }

    function postponeConflict() {
      closeOverlay(overlay);
      _isShowingConflict = false;
      setConflictStatus();
    }

    keepLocalBtn.addEventListener('click', function () {
      removeConflict(nextConflict.key);
      closeOverlay(overlay);
      _isShowingConflict = false;
      sync().then(function () {
        if (hasPendingConflicts()) {
          setConflictStatus();
          showNextConflictDialog();
        }
      });
    });

    pullRemoteBtn.addEventListener('click', function () {
      try { localStorage.setItem(nextConflict.key, JSON.stringify(nextConflict.remoteValue)); } catch (e) {}
      removeConflict(nextConflict.key);
      refreshCurrentPageIfNeeded(nextConflict.key);
      finishResolution();
    });

    laterBtn.addEventListener('click', function () {
      postponeConflict();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) postponeConflict();
    });
  }

  function injectCSS() {
    if (document.getElementById('gist-sync-style')) return;
    var s = document.createElement('style');
    s.id = 'gist-sync-style';
    s.textContent = [
      '.gs-settings-btn{',
      '  background:none;border:none;cursor:pointer;',
      '  font-size:18px;padding:4px 8px;margin-left:auto;',
      '  opacity:0.6;transition:opacity 0.2s,transform 0.3s;',
      '}',
      '.gs-settings-btn:hover{opacity:1;transform:rotate(60deg);}',
      '@media(hover:none){.gs-settings-btn{opacity:0.8;}}',
      '.gs-overlay{',
      '  position:fixed;inset:0;background:rgba(0,0,0,0.6);',
      '  z-index:10001;display:flex;align-items:center;justify-content:center;',
      '}',
      '.gs-dialog{',
      '  background:#1a1a2e;color:#e0e0e0;border:1px solid rgba(0,255,136,0.3);',
      '  border-radius:12px;padding:24px;width:90%;max-width:420px;',
      '}',
      '.gs-dialog h4{margin:0 0 16px;color:#00ff88;font-size:16px;}',
      '.gs-dialog label{display:block;font-size:13px;color:#aaa;margin-bottom:6px;}',
      '.gs-dialog input[type=password]{',
      '  width:100%;padding:10px;background:#0f0f23;color:#fff;',
      '  border:1px solid rgba(0,255,136,0.3);border-radius:6px;',
      '  font-size:14px;box-sizing:border-box;margin-bottom:12px;',
      '}',
      '.gs-dialog input:focus{outline:none;border-color:#00ff88;}',
      '.gs-hint{font-size:12px;color:#888;margin-bottom:14px;line-height:1.5;}',
      '.gs-hint a{color:#00ff88;}',
      '.gs-actions{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;}',
      '.gs-btn{',
      '  padding:8px 18px;border:none;border-radius:6px;cursor:pointer;',
      '  font-size:14px;transition:background 0.2s;',
      '}',
      '.gs-save{background:#00ff88;color:#000;}',
      '.gs-save:hover{background:#00cc6a;}',
      '.gs-clear{background:#444;color:#ddd;}',
      '.gs-clear:hover{background:#555;}',
      '.gs-later{background:rgba(255,255,255,0.08);color:#bbb;}',
      '.gs-later:hover{background:rgba(255,255,255,0.14);}',
      '.gs-close{background:none;color:#888;border:none;cursor:pointer;font-size:20px;}',
      '.gs-status{font-size:13px;color:#aaa;margin-top:4px;}',
      '.gs-hero-btn{',
      '  display:inline-flex;align-items:center;gap:6px;',
      '  margin-top:12px;padding:8px 16px;',
      '  background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);',
      '  border-radius:8px;color:#00ff88;cursor:pointer;',
      '  font-size:14px;transition:background 0.2s;',
      '}',
      '.gs-hero-btn:hover{background:rgba(0,255,136,0.2);}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function showSettingsDialog() {
    var existing = document.querySelector('.gs-overlay');
    if (existing) return;

    var overlay = document.createElement('div');
    overlay.className = 'gs-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'gs-dialog';

    dialog.innerHTML =
      '<h4>GitHub Gist 云同步</h4>' +
      '<label>Personal Access Token</label>' +
      '<input type="password" id="gs-token-input" placeholder="ghp_xxxxxxxxxxxx" />' +
      '<div class="gs-hint">' +
        '需要 <a href="https://github.com/settings/tokens" target="_blank">gist</a> 权限。' +
        '数据保存在你的私有 Gist 中，仅浏览器与 github.com 通信。' +
      '</div>' +
      '<div class="gs-actions">' +
        '<button class="gs-btn gs-save" id="gs-save-btn">保存并同步</button>' +
        '<button class="gs-btn gs-close" id="gs-close-btn">&times;</button>' +
      '</div>' +
      '<div class="gs-status" id="gs-status">' + (_token ? '已配置' : '未配置') + '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var tokenInput = dialog.querySelector('#gs-token-input');
    var saveBtn = dialog.querySelector('#gs-save-btn');
    var closeBtn = dialog.querySelector('#gs-close-btn');
    _statusEl = dialog.querySelector('#gs-status');

    if (_token) {
      tokenInput.value = _token;
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay(overlay);
    });

    closeBtn.addEventListener('click', function () {
      closeOverlay(overlay);
    });

    saveBtn.addEventListener('click', function () {
      var val = tokenInput.value.trim();
      if (!val) return;
      _token = val;
      _gistId = localStorage.getItem(GIST_ID_KEY) || '';
      try { localStorage.setItem(TOKEN_KEY, _token); } catch (e) {}
      setStatus('正在验证...');
      fetchAll()
        .then(function () {
          if (hasPendingConflicts()) return;
          return sync();
        })
        .catch(function (err) {
          setStatus('错误: ' + err.message);
        });
    });
  }

  function mountSettingsButton(sidebarHeader, heroSection) {
    if (_syncButtonMounted) return;
    if (sidebarHeader) {
      var btn = document.createElement('button');
      btn.className = 'gs-settings-btn';
      btn.textContent = '\u2699';
      btn.title = '云同步设置';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsDialog();
      });
      var closeBtn = sidebarHeader.querySelector('.sidebar-close');
      if (closeBtn) {
        sidebarHeader.insertBefore(btn, closeBtn);
      } else {
        sidebarHeader.appendChild(btn);
      }
      _syncButtonMounted = true;
      return;
    }
    if (heroSection) {
      var heroBtn = document.createElement('button');
      heroBtn.className = 'gs-hero-btn';
      heroBtn.innerHTML = '\u2699 云同步设置';
      heroBtn.addEventListener('click', function () {
        showSettingsDialog();
      });
      heroSection.appendChild(heroBtn);
      _syncButtonMounted = true;
    }
  }

  function init(opts) {
    opts = opts || {};
    injectCSS();

    _token = localStorage.getItem(TOKEN_KEY) || '';
    _gistId = localStorage.getItem(GIST_ID_KEY) || '';

    mountSettingsButton(opts.sidebarHeader, opts.heroSection);

    if (_initialized) return;
    _initialized = true;

    if (_token) {
      fetchAll();
    }
  }

  function autoInitContentPage() {
    var sidebarHeader = document.querySelector('.sidebar-header');
    if (!sidebarHeader) return;
    init({ sidebarHeader: sidebarHeader });
  }

  window.__gistSyncDebounced = debouncedSync;

  function checkAndShowTokenConfig() {
    if (!_token) {
      console.log('No token found, showing config panel');
      if (typeof showConfigPanel === 'function') {
        showConfigPanel();
      } else {
        // Fallback: trigger via custom event or retry
        setTimeout(function() {
          if (typeof showConfigPanel === 'function') showConfigPanel();
        }, 500);
      }
    }
  }

  window.GistSync = {
    init: init,
    sync: sync,
    fetchAll: fetchAll,
    checkToken: checkAndShowTokenConfig
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      autoInitContentPage();
      checkAndShowTokenConfig();
    }, { once: true });
  } else {
    autoInitContentPage();
    checkAndShowTokenConfig();
  }
})();