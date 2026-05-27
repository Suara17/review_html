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

  /* ── helpers ── */

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
        data[key] = JSON.parse(localStorage.getItem(key));
      }
    }
    return data;
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

  /* ── public API ── */

  function fetchAll() {
    if (!_token) return Promise.resolve();
    if (!_gistId) {
      return findGistByDescription().then(function (found) {
        return found ? fetchAll() : Promise.resolve();
      });
    }
    return fetch(API + '/gists/' + _gistId, { headers: ghHeaders() })
      .then(function (r) {
        if (!r.ok) return;
        return r.json();
      })
      .then(function (gist) {
        if (!gist || !gist.files || !gist.files[FILE_NAME]) return;
        var all;
        try { all = JSON.parse(gist.files[FILE_NAME].content); } catch (e) { return; }
        Object.keys(all).forEach(function (key) {
          if (!localStorage.getItem(key)) {
            try { localStorage.setItem(key, JSON.stringify(all[key])); } catch (e) {}
          }
        });
      });
  }

  function sync() {
    if (!_token) return;
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
    if (_debounceTimer) clearTimeout(_debounceTimer);
    setStatus('等待同步...');
    _debounceTimer = setTimeout(function () {
      _debounceTimer = null;
      setStatus('同步中...');
      sync();
    }, 2000);
  }

  /* ── settings UI ── */

  var _statusEl = null;
  function setStatus(msg) {
    if (_statusEl) _statusEl.textContent = msg;
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
      '.gs-actions{display:flex;gap:10px;margin-bottom:10px;}',
      '.gs-btn{',
      '  padding:8px 18px;border:none;border-radius:6px;cursor:pointer;',
      '  font-size:14px;transition:background 0.2s;',
      '}',
      '.gs-save{background:#00ff88;color:#000;}',
      '.gs-save:hover{background:#00cc6a;}',
      '.gs-clear{background:#444;color:#ddd;}',
      '.gs-clear:hover{background:#555;}',
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
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    closeBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    saveBtn.addEventListener('click', function () {
      var val = tokenInput.value.trim();
      if (!val) return;
      _token = val;
      _gistId = localStorage.getItem(GIST_ID_KEY) || '';
      try { localStorage.setItem(TOKEN_KEY, _token); } catch (e) {}
      setStatus('正在验证...');
      fetchAll()
        .then(function () { return sync(); })
        .catch(function (err) {
          setStatus('错误: ' + err.message);
        });
    });
  }

  /* ── init ── */

  function init(opts) {
    opts = opts || {};
    var sidebarHeader = opts.sidebarHeader;

    injectCSS();

    _token = localStorage.getItem(TOKEN_KEY) || '';
    _gistId = localStorage.getItem(GIST_ID_KEY) || '';

    if (sidebarHeader) {
      // Content page: add gear icon to sidebar header
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
    } else if (opts.heroSection) {
      // Homepage: add button in hero section
      var heroBtn = document.createElement('button');
      heroBtn.className = 'gs-hero-btn';
      heroBtn.innerHTML = '\u2699 云同步设置';
      heroBtn.addEventListener('click', function () {
        showSettingsDialog();
      });
      opts.heroSection.appendChild(heroBtn);
    }

    // If token exists, fetch from Gist to populate missing localStorage keys
    if (_token) {
      fetchAll();
    }
  }

  // Expose debounced sync globally for sidebar-manager.js to call
  window.__gistSyncDebounced = debouncedSync;

  // Export
  window.GistSync = {
    init: init,
    sync: sync,
    fetchAll: fetchAll
  };
})();
