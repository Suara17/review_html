(function () {
  'use strict';

  var STYLE_ID = 'sidebar-manager-style';
  var STORAGE_PREFIX = 'sidebar-data:';
  var TOKEN_KEY = 'repo-sync-token';
  var REPO_OWNER_KEY = 'repo-sync-owner';
  var REPO_NAME_KEY = 'repo-sync-name';
  var DEFAULT_REPO_OWNER = 'Suara17';
  var DEFAULT_REPO_NAME = 'review_html';
  var JSON_BASE_PATH = 'data/sidebar-state';
  var API_ROOT = 'https://api.github.com';
  var NUMBER_RE = /^\s*\d+\s*[.．、]\s*/;
  var NON_WORD_RE = /[^a-z0-9]+/g;

  function stripNumber(title) {
    return (title || '').replace(NUMBER_RE, '');
  }

  function slugify(value) {
    var s = String(value || '').toLowerCase().trim();
    s = s.replace(NON_WORD_RE, '-').replace(/^-+|-+$/g, '');
    return s || 'item';
  }

  function makePageSlug() {
    return window.__PAGE_SLUG__ || slugify(location.pathname.replace(/\.html$/, '').replace(/^\/+/, '')) || 'page';
  }

  function makeItemId(pageSlug, index, title) {
    return pageSlug + '--' + String(index + 1).padStart(3, '0') + '--' + slugify(stripNumber(title));
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function toBase64Unicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function prettyNow() {
    return new Date().toISOString();
  }

  /* ── CSS injection ── */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.sm-toolbar{display:flex;flex-direction:column;gap:8px;margin:8px 0 12px}',
      '.sm-toolbar-row{display:flex;gap:8px;align-items:center}',
      '.sm-save-btn,.sm-export-btn,.sm-add-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;padding:10px 16px;border-radius:10px;font-size:.95em;font-weight:600;cursor:pointer;transition:all .25s}',
      '.sm-add-btn{border:2px dashed rgba(0,255,255,0.3);background:rgba(0,255,255,0.05);color:#00ffff}',
      '.sm-add-btn:hover,.sm-add-btn:active{background:rgba(0,255,255,0.12);border-color:rgba(0,255,255,0.5);box-shadow:0 0 16px rgba(0,255,255,0.12)}',
      '.sm-save-btn,.sm-export-btn{border:1px solid rgba(0,255,255,0.25);background:rgba(0,255,255,0.08);color:#aefeff}',
      '.sm-save-btn:hover,.sm-export-btn:hover{background:rgba(0,255,255,0.16);box-shadow:0 0 16px rgba(0,255,255,0.12)}',
      '.sm-save-btn[disabled]{opacity:.6;cursor:wait}',
      '.sm-sync-status{font-size:.78em;line-height:1.4;color:rgba(255,255,255,0.68);padding:0 2px}',
      '.sm-sync-status.success{color:#8cffc1}',
      '.sm-sync-status.error{color:#ff8f8f}',
      '#sidebar-list .sidebar-manager-item{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 6px!important;margin:4px 0!important;min-height:48px;border-radius:10px;transition:background .25s,border-color .25s,box-shadow .25s;cursor:pointer;border:1px solid transparent;position:relative;overflow:visible!important;touch-action:pan-y}',
      '#sidebar-list .sidebar-manager-item:hover{background:rgba(0,255,255,0.12)!important;border-color:rgba(0,255,255,0.25)!important;box-shadow:0 0 16px rgba(0,255,255,0.08)}',
      '#sidebar-list .sidebar-manager-item.active{background:rgba(0,255,255,0.1)!important;border-color:rgba(0,255,255,0.4)!important}',
      '#sidebar-list .sidebar-manager-item::before{display:none!important}',
      '#sidebar-list .sidebar-manager-item.dragging{opacity:.7;z-index:999;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.5)!important;transition:none!important}',
      '.sm-drag-handle{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;color:rgba(0,255,255,0.4);font-size:1.1em;cursor:grab;transition:color .2s,background .2s;user-select:none;-webkit-user-select:none;touch-action:none}',
      '.sm-drag-handle:hover{color:#00ffff;background:rgba(0,255,255,0.1)}',
      '.sm-drag-handle:active{cursor:grabbing}',
      '.sm-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.95em;color:rgba(255,255,255,0.9);padding:4px 0;user-select:none;-webkit-user-select:none}',
      '.sm-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;opacity:0;transition:opacity .2s}',
      '#sidebar-list .sidebar-manager-item:hover .sm-actions{opacity:1}',
      '.sm-edit-btn,.sm-del-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;font-size:.85em;cursor:pointer;transition:all .2s;line-height:1}',
      '.sm-edit-btn{background:rgba(0,255,255,0.1);color:#00ffff}',
      '.sm-edit-btn:hover{background:rgba(0,255,255,0.25);box-shadow:0 0 10px rgba(0,255,255,0.15)}',
      '.sm-del-btn{background:rgba(255,80,80,0.1);color:#ff6b6b}',
      '.sm-del-btn:hover{background:rgba(255,80,80,0.25);box-shadow:0 0 10px rgba(255,80,80,0.15)}',
      '.sm-edit-input{flex:1;min-width:0;padding:6px 10px;border:1px solid rgba(0,255,255,0.4);border-radius:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:.95em;outline:none;box-shadow:0 0 12px rgba(0,255,255,0.15)}',
      '.sm-edit-input:focus{border-color:#00ffff}',
      '.sm-drop-placeholder{height:4px;margin:2px 0;border-radius:2px;background:rgba(0,255,255,0.5);box-shadow:0 0 8px rgba(0,255,255,0.3);transition:opacity .15s}',
      '.sm-empty{text-align:center;padding:24px 16px;color:rgba(255,255,255,0.35);font-size:.92em}',
      '@media(hover:none){.sm-actions{opacity:1!important}#sidebar-list .sidebar-manager-item{min-height:52px;padding:10px 8px 10px 6px!important;touch-action:pan-y}}',
      '@media(max-width:768px){#sidebar-list .sidebar-manager-item{min-height:50px;padding:10px 8px 10px 6px!important}.sm-drag-handle{width:32px;height:32px;font-size:1.2em}.sm-edit-btn,.sm-del-btn{width:34px;height:34px;font-size:.95em}.sm-add-btn,.sm-save-btn,.sm-export-btn{min-height:48px;font-size:1em}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function SidebarManager(opts) {
    if (!(this instanceof SidebarManager)) return new SidebarManager(opts);
    this._sidebarUl = opts.sidebarUl;
    this._knowledgePointsRef = opts.knowledgePoints;
    this._onNavigate = opts.onNavigate || function () {};
    this._activeIndex = 0;
    this._pageSlug = makePageSlug();
    this._storageKey = STORAGE_PREFIX + location.pathname;
    this._jsonPath = JSON_BASE_PATH + '/' + this._pageSlug + '.json';
    this._remoteSha = '';
    this._remoteLoaded = false;
    this._saveBtn = null;
    this._exportBtn = null;
    this._statusEl = null;
    this._toolbarEl = null;
    this._saving = false;
    this._data = null;
    this._drag = null;
    this._bound = {};

    injectStyle();
    this._init();
    window.__sidebarManagerCurrent = this;
  }

  var proto = SidebarManager.prototype;

  proto._init = async function () {
    await this._loadAndHydrate();
    this._bindEvents();
  };

  proto._setStatus = function (text, cls) {
    if (!this._statusEl) return;
    this._statusEl.textContent = text || '';
    this._statusEl.className = 'sm-sync-status' + (cls ? ' ' + cls : '');
  };

  proto._makeSeedState = function (seedItems) {
    var items = [];
    var order = [];
    for (var i = 0; i < seedItems.length; i++) {
      items.push({
        id: seedItems[i] && seedItems[i].id ? seedItems[i].id : makeItemId(this._pageSlug, i, seedItems[i] && seedItems[i].title),
        title: stripNumber(seedItems[i] && seedItems[i].title),
        content: seedItems[i] ? seedItems[i].content : ''
      });
      order.push(i);
    }
    return { items: items, order: order };
  };

  proto._loadLocalState = function () {
    var raw = null;
    try { raw = localStorage.getItem(this._storageKey); } catch (e) {}
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  };

  proto._loadLegacyState = function () {
    var oldKey = 'knowledge-point-overrides:' + location.pathname;
    var oldRaw = null;
    try { oldRaw = localStorage.getItem(oldKey); } catch (e) {}
    if (!oldRaw) return null;
    try {
      var contents = JSON.parse(oldRaw);
      if (!Array.isArray(contents)) return null;
      var seed = this._knowledgePointsRef || [];
      var items = [];
      var len = Math.max(seed.length, contents.length);
      for (var i = 0; i < len; i++) {
        items.push({
          id: makeItemId(this._pageSlug, i, seed[i] ? seed[i].title : ('知识点 ' + (i + 1))),
          title: stripNumber(seed[i] ? seed[i].title : ('知识点 ' + (i + 1))),
          content: typeof contents[i] === 'string' ? contents[i] : (seed[i] ? seed[i].content : '')
        });
      }
      var order = [];
      for (var j = 0; j < items.length; j++) order.push(j);
      try { localStorage.removeItem(oldKey); } catch (e) {}
      return { items: items, order: order };
    } catch (e) {
      return null;
    }
  };

  proto._fetchRemoteState = async function () {
    var url = './' + this._jsonPath;
    try {
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      var json = await res.json();
      this._remoteLoaded = true;
      if (json && typeof json === 'object' && json.githubSha) this._remoteSha = json.githubSha || '';
      return json && json.state ? json.state : json;
    } catch (e) {
      return null;
    }
  };

  proto._normalizeData = function (data, seedState) {
    if (!data || !Array.isArray(data.items)) data = { items: [], order: [] };
    if (!Array.isArray(data.order)) data.order = [];

    var seedById = {};
    var seedIds = [];
    for (var i = 0; i < seedState.items.length; i++) {
      var seedItem = seedState.items[i];
      seedById[seedItem.id] = seedItem;
      seedIds.push(seedItem.id);
    }

    var normalizedItems = [];
    var itemIndexById = {};

    for (var j = 0; j < data.items.length; j++) {
      var item = data.items[j] || {};
      var id = item.id || (seedState.items[j] ? seedState.items[j].id : makeItemId(this._pageSlug, j, item.title));
      if (itemIndexById[id] != null) continue;
      var seedRef = seedById[id];
      normalizedItems.push({
        id: id,
        title: stripNumber(item.title || (seedRef ? seedRef.title : ('知识点 ' + (j + 1)))),
        content: typeof item.content === 'string' ? item.content : (seedRef ? seedRef.content : '')
      });
      itemIndexById[id] = normalizedItems.length - 1;
    }

    for (var k = 0; k < seedState.items.length; k++) {
      var seedId = seedState.items[k].id;
      if (itemIndexById[seedId] == null) {
        normalizedItems.push(clone(seedState.items[k]));
        itemIndexById[seedId] = normalizedItems.length - 1;
      }
    }

    var finalOrder = [];
    var seen = {};
    for (var m = 0; m < data.order.length; m++) {
      var orderVal = data.order[m];
      var itemId = null;
      if (typeof orderVal === 'number' && normalizedItems[orderVal]) itemId = normalizedItems[orderVal].id;
      else if (typeof orderVal === 'string' && itemIndexById[orderVal] != null) itemId = orderVal;
      if (itemId && !seen[itemId]) {
        finalOrder.push(itemIndexById[itemId]);
        seen[itemId] = true;
      }
    }
    for (var n = 0; n < seedIds.length; n++) {
      if (!seen[seedIds[n]]) {
        finalOrder.push(itemIndexById[seedIds[n]]);
        seen[seedIds[n]] = true;
      }
    }
    for (var p = 0; p < normalizedItems.length; p++) {
      var fallbackId = normalizedItems[p].id;
      if (!seen[fallbackId]) {
        finalOrder.push(p);
        seen[fallbackId] = true;
      }
    }

    return { items: normalizedItems, order: finalOrder };
  };

  proto._mergeStates = function (seedState, remoteState, localState, legacyState) {
    var base = remoteState || localState || legacyState || seedState;
    var normalized = this._normalizeData(base, seedState);

    if (localState && localState !== base) {
      normalized = this._overlayLocalEdits(normalized, localState, seedState);
    } else if (legacyState && legacyState !== base) {
      normalized = this._overlayLocalEdits(normalized, legacyState, seedState);
    }

    return normalized;
  };

  proto._overlayLocalEdits = function (baseState, overlayState, seedState) {
    var base = this._normalizeData(baseState, seedState);
    var overlay = this._normalizeData(overlayState, seedState);
    var byId = {};
    for (var i = 0; i < base.items.length; i++) byId[base.items[i].id] = i;
    for (var j = 0; j < overlay.items.length; j++) {
      var item = overlay.items[j];
      if (byId[item.id] != null) {
        base.items[byId[item.id]].title = stripNumber(item.title);
        base.items[byId[item.id]].content = item.content;
      } else {
        base.items.push(clone(item));
        byId[item.id] = base.items.length - 1;
      }
    }
    var finalOrder = [];
    var seen = {};
    for (var k = 0; k < overlay.order.length; k++) {
      var idx = overlay.order[k];
      var id = overlay.items[idx] && overlay.items[idx].id;
      if (id && byId[id] != null && !seen[id]) {
        finalOrder.push(byId[id]);
        seen[id] = true;
      }
    }
    for (var m = 0; m < base.order.length; m++) {
      var existing = base.items[base.order[m]];
      if (existing && !seen[existing.id]) {
        finalOrder.push(base.order[m]);
        seen[existing.id] = true;
      }
    }
    base.order = finalOrder;
    return base;
  };

  proto._loadAndHydrate = async function () {
    var seedState = this._makeSeedState(this._knowledgePointsRef || []);
    var localState = this._loadLocalState();
    var legacyState = localState ? null : this._loadLegacyState();
    var remoteState = await this._fetchRemoteState();
    this._data = this._mergeStates(seedState, remoteState, localState, legacyState);
    this._syncToKP();
    this._persist(false);
    this.render();
    this.setActiveIndex(this._activeIndex);
    this._setStatus(remoteState ? '已加载 GitHub JSON 状态' : '当前使用本地缓存，点“保存到 GitHub”可同步', remoteState ? 'success' : '');
  };

  proto._syncToKP = function () {
    var kp = this._knowledgePointsRef;
    var data = this._data;
    var mapped = [];
    for (var i = 0; i < data.order.length; i++) {
      var item = data.items[data.order[i]];
      if (item) mapped.push({ id: item.id, title: (i + 1) + '. ' + item.title, content: item.content });
    }
    kp.splice.apply(kp, [0, kp.length].concat(mapped));
  };

  proto._persist = function (triggerRemoteHook) {
    if (triggerRemoteHook === void 0) triggerRemoteHook = true;
    try { localStorage.setItem(this._storageKey, JSON.stringify(this._data)); } catch (e) {}
    if (triggerRemoteHook && window.__gistSyncDebounced) window.__gistSyncDebounced();
  };

  proto.save = function () {
    var kp = this._knowledgePointsRef;
    var data = this._data;
    for (var i = 0; i < data.order.length && i < kp.length; i++) {
      var idx = data.order[i];
      if (data.items[idx]) {
        data.items[idx].id = kp[i].id || data.items[idx].id || makeItemId(this._pageSlug, i, kp[i].title);
        data.items[idx].title = stripNumber(kp[i].title);
        data.items[idx].content = kp[i].content;
      }
    }
    this._persist();
  };

  proto.getStorageKey = function () {
    return this._storageKey;
  };

  proto.getActiveIndex = function () { return this._activeIndex; };

  proto.reloadFromStorage = async function () {
    var previousIndex = this._activeIndex;
    await this._loadAndHydrate();
    if (this._data && this._data.order && this._data.order.length) {
      if (previousIndex >= this._data.order.length) previousIndex = this._data.order.length - 1;
      if (previousIndex < 0) previousIndex = 0;
      this._activeIndex = previousIndex;
    } else {
      this._activeIndex = 0;
    }
    this.render();
    this.setActiveIndex(this._activeIndex);
    this._onNavigate(this._activeIndex);
  };

  proto.setActiveIndex = function (i) {
    this._activeIndex = i;
    var items = this._sidebarUl.querySelectorAll('.sidebar-manager-item');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('active', j === i);
    }
  };

  proto._getExportPayload = function () {
    this.save();
    return {
      page_id: this._pageSlug,
      updated_at: prettyNow(),
      state: clone(this._data)
    };
  };

  proto._downloadJson = function () {
    var payload = this._getExportPayload();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = this._pageSlug + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._setStatus('已导出当前页面 JSON', 'success');
  };

  proto._getRepoConfig = function () {
    var token = '';
    var owner = '';
    var repo = '';
    try {
      token = localStorage.getItem(TOKEN_KEY) || '';
      owner = localStorage.getItem(REPO_OWNER_KEY) || DEFAULT_REPO_OWNER;
      repo = localStorage.getItem(REPO_NAME_KEY) || DEFAULT_REPO_NAME;
    } catch (e) {}
    return { token: token, owner: owner, repo: repo };
  };

  proto._ensureRepoConfig = function () {
    var cfg = this._getRepoConfig();
    if (!cfg.token) {
      var token = prompt('请输入 GitHub PAT（需要 repo 权限），仅保存在当前浏览器：', '');
      if (!token) return null;
      cfg.token = token.trim();
    }
    var owner = prompt('GitHub 仓库 owner：', cfg.owner || DEFAULT_REPO_OWNER);
    if (!owner) return null;
    var repo = prompt('GitHub 仓库名：', cfg.repo || DEFAULT_REPO_NAME);
    if (!repo) return null;
    cfg.owner = owner.trim();
    cfg.repo = repo.trim();
    try {
      localStorage.setItem(TOKEN_KEY, cfg.token);
      localStorage.setItem(REPO_OWNER_KEY, cfg.owner);
      localStorage.setItem(REPO_NAME_KEY, cfg.repo);
    } catch (e) {}
    return cfg;
  };

  proto._fetchRemoteShaViaApi = async function (cfg) {
    var url = API_ROOT + '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + this._jsonPath;
    var res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + cfg.token,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (res.status === 404) return '';
    if (!res.ok) throw new Error('读取远端文件失败：' + res.status);
    var json = await res.json();
    return json.sha || '';
  };

  proto._saveToGitHub = async function () {
    if (this._saving) return;
    var cfg = this._ensureRepoConfig();
    if (!cfg) return;
    this.save();
    this._saving = true;
    if (this._saveBtn) this._saveBtn.disabled = true;
    this._setStatus('正在保存到 GitHub…');
    try {
      var sha = this._remoteSha || await this._fetchRemoteShaViaApi(cfg);
      var payload = this._getExportPayload();
      var body = {
        message: 'chore: update sidebar state for ' + this._pageSlug,
        content: toBase64Unicode(JSON.stringify(payload, null, 2))
      };
      if (sha) body.sha = sha;
      var res = await fetch(API_ROOT + '/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + this._jsonPath, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + cfg.token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      var json = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        throw new Error((json && json.message) || ('保存失败：' + res.status));
      }
      this._remoteSha = json && json.content ? json.content.sha || '' : this._remoteSha;
      this._remoteLoaded = true;
      this._setStatus('已保存到 GitHub：' + this._jsonPath, 'success');
    } catch (err) {
      this._setStatus('保存失败：' + (err && err.message ? err.message : err), 'error');
      alert('保存到 GitHub 失败：' + (err && err.message ? err.message : err));
    } finally {
      this._saving = false;
      if (this._saveBtn) this._saveBtn.disabled = false;
    }
  };

  proto.render = function () {
    var ul = this._sidebarUl;
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    if (this._toolbarEl && this._toolbarEl.parentNode) this._toolbarEl.parentNode.removeChild(this._toolbarEl);

    var toolbar = document.createElement('div');
    toolbar.className = 'sm-toolbar';

    var row1 = document.createElement('div');
    row1.className = 'sm-toolbar-row';
    var addBtn = document.createElement('button');
    addBtn.className = 'sm-add-btn';
    addBtn.type = 'button';
    addBtn.innerHTML = '<span style="font-size:1.2em;line-height:1">+</span> 添加知识点';
    addBtn.addEventListener('click', (function (self) { return function () { self._handleAdd(); }; })(this));
    row1.appendChild(addBtn);
    toolbar.appendChild(row1);

    var row2 = document.createElement('div');
    row2.className = 'sm-toolbar-row';
    var saveBtn = document.createElement('button');
    saveBtn.className = 'sm-save-btn';
    saveBtn.type = 'button';
    saveBtn.textContent = '保存到 GitHub';
    saveBtn.addEventListener('click', (function (self) { return function () { self._saveToGitHub(); }; })(this));
    row2.appendChild(saveBtn);
    var exportBtn = document.createElement('button');
    exportBtn.className = 'sm-export-btn';
    exportBtn.type = 'button';
    exportBtn.textContent = '导出 JSON';
    exportBtn.addEventListener('click', (function (self) { return function () { self._downloadJson(); }; })(this));
    row2.appendChild(exportBtn);
    toolbar.appendChild(row2);

    var status = document.createElement('div');
    status.className = 'sm-sync-status';
    toolbar.appendChild(status);

    this._toolbarEl = toolbar;
    this._saveBtn = saveBtn;
    this._exportBtn = exportBtn;
    this._statusEl = status;
    ul.parentNode.insertBefore(toolbar, ul);

    if (this._data.order.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'sm-empty';
      empty.textContent = '暂无知识点，点击上方添加';
      ul.appendChild(empty);
      return;
    }

    for (var i = 0; i < this._data.order.length; i++) {
      var item = this._data.items[this._data.order[i]];
      if (!item) continue;
      ul.appendChild(this._buildLi(item, i));
    }
  };

  proto._buildLi = function (item, displayIndex) {
    var self = this;
    var li = document.createElement('li');
    li.className = 'sidebar-manager-item' + (displayIndex === this._activeIndex ? ' active' : '');
    li.dataset.smIndex = displayIndex;

    var handle = document.createElement('span');
    handle.className = 'sm-drag-handle';
    handle.textContent = '\u2630';
    handle.addEventListener('pointerdown', function (e) { self._onDragStart(e, li); });
    li.appendChild(handle);

    var titleSpan = document.createElement('span');
    titleSpan.className = 'sm-title';
    titleSpan.textContent = (displayIndex + 1) + '. ' + item.title;
    titleSpan.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      self._startInlineEdit(li, displayIndex);
    });
    li.appendChild(titleSpan);

    var actions = document.createElement('span');
    actions.className = 'sm-actions';
    var editBtn = document.createElement('button');
    editBtn.className = 'sm-edit-btn';
    editBtn.type = 'button';
    editBtn.title = '重命名';
    editBtn.textContent = '\u270F';
    editBtn.addEventListener('click', function (e) { e.stopPropagation(); self._startInlineEdit(li, displayIndex); });
    actions.appendChild(editBtn);
    var delBtn = document.createElement('button');
    delBtn.className = 'sm-del-btn';
    delBtn.type = 'button';
    delBtn.title = '删除';
    delBtn.textContent = '\u2715';
    delBtn.addEventListener('click', function (e) { e.stopPropagation(); self._handleDelete(displayIndex); });
    actions.appendChild(delBtn);
    li.appendChild(actions);

    li.addEventListener('click', function (e) {
      if (e.target.closest('.sm-actions') || e.target.closest('.sm-drag-handle') || e.target.closest('.sm-edit-input')) return;
      self._onNavigate(displayIndex);
    });
    return li;
  };

  proto._startInlineEdit = function (li, displayIndex) {
    var self = this;
    var dataIdx = this._data.order[displayIndex];
    var item = this._data.items[dataIdx];
    if (!item) return;
    if (li.querySelector('.sm-edit-input')) return;
    var titleSpan = li.querySelector('.sm-title');
    if (!titleSpan) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'sm-edit-input';
    input.value = stripNumber(item.title);
    titleSpan.style.display = 'none';
    li.insertBefore(input, li.querySelector('.sm-actions'));
    input.focus();
    input.select();
    function finish(save) {
      if (save) {
        var newTitle = stripNumber(input.value.trim());
        if (newTitle) {
          item.title = newTitle;
          var kp = self._knowledgePointsRef;
          if (kp[displayIndex]) kp[displayIndex].title = (displayIndex + 1) + '. ' + newTitle;
          self._persist();
        }
      }
      if (input.parentNode) input.parentNode.removeChild(input);
      titleSpan.style.display = '';
      titleSpan.textContent = (displayIndex + 1) + '. ' + item.title;
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
  };

  proto._handleDelete = function (displayIndex) {
    if (this._data.order.length <= 1) {
      alert('至少保留一个知识点');
      return;
    }
    var dataIdx = this._data.order[displayIndex];
    this._data.order.splice(displayIndex, 1);
    this._data.items.splice(dataIdx, 1);
    for (var i = 0; i < this._data.order.length; i++) {
      if (this._data.order[i] > dataIdx) this._data.order[i]--;
    }
    if (this._activeIndex >= this._data.order.length) this._activeIndex = this._data.order.length - 1;
    if (this._activeIndex < 0) this._activeIndex = 0;
    this._syncToKP();
    this._persist();
    this.render();
    this.setActiveIndex(this._activeIndex);
    this._onNavigate(this._activeIndex);
  };

  proto._handleAdd = function () {
    var self = this;
    var title = prompt('输入知识点标题：', '新知识点');
    if (!title || !title.trim()) return;
    title = title.trim();
    var newItem = { id: makeItemId(this._pageSlug, this._data.items.length, title), title: title, content: '' };
    var newItemIdx = this._data.items.length;
    this._data.items.push(newItem);
    this._data.order.push(newItemIdx);
    this._syncToKP();
    this._persist();
    this.render();
    var newDisplayIdx = this._data.order.length - 1;
    this._activeIndex = newDisplayIdx;
    this.setActiveIndex(newDisplayIdx);
    this._onNavigate(newDisplayIdx);
    setTimeout(function () {
      var items = self._sidebarUl.querySelectorAll('.sidebar-manager-item');
      var target = items[newDisplayIdx];
      if (target) self._startInlineEdit(target, newDisplayIdx);
    }, 100);
  };

  proto._onDragStart = function (e, li) {
    e.preventDefault();
    e.stopPropagation();
    var displayIndex = parseInt(li.dataset.smIndex, 10);
    if (isNaN(displayIndex)) return;
    var rect = li.getBoundingClientRect();
    var placeholder = document.createElement('li');
    placeholder.className = 'sm-drop-placeholder';
    placeholder.style.height = rect.height + 'px';
    this._drag = { li: li, displayIndex: displayIndex, placeholder: placeholder, startY: e.clientY, offsetY: e.clientY - rect.top, liHeight: rect.height, moved: false, pointerId: e.pointerId };
    if (e.target && typeof e.target.setPointerCapture === 'function' && e.pointerId != null) {
      try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var self = this;
    this._bound._move = function (ev) { self._onDragMove(ev); };
    this._bound._end = function (ev) { self._onDragEnd(ev); };
    document.addEventListener('pointermove', this._bound._move, { passive: false });
    document.addEventListener('pointerup', this._bound._end, { passive: false });
    document.addEventListener('pointercancel', this._bound._end, { passive: false });
  };

  proto._onDragMove = function (e) {
    var d = this._drag;
    if (!d) return;
    if (d.pointerId != null && e.pointerId != null && d.pointerId !== e.pointerId) return;
    e.preventDefault();
    var dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      d.li.classList.add('dragging');
      d.li.parentNode.insertBefore(d.placeholder, d.li);
      d.li.style.position = 'fixed';
      d.li.style.zIndex = '999';
      d.li.style.width = d.li.parentNode.offsetWidth + 'px';
      d.li.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    }
    var top = e.clientY - d.offsetY;
    d.li.style.top = top + 'px';
    d.li.style.left = d.li.parentNode.getBoundingClientRect().left + 'px';
    var items = this._sidebarUl.querySelectorAll('.sidebar-manager-item:not(.dragging)');
    var insertBefore = null;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      var mid = r.top + r.height / 2;
      if (e.clientY < mid) { insertBefore = items[i]; break; }
    }
    if (insertBefore) this._sidebarUl.insertBefore(d.placeholder, insertBefore);
    else this._sidebarUl.appendChild(d.placeholder);
  };

  proto._onDragEnd = function (e) {
    var d = this._drag;
    if (!d) return;
    if (d.pointerId != null && e && e.pointerId != null && d.pointerId !== e.pointerId) return;
    document.removeEventListener('pointermove', this._bound._move);
    document.removeEventListener('pointerup', this._bound._end);
    document.removeEventListener('pointercancel', this._bound._end);
    this._bound._move = null;
    this._bound._end = null;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    if (!d.moved) { this._drag = null; return; }
    var draggedOrderVal = this._data.order[d.displayIndex];
    var allChildren = Array.prototype.slice.call(this._sidebarUl.children);
    var finalOrder = [];
    for (var m = 0; m < allChildren.length; m++) {
      if (allChildren[m] === d.placeholder) finalOrder.push(draggedOrderVal);
      else if (allChildren[m].classList.contains('sidebar-manager-item') && !allChildren[m].classList.contains('dragging')) {
        var origIdx = parseInt(allChildren[m].dataset.smIndex, 10);
        if (!isNaN(origIdx)) finalOrder.push(this._data.order[origIdx]);
      }
    }
    if (finalOrder.indexOf(draggedOrderVal) === -1) finalOrder.push(draggedOrderVal);
    var oldActiveDataIdx = this._data.order[this._activeIndex];
    var newActiveDisplay = finalOrder.indexOf(oldActiveDataIdx);
    this._data.order = finalOrder;
    this._syncToKP();
    this._persist();
    d.li.classList.remove('dragging');
    d.li.style.position = '';
    d.li.style.zIndex = '';
    d.li.style.width = '';
    d.li.style.top = '';
    d.li.style.left = '';
    d.li.style.pointerEvents = '';
    if (d.placeholder.parentNode) d.placeholder.parentNode.removeChild(d.placeholder);
    this._activeIndex = newActiveDisplay >= 0 ? newActiveDisplay : 0;
    this.render();
    this.setActiveIndex(this._activeIndex);
    this._drag = null;
  };

  proto._isMobileViewport = function () {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  };

  proto._isSidebarOpen = function () {
    var sidebar = document.getElementById('sidebar');
    return !!(sidebar && sidebar.classList.contains('open'));
  };

  proto._openSidebar = function () {
    if (typeof window.openSidebar === 'function') { window.openSidebar(); return; }
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
  };

  proto._closeSidebar = function () {
    if (typeof window.closeSidebar === 'function') { window.closeSidebar(); return; }
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  };

  proto._bindSwipeGestures = function () {
    var self = this;
    var startX = 0;
    var startY = 0;
    var tracking = false;
    this._bound._touchStart = function (e) {
      if (!self._isMobileViewport()) return;
      if (!e.touches || e.touches.length !== 1) return;
      if (e.target && e.target.closest('.sm-drag-handle, .sm-edit-input, .sm-actions')) return;
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };
    this._bound._touchMove = function (e) {
      if (!tracking || !self._isMobileViewport()) return;
      if (!e.touches || e.touches.length !== 1) return;
      var touch = e.touches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);
      var isOpen = self._isSidebarOpen();
      var windowW = window.innerWidth;
      var nearLeftEdge = startX <= 48;
      var nearRightEdge = startX >= (windowW - 60);
      var sidebarRightEdge = windowW - 300;
      if (absDx < 30 || absDx <= absDy * 1.5) return;
      if (nearRightEdge) {
        if (!isOpen && dx < 0) { self._openSidebar(); tracking = false; return; }
        if (isOpen && dx > 0) { self._closeSidebar(); tracking = false; return; }
      }
      if (nearLeftEdge) {
        if (!isOpen && dx > 0) { self._openSidebar(); tracking = false; return; }
        if (isOpen && dx < 0) { self._closeSidebar(); tracking = false; return; }
      }
      if (isOpen && dx > 0 && startX >= sidebarRightEdge) { self._closeSidebar(); tracking = false; }
      else if (isOpen && dx < 0 && startX <= 320) { self._closeSidebar(); tracking = false; }
    };
    this._bound._touchEnd = function () { tracking = false; };
    document.addEventListener('touchstart', this._bound._touchStart, { passive: true });
    document.addEventListener('touchmove', this._bound._touchMove, { passive: true });
    document.addEventListener('touchend', this._bound._touchEnd, { passive: true });
    document.addEventListener('touchcancel', this._bound._touchEnd, { passive: true });
  };

  proto._bindEvents = function () {
    var self = this;
    this._bound._vis = function () { if (document.visibilityState === 'hidden') self.save(); };
    this._bound._unload = function () { self.save(); };
    document.addEventListener('visibilitychange', this._bound._vis);
    window.addEventListener('beforeunload', this._bound._unload);
    this._bindSwipeGestures();
  };

  proto.destroy = function () {
    if (window.__sidebarManagerCurrent === this) window.__sidebarManagerCurrent = null;
    if (this._bound._vis) document.removeEventListener('visibilitychange', this._bound._vis);
    if (this._bound._unload) window.removeEventListener('beforeunload', this._bound._unload);
    if (this._bound._touchStart) document.removeEventListener('touchstart', this._bound._touchStart);
    if (this._bound._touchMove) document.removeEventListener('touchmove', this._bound._touchMove);
    if (this._bound._touchEnd) {
      document.removeEventListener('touchend', this._bound._touchEnd);
      document.removeEventListener('touchcancel', this._bound._touchEnd);
    }
  };

  window.SidebarManager = SidebarManager;
})();
