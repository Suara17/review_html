/* db-manager.js — SQLite (sql.js) + IndexedDB 持久化数据库层 */
(function () {
  'use strict';

  var DB_NAME = 'review_kb_v2';
  var STORE_NAME = 'dbs';

  var SQL = null;        // initSqlJs 返回的命名空间
  var db = null;         // 当前 SQLite 实例
  var currentSlug = '';  // 当前页面 slug

  var _saveTimer = null;

  /* ───────────── 公开接口 ───────────── */
  window.DbManager = {

    /** 初始化：从 IndexedDB 恢复，若不存在则 seed */
    init: async function (seedCards, slug) {
      currentSlug = slug;

      if (!SQL) {
        SQL = await initSqlJs({
          locateFile: function (f) {
            return 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/' + f;
          }
        });
      }

      var saved = await _loadFromIDB(slug);
      if (saved) {
        db = new SQL.Database(saved);
        db.run('CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)');
      } else {
        db = new SQL.Database();
        db.run('CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)');
        var stmt = db.prepare('INSERT INTO cards (title, content, sort_order) VALUES (?, ?, ?)');
        for (var i = 0; i < seedCards.length; i++) {
          stmt.run([seedCards[i].title, seedCards[i].content, i]);
        }
        stmt.free();
        await _saveToIDB(slug);
      }
      return this;
    },

    /** 取全部卡片，按 sort_order 排序 */
    getCards: function () {
      if (!db) return [];
      var r = db.exec('SELECT id, title, content, sort_order FROM cards ORDER BY sort_order, id');
      if (!r || !r.length) return [];
      return r[0].values.map(function (row) {
        return { id: row[0], title: row[1], content: row[2], sort_order: row[3] };
      });
    },

    /** 新增卡片 */
    addCard: function (title, content) {
      if (!db) return -1;
      var maxR = db.exec('SELECT COALESCE(MAX(sort_order), -1) FROM cards');
      var nextOrder = (maxR && maxR.length) ? maxR[0].values[0][0] + 1 : 0;
      db.run('INSERT INTO cards (title, content, sort_order) VALUES (?, ?, ?)', [title, content, nextOrder]);
      var idR = db.exec('SELECT last_insert_rowid()');
      var id = (idR && idR.length) ? idR[0].values[0][0] : -1;
      _scheduleSave();
      return id;
    },

    /** 更新卡片 */
    updateCard: function (id, title, content) {
      if (!db) return;
      db.run('UPDATE cards SET title = ?, content = ? WHERE id = ?', [title, content, id]);
      _scheduleSave();
    },

    /** 删除卡片 */
    deleteCard: function (id) {
      if (!db) return;
      db.run('DELETE FROM cards WHERE id = ?', [id]);
      _scheduleSave();
    },

    /** 重排序（传入 id 数组，按顺序赋值） */
    reorderCards: function (ids) {
      if (!db) return;
      var stmt = db.prepare('UPDATE cards SET sort_order = ? WHERE id = ?');
      for (var i = 0; i < ids.length; i++) {
        stmt.run([i, ids[i]]);
      }
      stmt.free();
      _scheduleSave();
    },

    /** 导出 .db 二进制数据（用于下载备份） */
    exportDb: function () {
      return db ? db.export() : null;
    },

    /** 获取卡片数量 */
    count: function () {
      if (!db) return 0;
      var r = db.exec('SELECT COUNT(*) FROM cards');
      return (r && r.length) ? r[0].values[0][0] : 0;
    },

    /** 立即持久化 */
    flush: function () {
      if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
      _saveToIDB(currentSlug);
    }
  };

  /* ───────────── 内部 ───────────── */

  function _loadFromIDB(slug) {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          e.target.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = function (e) {
          var tx = e.target.result.transaction(STORE_NAME, 'readonly');
          var get = tx.objectStore(STORE_NAME).get('db:' + slug);
          get.onsuccess = function () { resolve(get.result || null); };
          get.onerror = function () { resolve(null); };
        };
        req.onerror = function () { resolve(null); };
      } catch (_) { resolve(null); }
    });
  }

  function _saveToIDB(slug) {
    return new Promise(function (resolve) {
      if (!db) { resolve(); return; }
      try {
        var data = db.export();
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function (e) {
          e.target.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = function (e) {
          var tx = e.target.result.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(data, 'db:' + slug);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        };
        req.onerror = function () { resolve(); };
      } catch (_) { resolve(); }
    });
  }

  function _scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      _saveTimer = null;
      _saveToIDB(currentSlug);
    }, 200);
  }

  /* 页面关闭前确保持久化 */
  window.addEventListener('beforeunload', function () {
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    if (db && currentSlug) {
      var data = db.export();
      // IndexedDB 在 beforeunload 不一定可靠，强同步存到 localStorage 作为兜底
      try {
        localStorage.setItem('db_fallback_' + currentSlug, btoa(
          Array.from(data).map(function (b) { return String.fromCharCode(b); }).join('')
        ));
      } catch (_) {}
    }
  });

})();
