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

  var DEFAULT_TOPIC_FILES = [
    'computer-network.html',
    'design-patterns-topics.html',
    'git-topics.html',
    'guanlan.html',
    'learning-research-agent.html',
    'mysql-topics.html',
    'operating-system.html',
    'python.html',
    'redis-topics.html',
    'system-design-topics.html'
  ];

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getPagePathForFile(fileName) {
    var path = location.pathname || '/';
    var idx = path.lastIndexOf('/');
    var base = idx >= 0 ? path.slice(0, idx + 1) : '/';
    return base + fileName;
  }

  function buildSidebarValueFromKnowledgePoints(points) {
    var items = Array.isArray(points) ? points.map(function (item) {
      return {
        title: item && item.title != null ? String(item.title).replace(/^\s*\d+\s*[.．、]\s*/, '') : '',
        content: item && item.content != null ? String(item.content) : ''
      };
    }) : [];
    var order = [];
    for (var i = 0; i < items.length; i++) order.push(i);
    return normalizeSidebarValue({ items: items, order: order });
  }

  function parseKnowledgePointsFromHtml(html) {
    if (!html) return null;
    var match = html.match(/(?:var|let|const)\s+knowledgePoints\s*=\s*(\[[\s\S]*?\]);/);
    if (!match || !match[1]) return null;
    try {
      var parsed = JSON.parse(match[1]);
      if (!Array.isArray(parsed)) return null;
      return buildSidebarValueFromKnowledgePoints(parsed);
    } catch (e) {
      return null;
    }
  }

  function collectDefaultPageData() {
    return Promise.all(DEFAULT_TOPIC_FILES.map(function (fileName) {
      var pagePath = getPagePathForFile(fileName);
      return fetch(fileName, { cache: 'no-store' })
        .then(function (resp) {
          if (!resp.ok) throw new Error('Failed to fetch ' + fileName);
          return resp.text();
        })
        .then(function (html) {
          var value = parseKnowledgePointsFromHtml(html);
          if (!value || !value.items.length) return null;
          return {
            key: DATA_PREFIX + pagePath,
            value: value
          };
        })
        .catch(function () {
          return null;
        });
    })).then(function (entries) {
      var data = {};
      entries.forEach(function (entry) {
        if (entry && entry.key) data[entry.key] = entry.value;
      });
      return data;
    });
  }

  function collectAllDataForBackup() {
    return collectDefaultPageData().then(function (defaultData) {
      var localData = collectAllData();
      var merged = {};
      Object.keys(defaultData || {}).forEach(function (key) {
        merged[key] = defaultData[key];
      });
      Object.keys(localData || {}).forEach(function (key) {
        merged[key] = localData[key];
      });
      return merged;
    });
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

  function normalizeBackupData(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var data = source.data && typeof source.data === 'object' ? source.data : source;
    var normalized = {};
    Object.keys(data).forEach(function (key) {
      if (key.indexOf(DATA_PREFIX) !== 0) return;
      normalized[key] = normalizeSidebarValue(data[key]);
    });
    return normalized;
  }

  function applyImportedData(importedData, mode) {
    var normalized = normalizeBackupData(importedData);
    var keys = Object.keys(normalized);
    if (!keys.length) {
      throw new Error('备份文件中没有可导入的知识点数据');
    }

    if (mode === 'replace') {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var existingKey = localStorage.key(i);
        if (existingKey && existingKey.indexOf(DATA_PREFIX) === 0) {
          try { localStorage.removeItem(existingKey); } catch (e) {}
        }
      }
    }

    keys.forEach(function (key) {
      try { localStorage.setItem(key, JSON.stringify(normalized[key])); } catch (e) {}
      refreshCurrentPageIfNeeded(key);
    });

    return keys.length;
  }

  function buildBackupPayload() {
    return collectAllDataForBackup().then(function (allData) {
      return {
        version: 2,
        exportedAt: new Date().toISOString(),
        source: 'review_html_local_backup',
        mode: 'full',
        data: allData
      };
    });
  }

  function downloadBackupFile() {
    return buildBackupPayload().then(function (payload) {
      var json = JSON.stringify(payload, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      var stamp = payload.exportedAt.replace(/[:.]/g, '-');
      link.href = url;
      link.download = 'review-html-backup-' + stamp + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      return Object.keys(payload.data).length;
    });
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsText(file, 'utf-8');
    });
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
      '.gs-file-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;}',
      '.gs-file-input{display:none;}',
      '.gs-file-trigger{background:rgba(255,255,255,0.08);color:#d7e6ff;border:1px solid rgba(122,162,255,0.28);}',
      '.gs-file-trigger:hover{background:rgba(255,255,255,0.14);}',
      '.gs-file-name{font-size:12px;color:#93a4c3;min-height:18px;flex:1 1 160px;}',
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
      '.gs-section{margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);}',
      '.gs-section h5{margin:0 0 10px;font-size:14px;color:#d8fbe8;}',
      '.gs-actions-compact .gs-btn{flex:1 1 140px;}',
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
      '<h4>数据同步与本地备份</h4>' +
      '<label>Personal Access Token</label>' +
      '<input type="password" id="gs-token-input" placeholder="ghp_xxxxxxxxxxxx" />' +
      '<div class="gs-hint">' +
        '可选：配置后可使用 <a href="https://github.com/settings/tokens" target="_blank">GitHub Gist</a> 云同步；不配置也可以只用本地导入导出。' +
      '</div>' +
      '<div class="gs-actions">' +
        '<button class="gs-btn gs-save" id="gs-save-btn">保存并同步</button>' +
        '<button class="gs-btn gs-clear" id="gs-clear-token-btn">清除 Token</button>' +
        '<button class="gs-btn gs-close" id="gs-close-btn">&times;</button>' +
      '</div>' +
      '<div class="gs-section">' +
        '<h5>本地备份</h5>' +
        '<div class="gs-hint">导出全部专题页默认知识点，并优先带上当前浏览器里的本地修改；也可从本地 JSON 备份恢复。</div>' +
        '<div class="gs-actions gs-actions-compact">' +
          '<button class="gs-btn gs-save" id="gs-export-btn">导出备份</button>' +
          '<button class="gs-btn gs-clear" id="gs-import-merge-btn">导入并合并</button>' +
          '<button class="gs-btn gs-clear" id="gs-import-replace-btn">导入并覆盖</button>' +
        '</div>' +
        '<div class="gs-file-row">' +
          '<input class="gs-file-input" type="file" id="gs-import-file" accept="application/json,.json" />' +
          '<button class="gs-btn gs-file-trigger" id="gs-import-pick-btn">选择备份文件</button>' +
          '<div class="gs-file-name" id="gs-file-name">未选择文件</div>' +
        '</div>' +
      '</div>' +
      '<div class="gs-status" id="gs-status">' + (_token ? '已配置云同步；可随时本地备份' : '未配置云同步；可直接使用本地备份') + '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var tokenInput = dialog.querySelector('#gs-token-input');
    var saveBtn = dialog.querySelector('#gs-save-btn');
    var clearTokenBtn = dialog.querySelector('#gs-clear-token-btn');
    var closeBtn = dialog.querySelector('#gs-close-btn');
    var exportBtn = dialog.querySelector('#gs-export-btn');
    var importMergeBtn = dialog.querySelector('#gs-import-merge-btn');
    var importReplaceBtn = dialog.querySelector('#gs-import-replace-btn');
    var importFileInput = dialog.querySelector('#gs-import-file');
    var importPickBtn = dialog.querySelector('#gs-import-pick-btn');
    var fileNameEl = dialog.querySelector('#gs-file-name');
    _statusEl = dialog.querySelector('#gs-status');

    if (_token) {
      tokenInput.value = _token;
    }

    function requireImportFile() {
      var file = importFileInput.files && importFileInput.files[0];
      if (!file) {
        setStatus('请先选择一个备份 JSON 文件');
        return null;
      }
      return file;
    }

    importPickBtn.addEventListener('click', function () {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', function () {
      var file = importFileInput.files && importFileInput.files[0];
      fileNameEl.textContent = file ? file.name : '未选择文件';
    });

    function handleImport(mode) {
      var file = requireImportFile();
      if (!file) return;
      setStatus(mode === 'replace' ? '正在覆盖导入...' : '正在合并导入...');
      readFileAsText(file)
        .then(function (text) {
          var parsed;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            throw new Error('备份文件不是有效的 JSON');
          }
          var count = applyImportedData(parsed, mode);
          setStatus((mode === 'replace' ? '覆盖导入完成：' : '合并导入完成：') + count + ' 个页面数据');
        })
        .catch(function (err) {
          setStatus('导入失败: ' + err.message);
        });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay(overlay);
    });

    closeBtn.addEventListener('click', function () {
      closeOverlay(overlay);
    });

    clearTokenBtn.addEventListener('click', function () {
      _token = '';
      _gistId = '';
      tokenInput.value = '';
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      try { localStorage.removeItem(GIST_ID_KEY); } catch (e) {}
      setStatus('已清除云同步 Token，本地备份功能仍可使用');
    });

    exportBtn.addEventListener('click', function () {
      setStatus('正在生成全量备份（默认知识点 + 本地修改）...');
      downloadBackupFile()
        .then(function (count) {
          setStatus('已导出全量备份：' + count + ' 个页面数据');
        })
        .catch(function (err) {
          setStatus('导出失败: ' + err.message);
        });
    });

    importMergeBtn.addEventListener('click', function () {
      handleImport('merge');
    });

    importReplaceBtn.addEventListener('click', function () {
      handleImport('replace');
    });

    saveBtn.addEventListener('click', function () {
      var val = tokenInput.value.trim();
      if (!val) {
        setStatus('未填写 Token；你仍可使用本地导入导出');
        return;
      }
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
    return !!_token;
  }

  window.GistSync = {
    init: init,
    sync: sync,
    fetchAll: fetchAll,
    checkToken: checkAndShowTokenConfig,
    exportLocalBackup: downloadBackupFile,
    importLocalBackup: applyImportedData
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      autoInitContentPage();
    }, { once: true });
  } else {
    autoInitContentPage();
  }
})();