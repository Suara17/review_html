(function () {
  'use strict';

  var STYLE_ID = 'sidebar-manager-style';
  var STORAGE_PREFIX = 'sidebar-data:';
  var NUMBER_RE = /^\s*\d+\s*[.．、]\s*/;

  function stripNumber(title) {
    return (title || '').replace(NUMBER_RE, '');
  }

  /* ── CSS injection ── */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* ── add button ── */
      '.sm-add-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;margin:8px 0 12px;padding:10px 16px;border:2px dashed rgba(0,255,255,0.3);border-radius:10px;background:rgba(0,255,255,0.05);color:#00ffff;font-size:.95em;font-weight:600;cursor:pointer;transition:all .25s}',
      '.sm-add-btn:hover,.sm-add-btn:active{background:rgba(0,255,255,0.12);border-color:rgba(0,255,255,0.5);box-shadow:0 0 16px rgba(0,255,255,0.12)}',

      /* ── list item ── */
      '#sidebar-list .sidebar-manager-item{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 6px!important;margin:4px 0!important;min-height:48px;border-radius:10px;transition:background .25s,border-color .25s,box-shadow .25s;cursor:pointer;border:1px solid transparent;position:relative;overflow:visible!important;touch-action:pan-y}',
      '#sidebar-list .sidebar-manager-item:hover{background:rgba(0,255,255,0.12)!important;border-color:rgba(0,255,255,0.25)!important;box-shadow:0 0 16px rgba(0,255,255,0.08)}',
      '#sidebar-list .sidebar-manager-item.active{background:rgba(0,255,255,0.1)!important;border-color:rgba(0,255,255,0.4)!important}',
      '#sidebar-list .sidebar-manager-item::before{display:none!important}',
      '#sidebar-list .sidebar-manager-item.dragging{opacity:.7;z-index:999;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.5)!important;transition:none!important}',

      /* ── drag handle ── */
      '.sm-drag-handle{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;color:rgba(0,255,255,0.4);font-size:1.1em;cursor:grab;transition:color .2s,background .2s;user-select:none;-webkit-user-select:none;touch-action:none}',
      '.sm-drag-handle:hover{color:#00ffff;background:rgba(0,255,255,0.1)}',
      '.sm-drag-handle:active{cursor:grabbing}',

      /* ── title ── */
      '.sm-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.95em;color:rgba(255,255,255,0.9);padding:4px 0;user-select:none;-webkit-user-select:none}',

      /* ── action buttons ── */
      '.sm-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;opacity:0;transition:opacity .2s}',
      '#sidebar-list .sidebar-manager-item:hover .sm-actions{opacity:1}',
      '.sm-edit-btn,.sm-del-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;font-size:.85em;cursor:pointer;transition:all .2s;line-height:1}',
      '.sm-edit-btn{background:rgba(0,255,255,0.1);color:#00ffff}',
      '.sm-edit-btn:hover{background:rgba(0,255,255,0.25);box-shadow:0 0 10px rgba(0,255,255,0.15)}',
      '.sm-del-btn{background:rgba(255,80,80,0.1);color:#ff6b6b}',
      '.sm-del-btn:hover{background:rgba(255,80,80,0.25);box-shadow:0 0 10px rgba(255,80,80,0.15)}',

      /* ── inline edit input ── */
      '.sm-edit-input{flex:1;min-width:0;padding:6px 10px;border:1px solid rgba(0,255,255,0.4);border-radius:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:.95em;outline:none;box-shadow:0 0 12px rgba(0,255,255,0.15)}',
      '.sm-edit-input:focus{border-color:#00ffff}',

      /* ── drop placeholder ── */
      '.sm-drop-placeholder{height:4px;margin:2px 0;border-radius:2px;background:rgba(0,255,255,0.5);box-shadow:0 0 8px rgba(0,255,255,0.3);transition:opacity .15s}',

      /* ── rename dialog ── */
      '.sm-dialog-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65)}',
      '.sm-dialog{width:min(380px,90%);background:rgba(0,12,24,0.97);border:1px solid rgba(0,255,255,0.3);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,0.5);overflow:hidden}',
      '.sm-dialog-title{padding:16px 18px;font-size:1em;color:#00ffff;border-bottom:1px solid rgba(0,255,255,0.15)}',
      '.sm-dialog-body{padding:16px 18px}',
      '.sm-dialog-input{width:100%;padding:10px 14px;border:1px solid rgba(0,255,255,0.3);border-radius:10px;background:rgba(0,0,0,0.35);color:#fff;font-size:1em;outline:none;box-sizing:border-box}',
      '.sm-dialog-input:focus{border-color:#00ffff;box-shadow:0 0 12px rgba(0,255,255,0.15)}',
      '.sm-dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding:12px 18px;border-top:1px solid rgba(0,255,255,0.1)}',
      '.sm-dialog-btn{min-width:70px;padding:8px 16px;border-radius:10px;border:1px solid rgba(0,255,255,0.3);background:rgba(0,255,255,0.1);color:#00ffff;font-size:.92em;cursor:pointer;transition:all .2s}',
      '.sm-dialog-btn:hover{background:rgba(0,255,255,0.2);box-shadow:0 0 12px rgba(0,255,255,0.15)}',
      '.sm-dialog-btn.primary{background:rgba(0,255,255,0.18);font-weight:600}',

      /* ── empty state ── */
      '.sm-empty{text-align:center;padding:24px 16px;color:rgba(255,255,255,0.35);font-size:.92em}',

      /* ── mobile: always show actions, bigger targets ── */
      '@media(hover:none){.sm-actions{opacity:1!important}#sidebar-list .sidebar-manager-item{min-height:52px;padding:10px 8px 10px 6px!important;touch-action:pan-y}}',,

      /* ── mobile sidebar overrides ── */
      '@media(max-width:768px){',
      '  #sidebar-list .sidebar-manager-item{min-height:50px;padding:10px 8px 10px 6px!important}',
      '  .sm-drag-handle{width:32px;height:32px;font-size:1.2em}',
      '  .sm-edit-btn,.sm-del-btn{width:34px;height:34px;font-size:.95em}',
      '  .sm-add-btn{min-height:48px;font-size:1em}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── SidebarManager constructor ── */
  function SidebarManager(opts) {
    if (!(this instanceof SidebarManager)) return new SidebarManager(opts);

    this._sidebarUl = opts.sidebarUl;
    this._knowledgePointsRef = opts.knowledgePoints; // reference to page's array
    this._onNavigate = opts.onNavigate || function () {};
    this._activeIndex = 0;

    this._data = null;  // { items: [{title, content}], order: [int] }
    this._drag = null;   // drag state
    this._bound = {};    // bound event handlers for cleanup

    injectStyle();
    this._loadAndHydrate();
    this._bindEvents();
    window.__sidebarManagerCurrent = this;
  }

  var proto = SidebarManager.prototype;

  /* ── data migration + hydration ── */
  proto._loadAndHydrate = function () {
    var storageKey = STORAGE_PREFIX + location.pathname;
    var raw = null;
    try { raw = localStorage.getItem(storageKey); } catch (e) {}
    if (raw) {
      try { this._data = JSON.parse(raw); } catch (e) { this._data = null; }
    }

    // migration from old format
    if (!this._data) {
      var oldKey = 'knowledge-point-overrides:' + location.pathname;
      var oldRaw = null;
      try { oldRaw = localStorage.getItem(oldKey); } catch (e) {}
      if (oldRaw) {
        try {
          var contents = JSON.parse(oldRaw);
          if (Array.isArray(contents)) {
            var orig = this._knowledgePointsRef;
            var items = [];
            var len = Math.max(orig.length, contents.length);
            for (var i = 0; i < len; i++) {
              items.push({
                title: stripNumber(orig[i] ? orig[i].title : ('知识点 ' + (i + 1))),
                content: (typeof contents[i] === 'string') ? contents[i] : (orig[i] ? orig[i].content : '')
              });
            }
            var order = [];
            for (var j = 0; j < items.length; j++) order.push(j);
            this._data = { items: items, order: order };
            this._persist();
            try { localStorage.removeItem(oldKey); } catch (e) {}
          }
        } catch (e) { /* ignore */ }
      }
    }

    if (!this._data) {
      var origItems = this._knowledgePointsRef;
      var items = [];
      for (var k = 0; k < origItems.length; k++) {
        items.push({ title: stripNumber(origItems[k].title), content: origItems[k].content });
      }
      var order = [];
      for (var m = 0; m < items.length; m++) order.push(m);
      this._data = { items: items, order: order };
    }

    // strip any existing number prefixes from loaded data
    for (var s = 0; s < this._data.items.length; s++) {
      this._data.items[s].title = stripNumber(this._data.items[s].title);
    }
    this._syncToKP();
  };

  proto._syncToKP = function () {
    var kp = this._knowledgePointsRef;
    var data = this._data;
    var mapped = [];
    for (var i = 0; i < data.order.length; i++) {
      var item = data.items[data.order[i]];
      if (item) mapped.push({ title: (i + 1) + '. ' + item.title, content: item.content });
    }
    kp.splice.apply(kp, [0, kp.length].concat(mapped));
  };

  proto._persist = function () {
    try {
      localStorage.setItem(STORAGE_PREFIX + location.pathname, JSON.stringify(this._data));
    } catch (e) {}
    if (window.__gistSyncDebounced) window.__gistSyncDebounced();
  };

  /* ── public: save ── */
  proto.save = function () {
    // sync content from knowledgePoints back to data items
    var kp = this._knowledgePointsRef;
    var data = this._data;
    for (var i = 0; i < data.order.length && i < kp.length; i++) {
      var idx = data.order[i];
      if (data.items[idx]) {
        data.items[idx].title = stripNumber(kp[i].title);
        data.items[idx].content = kp[i].content;
      }
    }
    this._persist();
  };

  /* ── public: get/set active index ── */
  proto.getStorageKey = function () {
    return STORAGE_PREFIX + location.pathname;
  };

  proto.getActiveIndex = function () { return this._activeIndex; };

  proto.reloadFromStorage = function () {
    var previousIndex = this._activeIndex;
    this._loadAndHydrate();
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

  /* ── public: render sidebar ── */
  proto.render = function () {
    var ul = this._sidebarUl;
    // clear
    while (ul.firstChild) ul.removeChild(ul.firstChild);

    // remove old add button if exists
    var oldBtn = ul.parentNode.querySelector('.sm-add-btn');
    if (oldBtn) oldBtn.parentNode.removeChild(oldBtn);

    // add button
    var addBtn = document.createElement('button');
    addBtn.className = 'sm-add-btn';
    addBtn.type = 'button';
    addBtn.innerHTML = '<span style="font-size:1.2em;line-height:1">+</span> 添加知识点';
    addBtn.addEventListener('click', (function (self) {
      return function () { self._handleAdd(); };
    })(this));
    ul.parentNode.insertBefore(addBtn, ul);

    // empty state
    if (this._data.order.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'sm-empty';
      empty.textContent = '暂无知识点，点击上方添加';
      ul.appendChild(empty);
      return;
    }

    // items
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

    // drag handle
    var handle = document.createElement('span');
    handle.className = 'sm-drag-handle';
    handle.textContent = '\u2630'; // ☰
    handle.addEventListener('pointerdown', function (e) { self._onDragStart(e, li); });
    li.appendChild(handle);

    // title
    var titleSpan = document.createElement('span');
    titleSpan.className = 'sm-title';
    titleSpan.textContent = (displayIndex + 1) + '. ' + item.title;
    titleSpan.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      self._startInlineEdit(li, displayIndex);
    });
    li.appendChild(titleSpan);

    // actions
    var actions = document.createElement('span');
    actions.className = 'sm-actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'sm-edit-btn';
    editBtn.type = 'button';
    editBtn.title = '重命名';
    editBtn.textContent = '\u270F'; // ✏
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self._startInlineEdit(li, displayIndex);
    });
    actions.appendChild(editBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'sm-del-btn';
    delBtn.type = 'button';
    delBtn.title = '删除';
    delBtn.textContent = '\u2715'; // ✕
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self._handleDelete(displayIndex);
    });
    actions.appendChild(delBtn);
    li.appendChild(actions);

    // click to navigate
    li.addEventListener('click', function (e) {
      if (e.target.closest('.sm-actions') || e.target.closest('.sm-drag-handle') || e.target.closest('.sm-edit-input')) return;
      self._onNavigate(displayIndex);
    });

    return li;
  };

  /* ── inline rename ── */
  proto._startInlineEdit = function (li, displayIndex) {
    var self = this;
    var dataIdx = this._data.order[displayIndex];
    var item = this._data.items[dataIdx];
    if (!item) return;

    // already editing?
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
          // sync to knowledgePoints (with number prefix)
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

  /* ── delete ── */
  proto._handleDelete = function (displayIndex) {
    if (this._data.order.length <= 1) {
      alert('至少保留一个知识点');
      return;
    }
    var dataIdx = this._data.order[displayIndex];
    // remove from order
    this._data.order.splice(displayIndex, 1);
    // remove item data
    this._data.items.splice(dataIdx, 1);
    // fix order indices: any index > dataIdx should be decremented
    for (var i = 0; i < this._data.order.length; i++) {
      if (this._data.order[i] > dataIdx) this._data.order[i]--;
    }
    // adjust active index
    if (this._activeIndex >= this._data.order.length) {
      this._activeIndex = this._data.order.length - 1;
    }
    if (this._activeIndex < 0) this._activeIndex = 0;

    this._syncToKP();
    this._persist();
    this.render();
    this.setActiveIndex(this._activeIndex);
    // notify page to refresh display
    this._onNavigate(this._activeIndex);
  };

  /* ── add ── */
  proto._handleAdd = function () {
    var self = this;
    var title = prompt('输入知识点标题：', '新知识点');
    if (!title || !title.trim()) return;
    title = title.trim();

    // add item
    var newItem = { title: title, content: '' };
    var newItemIdx = this._data.items.length;
    this._data.items.push(newItem);
    this._data.order.push(newItemIdx);

    this._syncToKP();
    this._persist();
    this.render();
    // navigate to the new item
    var newDisplayIdx = this._data.order.length - 1;
    this._activeIndex = newDisplayIdx;
    this.setActiveIndex(newDisplayIdx);
    this._onNavigate(newDisplayIdx);

    // auto-start inline edit
    setTimeout(function () {
      var items = self._sidebarUl.querySelectorAll('.sidebar-manager-item');
      var target = items[newDisplayIdx];
      if (target) self._startInlineEdit(target, newDisplayIdx);
    }, 100);
  };

  /* ── drag and drop ── */
  proto._onDragStart = function (e, li) {
    e.preventDefault();
    e.stopPropagation();
    var displayIndex = parseInt(li.dataset.smIndex, 10);
    if (isNaN(displayIndex)) return;

    var rect = li.getBoundingClientRect();
    var placeholder = document.createElement('li');
    placeholder.className = 'sm-drop-placeholder';
    placeholder.style.height = rect.height + 'px';

    this._drag = {
      li: li,
      displayIndex: displayIndex,
      placeholder: placeholder,
      startY: e.clientY,
      offsetY: e.clientY - rect.top,
      liHeight: rect.height,
      moved: false,
      pointerId: e.pointerId
    };

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

    // find insert position
    var items = this._sidebarUl.querySelectorAll('.sidebar-manager-item:not(.dragging)');
    var insertBefore = null;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      var mid = r.top + r.height / 2;
      if (e.clientY < mid) { insertBefore = items[i]; break; }
    }

    if (insertBefore) {
      this._sidebarUl.insertBefore(d.placeholder, insertBefore);
    } else {
      this._sidebarUl.appendChild(d.placeholder);
    }
  };

  proto._onDragEnd = function (e) {
    var d = this._drag;
    if (!d) return;
    if (d.pointerId != null && e && e.pointerId != null && d.pointerId !== e.pointerId) return;

    // cleanup global listeners
    document.removeEventListener('pointermove', this._bound._move);
    document.removeEventListener('pointerup', this._bound._end);
    document.removeEventListener('pointercancel', this._bound._end);
    this._bound._move = null;
    this._bound._end = null;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    if (!d.moved) {
      // just a click, no drag
      this._drag = null;
      return;
    }

    // calculate new order
    var children = this._sidebarUl.querySelectorAll('.sidebar-manager-item:not(.dragging)');
    var newOrder = [];
    var insertIdx = -1;
    var childArr = Array.prototype.slice.call(children);
    for (var i = 0; i < childArr.length; i++) {
      // is placeholder before this child?
      if (d.placeholder.parentNode === this._sidebarUl &&
          d.placeholder.compareDocumentPosition(childArr[i]) & Node.DOCUMENT_POSITION_FOLLOWING &&
          (i === 0 || !(d.placeholder.compareDocumentPosition(childArr[i-1]) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        // placeholder is here
      }
      var idx = parseInt(childArr[i].dataset.smIndex, 10);
      if (!isNaN(idx)) newOrder.push(this._data.order[idx]);
    }

    // figure out where placeholder is
    var ph = d.placeholder;
    var phIndex = -1;
    var allChildren = Array.prototype.slice.call(this._sidebarUl.children);
    for (var k = 0; k < allChildren.length; k++) {
      if (allChildren[k] === ph) { phIndex = k; break; }
    }

    // rebuild order: non-dragging items in DOM order, insert dragged item at placeholder position
    var draggedOrderVal = this._data.order[d.displayIndex];
    var finalOrder = [];
    var itemIdx = 0;
    for (var m = 0; m < allChildren.length; m++) {
      if (allChildren[m] === ph) {
        finalOrder.push(draggedOrderVal);
      } else if (allChildren[m].classList.contains('sidebar-manager-item') && !allChildren[m].classList.contains('dragging')) {
        var origIdx = parseInt(allChildren[m].dataset.smIndex, 10);
        if (!isNaN(origIdx)) finalOrder.push(this._data.order[origIdx]);
      }
    }

    // if placeholder was somehow removed, just append dragged
    if (finalOrder.indexOf(draggedOrderVal) === -1) {
      finalOrder.push(draggedOrderVal);
    }

    // update active index: where did the previously active item end up?
    var oldActiveDataIdx = this._data.order[this._activeIndex];
    var newActiveDisplay = finalOrder.indexOf(oldActiveDataIdx);

    this._data.order = finalOrder;
    this._syncToKP();
    this._persist();

    // cleanup drag visuals
    d.li.classList.remove('dragging');
    d.li.style.position = '';
    d.li.style.zIndex = '';
    d.li.style.width = '';
    d.li.style.top = '';
    d.li.style.left = '';
    d.li.style.pointerEvents = '';
    if (ph.parentNode) ph.parentNode.removeChild(ph);

    this._activeIndex = newActiveDisplay >= 0 ? newActiveDisplay : 0;
    this.render();
    this.setActiveIndex(this._activeIndex);
    this._drag = null;
  };

  /* ── swipe gesture helpers ── */
  proto._isMobileViewport = function () {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  };

  proto._isSidebarOpen = function () {
    var sidebar = document.getElementById('sidebar');
    return !!(sidebar && sidebar.classList.contains('open'));
  };

  proto._openSidebar = function () {
    if (typeof window.openSidebar === 'function') {
      window.openSidebar();
      return;
    }
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
  };

  proto._closeSidebar = function () {
    if (typeof window.closeSidebar === 'function') {
      window.closeSidebar();
      return;
    }
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
    var sidebar = document.getElementById('sidebar');

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
      var sidebarRightEdge = windowW - 300; // sidebar is 300px wide on the right

      if (absDx < 30 || absDx <= absDy * 1.5) return;

      // Right-side drawer: swipe LEFT (dx < 0) from right edge to open
      if (nearRightEdge) {
        if (!isOpen && dx < 0) {
          self._openSidebar();
          tracking = false;
          return;
        }

        if (isOpen && dx > 0) {
          self._closeSidebar();
          tracking = false;
          return;
        }
      }

      // Left-side drawer: swipe RIGHT (dx > 0) from left edge to open
      if (nearLeftEdge) {
        if (!isOpen && dx > 0) {
          self._openSidebar();
          tracking = false;
          return;
        }

        if (isOpen && dx < 0) {
          self._closeSidebar();
          tracking = false;
          return;
        }
      }

      // When sidebar is open, swipe toward its edge to close it
      if (isOpen && dx > 0 && startX >= sidebarRightEdge) {
        // Right-side: swipe RIGHT inside sidebar closes it
        self._closeSidebar();
        tracking = false;
      } else if (isOpen && dx < 0 && startX <= 320) {
        // Left-side: swipe LEFT inside sidebar closes it
        self._closeSidebar();
        tracking = false;
      }
    };

    this._bound._touchEnd = function () {
      tracking = false;
    };

    document.addEventListener('touchstart', this._bound._touchStart, { passive: true });
    document.addEventListener('touchmove', this._bound._touchMove, { passive: true });
    document.addEventListener('touchend', this._bound._touchEnd, { passive: true });
    document.addEventListener('touchcancel', this._bound._touchEnd, { passive: true });
  };

  /* ── event binding ── */
  proto._bindEvents = function () {
    var self = this;
    // Save on visibility change (page hide/unload)
    this._bound._vis = function () {
      if (document.visibilityState === 'hidden') self.save();
    };
    this._bound._unload = function () { self.save(); };
    document.addEventListener('visibilitychange', this._bound._vis);
    window.addEventListener('beforeunload', this._bound._unload);
    this._bindSwipeGestures();
  };

  /* ── public: destroy ── */
  proto.destroy = function () {
    if (window.__sidebarManagerCurrent === this) {
      window.__sidebarManagerCurrent = null;
    }
    if (this._bound._vis) document.removeEventListener('visibilitychange', this._bound._vis);
    if (this._bound._unload) window.removeEventListener('beforeunload', this._bound._unload);
    if (this._bound._touchStart) document.removeEventListener('touchstart', this._bound._touchStart);
    if (this._bound._touchMove) document.removeEventListener('touchmove', this._bound._touchMove);
    if (this._bound._touchEnd) {
      document.removeEventListener('touchend', this._bound._touchEnd);
      document.removeEventListener('touchcancel', this._bound._touchEnd);
    }
  };

  /* ── export ── */
  window.SidebarManager = SidebarManager;
})();