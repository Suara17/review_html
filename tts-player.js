(function () {
  const STYLE_ID = 'tts-player-style';
  const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
  const DEFAULT_RATE = '+0%';
  const TTS_RENDER_CACHE = new WeakMap();

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Hide original sidebar-toggle and next-btn — tts-player replaces them */
      .sidebar-toggle { display: none !important; }
      .next-btn { display: none !important; }

      .tts-player {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 25;
        background: rgba(0,8,16,0.92);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid rgba(0,255,255,0.15);
        padding: 6px 12px 10px;
        padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
      }
      .tts-row {
        display: flex;
        align-items: center;
      }
      .tts-sidebar-btn {
        height: 44px;
        flex: 1;
        border-radius: 10px;
        border: 1px solid rgba(0,255,255,0.25);
        background: rgba(0,255,255,0.08);
        color: #00ffff;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .tts-sidebar-btn:hover {
        background: rgba(0,255,255,0.18);
      }
      .tts-btns {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        flex: 2;
      }
      .tts-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1.5px solid rgba(125, 249, 255, 0.26);
        background: linear-gradient(180deg, rgba(8,28,38,0.92), rgba(3,16,24,0.96));
        color: #9ffcff;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, border-color 0.22s ease, color 0.22s ease;
        padding: 0;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 16px rgba(0,0,0,0.22);
      }
      .tts-icon:hover {
        background: linear-gradient(180deg, rgba(10,36,48,0.96), rgba(4,20,30,0.98));
        border-color: rgba(0,255,255,0.42);
        color: #d9ffff;
        transform: translateY(-1px);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(0,255,255,0.08), 0 10px 22px rgba(0,0,0,0.26);
      }
      .tts-icon.tts-play {
        width: 54px;
        height: 54px;
        font-size: 20px;
        border-width: 1.8px;
        border-color: rgba(72, 245, 255, 0.55);
        color: #ecffff;
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,0.20), transparent 34%),
          linear-gradient(145deg, rgba(0,255,255,0.24), rgba(0,138,179,0.18) 42%, rgba(0,24,34,0.96) 100%);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.10),
          0 0 0 1px rgba(0,255,255,0.08),
          0 0 18px rgba(0,255,255,0.16),
          0 10px 26px rgba(0,0,0,0.30);
      }
      .tts-icon.tts-play:hover {
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,0.24), transparent 36%),
          linear-gradient(145deg, rgba(0,255,255,0.30), rgba(0,168,214,0.22) 42%, rgba(0,28,40,0.98) 100%);
        border-color: rgba(110, 250, 255, 0.78);
        color: #ffffff;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.14),
          0 0 0 1px rgba(0,255,255,0.12),
          0 0 24px rgba(0,255,255,0.22),
          0 14px 28px rgba(0,0,0,0.34);
      }
      .tts-icon.tts-play[data-state="playing"] {
        border-color: rgba(118, 246, 255, 0.82);
        color: #f4ffff;
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,0.26), transparent 36%),
          linear-gradient(145deg, rgba(96,255,255,0.22), rgba(0,194,255,0.20) 38%, rgba(3,42,58,0.98) 68%, rgba(1,18,28,0.99) 100%);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.16),
          inset 0 0 20px rgba(0,255,255,0.08),
          0 0 0 1px rgba(0,255,255,0.14),
          0 0 22px rgba(0,255,255,0.24),
          0 0 38px rgba(82,240,255,0.10),
          0 12px 28px rgba(0,0,0,0.32);
      }
      .tts-icon.tts-play[data-state="playing"]:hover {
        border-color: rgba(150, 250, 255, 0.94);
        color: #ffffff;
        background:
          radial-gradient(circle at 30% 28%, rgba(255,255,255,0.30), transparent 38%),
          linear-gradient(145deg, rgba(120,255,255,0.26), rgba(0,214,255,0.24) 38%, rgba(4,48,66,0.99) 68%, rgba(1,20,31,1) 100%);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          inset 0 0 24px rgba(0,255,255,0.10),
          0 0 0 1px rgba(0,255,255,0.16),
          0 0 28px rgba(0,255,255,0.30),
          0 0 44px rgba(82,240,255,0.13),
          0 14px 30px rgba(0,0,0,0.34);
      }
      .tts-icon.tts-play[data-state="playing"],
      .tts-icon.tts-play[data-state="playing"]:hover,
      .tts-icon.tts-play.is-playing,
      .tts-icon.tts-play.is-playing:hover {
        background:
          radial-gradient(circle at 28% 26%, rgba(255,255,255,0.18), transparent 34%),
          linear-gradient(145deg, rgba(7,52,70,0.98), rgba(0,115,150,0.92) 42%, rgba(0,168,190,0.82) 68%, rgba(0,30,42,0.99) 100%) !important;
        border-color: rgba(122, 245, 255, 0.88) !important;
        color: #ecffff !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.14),
          inset 0 0 18px rgba(0,255,255,0.08),
          0 0 0 1px rgba(0,255,255,0.12),
          0 0 18px rgba(0,255,255,0.18),
          0 10px 22px rgba(0,0,0,0.30) !important;
      }
      .tts-icon.tts-play[data-state="playing"]::before,
      .tts-icon.tts-play.is-playing::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(180deg, rgba(255,255,255,0.10), transparent 35%);
        pointer-events: none;
      }
      .tts-icon.tts-play[data-state="playing"] {
        position: relative;
      }
      .tts-next-btn {
        height: 44px;
        flex: 1;
        border-radius: 10px;
        border: 1px solid rgba(0,255,255,0.35);
        background: rgba(0,255,255,0.12);
        color: #00ffff;
        font-size: 0.88em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.2s;
      }
      .tts-next-btn:hover {
        background: rgba(0,255,255,0.22);
      }
      .tts-status-bar {
        text-align: center;
        padding: 4px 0 0;
      }
      .tts-status {
        color: rgba(255,255,255,0.5);
        font-size: 0.75em;
      }
      .tts-status[data-state="error"] {
        color: #ff9f9f;
      }
      .tts-status[data-state="loading"] {
        color: #8ce7ff;
      }
      .tts-status[data-state="playing"] {
        color: #00ffcc;
      }
      .tts-segment {
        display: block;
        width: 100%;
        box-sizing: border-box;
        border-radius: 6px;
        padding: 0.18em 0.35em;
        margin: 0 0 0.38em;
        line-height: 1.8;
        transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
      }
      .tts-segment:last-child {
        margin-bottom: 0;
      }
      .tts-segment.is-active {
        background: rgba(0, 255, 255, 0.18);
        color: #dfffff;
        box-shadow: 0 0 0 1px rgba(0,255,255,0.12), 0 0 12px rgba(0,255,255,0.18);
      }
      #knowledge-title.tts-title-active {
        color: #cfffff;
        text-shadow: 0 0 14px rgba(0,255,255,0.8), 0 0 28px rgba(0,255,255,0.35);
      }
      /* Adjust card bottom padding so content isn't hidden behind the bar */
      .card {
        padding-bottom: 90px !important;
      }
      @media (min-width: 641px) {
        .tts-sidebar-btn { display: none; }
        .tts-btns { flex: 3; }
        .tts-next-btn { flex: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  const SPECIAL_SPOKEN_TOKENS = {
    '__init__': '初始化方法',
    '__new__': '创建方法',
    '__str__': '字符串方法',
    '__dict__': '属性表',
    '__slots__': 'slots 约束',
    '__call__': '调用方法',
    '__doc__': '文档字符串',
    '__del__': '析构方法',
    '__name__': '名称变量',
    'AttributeError': '属性错误',
    'TypeError': '类型错误',
    'ValueError': '值错误',
    'KeyError': '键错误',
    'IndexError': '索引错误'
  };

  function toSpokenIdentifier(token) {
    if (SPECIAL_SPOKEN_TOKENS[token]) return SPECIAL_SPOKEN_TOKENS[token];
    if (!/[A-Za-z]/.test(token)) return token;

    const hadCodeStyle = /_|\.|[a-z][A-Z]|[A-Z]{2,}/.test(token);
    if (!hadCodeStyle) return token;

    return token
      .replace(/\(\)$/g, '')
      .replace(/\.py\b/gi, ' py 文件')
      .replace(/^_+|_+$/g, '')
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/\s{2,}/g, ' ')
      .trim() || token;
  }

  function normalizeSpeechText(text) {
    return (text || '')
      .replace(/"""|'''/g, '三引号')
      .replace(/->/g, ' 返回 ')
      .replace(/[A-Za-z_][A-Za-z0-9_.]*\(\)/g, (match) => toSpokenIdentifier(match))
      .replace(/[A-Za-z_][A-Za-z0-9_.]*/g, (match) => toSpokenIdentifier(match))
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function stripKnowledgeAsteriskNoise(text) {
    return String(text || '')
      .replace(/^\s*\*+\s*$/gm, '')
      .replace(/\*(?=[\u3400-\u9FFF])/gu, '')
      .replace(/(?<=[\u3400-\u9FFF])\*/gu, '')
      .replace(/\*+(?=\s*[，。；：！？、）】》”’])/gu, '')
      .replace(/(?<=[（【《“‘\s])\*+/gu, '')
      .replace(/\s{2,}/g, ' ');
  }

  function splitTextToChunks(text) {
    const source = String(text || '').replace(/\r/g, '');
    const chunks = [];
    let buffer = '';

    function pushBuffer() {
      if (!buffer) return;
      chunks.push(buffer);
      buffer = '';
    }

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      buffer += ch;
      const next = source[i + 1] || '';
      const compactLength = buffer.replace(/\s+/g, '').length;
      const hitHardStop = /[。！？!?；;：:]/.test(ch);
      const hitLineBreak = ch === '\n' && next !== '\n';
      const hitBlankLine = ch === '\n' && next === '\n';
      const hitSoftStop = compactLength >= 28 && /[，,、）)】]/.test(ch);
      const hitLongRun = compactLength >= 42;
      if (hitHardStop || hitBlankLine || hitLineBreak || hitSoftStop || hitLongRun) {
        pushBuffer();
      }
    }

    pushBuffer();

    // 合并只有标点/空白的 chunk 到前一个 chunk，避免标点独占一行导致高亮不同步
    const merged = [];
    for (let j = 0; j < chunks.length; j += 1) {
      const stripped = chunks[j].replace(/[\s\n]/g, '');
      if (/^[，,。.、；;：:！!？?）)】\]」》>~\-—…]+$/.test(stripped) && merged.length > 0) {
        merged[merged.length - 1] += chunks[j].replace(/\n/g, ' ');
      } else {
        merged.push(chunks[j]);
      }
    }

    // 清理 chunk 内部多余换行
    for (let k = 0; k < merged.length; k += 1) {
      merged[k] = merged[k].replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');
    }

    return merged;
  }

  function buildSegmentSpan(fragment, rawText, segments) {
    const match = String(rawText || '').match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = match ? match[2] : rawText;

    if (core && core.trim()) {
      const span = document.createElement('span');
      const segmentIndex = segments.length;
      span.className = 'tts-segment';
      span.dataset.segmentIndex = String(segmentIndex);
      span.textContent = core.trim();
      fragment.appendChild(span);
      const spokenText = normalizeSpeechText(core.replace(/\s+/g, ' ').trim()) || core.trim();
      segments.push({
        index: segmentIndex,
        visibleText: core.trim(),
        spokenText
      });
    } else if (core) {
      fragment.appendChild(document.createTextNode(core));
    }
  }

  function buildRenderedKnowledge(kp) {
    const title = stripKnowledgeAsteriskNoise(kp && kp.title ? String(kp.title) : '');
    const html = kp && kp.content ? String(kp.content) : '';
    const cacheKey = `${title}\n@@\n${html}`;
    const cached = TTS_RENDER_CACHE.get(kp);
    if (cached && cached.cacheKey === cacheKey) return cached;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');

    const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('pre, code, script, style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((textNode) => {
      textNode.nodeValue = stripKnowledgeAsteriskNoise(textNode.nodeValue);
    });

    const bodySegments = [];
    textNodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      splitTextToChunks(textNode.nodeValue).forEach((chunk) => {
        buildSegmentSpan(fragment, chunk, bodySegments);
      });
      textNode.parentNode.replaceChild(fragment, textNode);
    });

    const titleSpokenText = normalizeSpeechText(title);
    const segments = [];
    if (titleSpokenText) {
      segments.push({
        kind: 'title',
        visibleText: title,
        spokenText: titleSpokenText,
        bodyIndex: -1
      });
    }
    bodySegments.forEach((segment) => {
      if (!segment.spokenText) return;
      segments.push({
        kind: 'body',
        visibleText: segment.visibleText,
        spokenText: segment.spokenText,
        bodyIndex: segment.index
      });
    });

    const result = {
      cacheKey,
      html: wrapper.innerHTML,
      bodySegments,
      segments,
      speechText: segments.map((segment) => segment.spokenText).filter(Boolean).join('。\n')
    };
    TTS_RENDER_CACHE.set(kp, result);
    return result;
  }

  function htmlToSpeechText(title, html) {
    return buildRenderedKnowledge({ title, content: html }).speechText;
  }

  window.renderTtsKnowledgeContent = function renderTtsKnowledgeContent(kp) {
    const rendered = buildRenderedKnowledge(kp || {});
    return `<div id="detail-content" style="display:none;">${rendered.html}</div>`;
  };

  window.setupTtsPlayer = function setupTtsPlayer(options) {
    injectStyle();

    const {
      pageId,
      knowledgePoints,
      getIndex,
      navigateToIndex,
      ensureExpanded,
      apiUrl,
      voice = DEFAULT_VOICE,
      rate = DEFAULT_RATE,
      insertBefore = 'next-btn'
    } = options || {};

    if (!pageId || !Array.isArray(knowledgePoints) || typeof getIndex !== 'function' || typeof navigateToIndex !== 'function') {
      throw new Error('setupTtsPlayer 缺少必要配置');
    }

    const anchor = document.getElementById(insertBefore);
    if (!anchor || document.querySelector('.tts-player')) return;

    const controls = document.createElement('div');
    controls.className = 'tts-player';
    controls.innerHTML = `
      <div class="tts-row">
        <button type="button" class="tts-sidebar-btn" data-action="sidebar" title="目录">☰</button>
        <div class="tts-btns">
          <button type="button" class="tts-icon" data-action="prev" title="上一块">⏮</button>
          <button type="button" class="tts-icon tts-play" data-action="play" title="播放/暂停">▶</button>
          <button type="button" class="tts-icon" data-action="next-block" title="下一块">⏭</button>
        </div>
        <button type="button" class="tts-next-btn" data-action="next-card">下一个 →</button>
      </div>
      <div class="tts-status-bar">
        <span class="tts-status" data-state="idle">就绪</span>
      </div>
    `;
    document.body.appendChild(controls);

    const statusEl = controls.querySelector('.tts-status');
    const playBtn = controls.querySelector('[data-action="play"]');
    const audioCache = new Map();
    let currentAudio = null;
    let sessionId = 0;
    let currentMode = 'idle';
    let progressFrame = 0;
    let activeGlobalSegment = -1;
    let previousCurrentTime = 0;
    let currentRendered = null;
    let currentTimeline = [];

    function setStatus(text, state) {
      statusEl.textContent = text;
      statusEl.dataset.state = state;
      if (playBtn) {
        playBtn.dataset.state = state === 'playing' ? 'playing' : 'idle';
        playBtn.classList.toggle('is-playing', state === 'playing');
        playBtn.textContent = state === 'playing' ? '⏸' : '▶';
      }
    }

    function getCurrentDetailEl() {
      return document.getElementById('detail-content');
    }

    function getCardEl() {
      return document.querySelector('.card');
    }

    function getTitleEl() {
      return document.getElementById('knowledge-title');
    }

    function getSpeechText(targetIndex) {
      const point = knowledgePoints[targetIndex];
      if (!point) return '';
      return buildRenderedKnowledge(point).speechText || htmlToSpeechText(point.title, point.content);
    }

    function refreshCurrentRendered(targetIndex) {
      currentRendered = buildRenderedKnowledge(knowledgePoints[targetIndex] || {});
      return currentRendered;
    }

    function clearHighlight() {
      const detailEl = getCurrentDetailEl();
      if (detailEl) {
        detailEl.querySelectorAll('.tts-segment.is-active').forEach((el) => el.classList.remove('is-active'));
      }
      const titleEl = getTitleEl();
      if (titleEl) titleEl.classList.remove('tts-title-active');
      activeGlobalSegment = -1;
    }

    function scrollSegmentIntoView(el) {
      if (!el) return;
      const cardEl = getCardEl();
      if (!cardEl) return;
      const cardRect = cardEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const upperBound = cardRect.top + cardRect.height * 0.22;
      const lowerBound = cardRect.bottom - cardRect.height * 0.22;
      if (elRect.top >= upperBound && elRect.bottom <= lowerBound) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    function setActiveSegment(globalIndex) {
      if (globalIndex === activeGlobalSegment) return;
      clearHighlight();
      activeGlobalSegment = globalIndex;
      if (globalIndex < 0 || !currentRendered || !currentRendered.segments[globalIndex]) return;
      const segment = currentRendered.segments[globalIndex];
      if (segment.kind === 'title') {
        const titleEl = getTitleEl();
        if (titleEl) titleEl.classList.add('tts-title-active');
        return;
      }
      const detailEl = getCurrentDetailEl();
      if (!detailEl) return;
      const target = detailEl.querySelector(`.tts-segment[data-segment-index="${segment.bodyIndex}"]`);
      if (!target) return;
      target.classList.add('is-active');
      scrollSegmentIntoView(target);
    }

    function estimateTimeline(duration) {
      if (!currentRendered || !currentRendered.segments.length || !Number.isFinite(duration) || duration <= 0) {
        currentTimeline = [];
        return [];
      }
      const weights = currentRendered.segments.map((segment) => {
        const compact = (segment.spokenText || '').replace(/\s+/g, '');
        const base = Math.max(compact.length, 2);
        const punctuationBonus = (segment.spokenText.match(/[。！？!?；;：:,，、]/g) || []).length * 0.8;
        return base + punctuationBonus;
      });
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
      let cursor = 0;
      currentTimeline = weights.map((weight, index) => {
        const start = cursor;
        cursor += (duration * weight) / totalWeight;
        return {
          index,
          start,
          end: index === weights.length - 1 ? duration : cursor
        };
      });
      return currentTimeline;
    }

    function getActiveSegmentByTime(currentTime, duration) {
      const timeline = currentTimeline.length ? currentTimeline : estimateTimeline(duration);
      if (!timeline.length) return currentRendered && currentRendered.segments.length ? 0 : -1;
      for (let i = 0; i < timeline.length; i += 1) {
        const item = timeline[i];
        if (currentTime >= item.start && currentTime < item.end) return item.index;
      }
      return timeline[timeline.length - 1].index;
    }

    function stopProgressTracking() {
      if (progressFrame) cancelAnimationFrame(progressFrame);
      progressFrame = 0;
      previousCurrentTime = 0;
    }

    function syncProgress(localSession) {
      if (localSession !== sessionId || !currentAudio) return;
      const duration = currentAudio.duration;
      const time = currentAudio.currentTime || 0;
      if (time + 0.2 < previousCurrentTime) {
        setActiveSegment(0);
      } else {
        setActiveSegment(getActiveSegmentByTime(time, duration));
      }
      previousCurrentTime = time;
      if (!currentAudio.paused) {
        progressFrame = requestAnimationFrame(() => syncProgress(localSession));
      }
    }

    function startProgressTracking(localSession) {
      stopProgressTracking();
      previousCurrentTime = currentAudio ? currentAudio.currentTime || 0 : 0;
      if (currentAudio && !currentAudio.paused) {
        progressFrame = requestAnimationFrame(() => syncProgress(localSession));
      }
    }

    function decodeBase64Audio(audioBase64, audioMime) {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: audioMime || 'audio/mpeg' });
    }

    function normalizeBackendTimeline(timeline) {
      if (!Array.isArray(timeline) || !currentRendered || !currentRendered.segments.length) return [];
      const normalized = timeline
        .map((item) => {
          const index = Number(item && item.index);
          const start = Number(item && item.start);
          const end = Number(item && item.end);
          if (!Number.isInteger(index) || index < 0 || index >= currentRendered.segments.length) return null;
          if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
          return {
            index,
            start: Math.max(0, start),
            end: Math.max(Math.max(0, start), end)
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.index - b.index);

      if (!normalized.length) return [];
      const seen = new Set();
      for (let i = 0; i < normalized.length; i += 1) {
        if (seen.has(normalized[i].index)) return [];
        seen.add(normalized[i].index);
      }
      if (normalized.length !== currentRendered.segments.length) return [];
      for (let i = 0; i < normalized.length; i += 1) {
        if (normalized[i].index !== i) return [];
      }
      return normalized;
    }

    async function fetchAudioUrl(targetIndex, mode) {
      const point = knowledgePoints[targetIndex];
      const text = getSpeechText(targetIndex);
      if (!text) {
        throw new Error('当前块没有可朗读文本');
      }
      const rendered = currentRendered || refreshCurrentRendered(targetIndex);
      const segments = rendered.segments.map((segment, index) => ({
        index,
        text: segment.spokenText
      }));
      const cacheKey = JSON.stringify({ pageId, targetIndex, title: point && point.title, content: point && point.content, text, voice, rate, segments });
      if (audioCache.has(cacheKey)) {
        return audioCache.get(cacheKey);
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          index: targetIndex,
          mode,
          voice,
          rate,
          text,
          segments
        })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || '音频生成失败');
      }
      const payload = await response.json();
      if (!payload || typeof payload.audioBase64 !== 'string' || !payload.audioBase64) {
        throw new Error('音频响应格式无效');
      }
      const blob = decodeBase64Audio(payload.audioBase64, payload.audioMime);
      const audioUrl = URL.createObjectURL(blob);
      const result = {
        audioUrl,
        timeline: normalizeBackendTimeline(payload.segments)
      };
      audioCache.set(cacheKey, result);
      return result;
    }

    function stopAudio(updateStatus) {
      sessionId += 1;
      currentMode = 'idle';
      stopProgressTracking();
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
      }
      clearHighlight();
      if (updateStatus) {
        setStatus('朗读已停止', 'idle');
      }
    }

    function playBlockLoop(targetIndex) {
      stopAudio(false);
      currentMode = 'block-loop';
      const localSession = sessionId;
      navigateToIndex(targetIndex);
      if (typeof ensureExpanded === 'function') ensureExpanded();
      // 内容展开后立即滚动到卡片顶部，防止浏览器自动滚到底部
      const cardEl = getCardEl();
      if (cardEl) cardEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      refreshCurrentRendered(targetIndex);
      currentTimeline = [];
      setActiveSegment(0);
      setStatus(`正在生成第 ${targetIndex + 1} 块音频...`, 'loading');
      const audio = new Audio();
      currentAudio = audio;
      audio.loop = true;
      audio.onloadedmetadata = () => {
        if (audio !== currentAudio || localSession !== sessionId) return;
        if (!currentTimeline.length) {
          estimateTimeline(audio.duration);
        }
      };
      audio.onplay = () => {
        if (audio !== currentAudio || localSession !== sessionId) return;
        startProgressTracking(localSession);
      };
      audio.onpause = () => {
        if (audio !== currentAudio) return;
        stopProgressTracking();
      };
      audio.onerror = () => {
        if (audio !== currentAudio) return;
        stopProgressTracking();
        setStatus('音频播放失败', 'error');
      };
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
      const playPromise = audio.play();
      fetchAudioUrl(targetIndex, 'block-loop')
        .then(({ audioUrl, timeline }) => {
          if (localSession !== sessionId) return;
          currentTimeline = timeline && timeline.length ? timeline : [];
          audio.src = audioUrl;
          setStatus(`正在循环朗读第 ${targetIndex + 1} 块`, 'playing');
          return audio.play();
        })
        .catch((error) => {
          if (localSession !== sessionId) return;
          if (playPromise) {
            playPromise.catch(() => {});
          }
          console.error(error);
          stopProgressTracking();
          setStatus(`朗读失败：${error.message}`, 'error');
        });
    }

    controls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const currentIndex = getIndex();

      if (action === 'sidebar') {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.click();
        return;
      }
      if (action === 'play') {
        if (currentMode !== 'idle' && currentAudio && !currentAudio.paused) {
          currentAudio.pause();
          setStatus('已暂停', 'idle');
          currentMode = 'paused';
        } else if (currentMode === 'paused' && currentAudio) {
          currentAudio.play().catch(() => {});
          setStatus(`正在循环朗读第 ${currentIndex + 1} 块`, 'playing');
          currentMode = 'block-loop';
          startProgressTracking(sessionId);
        } else {
          playBlockLoop(currentIndex);
        }
        return;
      }
      if (action === 'prev') {
        const prevIndex = (currentIndex - 1 + knowledgePoints.length) % knowledgePoints.length;
        playBlockLoop(prevIndex);
        return;
      }
      if (action === 'next-block') {
        const nextIndex = (currentIndex + 1) % knowledgePoints.length;
        playBlockLoop(nextIndex);
        return;
      }
      if (action === 'next-card') {
        if (typeof window.goToNextKnowledge === 'function') {
          window.goToNextKnowledge();
          return;
        }
        stopAudio(true);
        const nextIndex = (currentIndex + 1) % knowledgePoints.length;
        navigateToIndex(nextIndex);
        return;
      }
    });

    window.stopTts = function () { stopAudio(true); };
    window.isTtsPlaying = function () { return currentMode === 'block-loop' && !!currentAudio && !currentAudio.paused; };

    window.addEventListener('beforeunload', () => {
      stopAudio(false);
      audioCache.forEach((item) => {
        if (item && item.audioUrl) URL.revokeObjectURL(item.audioUrl);
      });
    });
  };
})();