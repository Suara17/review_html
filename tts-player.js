(function () {
  const STYLE_ID = 'tts-player-style';
  const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
  const DEFAULT_RATE = '+0%';

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
        gap: 8px;
      }
      .tts-sidebar-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid rgba(0,255,255,0.25);
        background: rgba(0,255,255,0.08);
        color: #00ffff;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      .tts-sidebar-btn:hover {
        background: rgba(0,255,255,0.18);
      }
      .tts-btns {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .tts-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1.5px solid rgba(0,255,255,0.3);
        background: rgba(0,255,255,0.08);
        color: #00ffff;
        font-size: 13px;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        padding: 0;
      }
      .tts-icon:hover {
        background: rgba(0,255,255,0.18);
      }
      .tts-icon.tts-play {
        width: 44px;
        height: 44px;
        font-size: 17px;
        border-width: 2px;
      }
      .tts-icon.tts-play[data-state="playing"] {
        background: rgba(0,255,255,0.2);
        box-shadow: 0 0 12px rgba(0,255,255,0.25);
      }
      .tts-next-btn {
        height: 40px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid rgba(0,255,255,0.35);
        background: rgba(0,255,255,0.12);
        color: #00ffff;
        font-size: 0.88em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
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
      /* Adjust card bottom padding so content isn't hidden behind the bar */
      .card {
        padding-bottom: 90px !important;
      }
      @media (min-width: 641px) {
        .tts-player {
          left: auto;
          right: 24px;
          bottom: 24px;
          border-radius: 16px;
          border: 1px solid rgba(0,255,255,0.15);
          box-shadow: 0 4px 30px rgba(0,0,0,0.5);
          max-width: 400px;
        }
        .tts-sidebar-btn { display: none; }
        /* Restore original sidebar-toggle on desktop */
        .sidebar-toggle { display: none !important; }
      }
      @media (max-width: 640px) {
        .tts-icon {
          width: 34px;
          height: 34px;
          font-size: 12px;
        }
        .tts-icon.tts-play {
          width: 42px;
          height: 42px;
          font-size: 16px;
        }
        .tts-next-btn {
          padding: 0 12px;
          font-size: 0.82em;
        }
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

  function htmlToSpeechText(title, html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = (html || '').replace(/<br\s*\/?>/gi, '\n');
    wrapper.querySelectorAll('li').forEach((li) => {
      li.insertAdjacentText('afterbegin', '• ');
      li.insertAdjacentText('beforeend', '\n');
    });
    const contentText = normalizeSpeechText(wrapper.textContent
      .replace(/ /g, ' ')
      .replace(/[\t ]+\n/g, '\n')
      .replace(/\n[\t ]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ ]{2,}/g, ' ')
      .trim());
    return normalizeSpeechText([title, contentText].filter(Boolean).join('。\n'));
  }

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

    function setStatus(text, state) {
      statusEl.textContent = text;
      statusEl.dataset.state = state;
      if (playBtn) {
        playBtn.dataset.state = state === 'playing' ? 'playing' : 'idle';
        playBtn.textContent = state === 'playing' ? '⏸' : '▶';
      }
    }

    function getSpeechText(targetIndex) {
      const point = knowledgePoints[targetIndex];
      if (!point) return '';
      return htmlToSpeechText(point.title, point.content);
    }

    async function fetchAudioUrl(targetIndex, mode) {
      const text = getSpeechText(targetIndex);
      if (!text) {
        throw new Error('当前块没有可朗读文本');
      }
      const cacheKey = JSON.stringify({ pageId, targetIndex, text, voice, rate });
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
          text
        })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || '音频生成失败');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      audioCache.set(cacheKey, objectUrl);
      return objectUrl;
    }

    function stopAudio(updateStatus) {
      sessionId += 1;
      currentMode = 'idle';
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
      }
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
      setStatus(`正在生成第 ${targetIndex + 1} 块音频...`, 'loading');
      const audio = new Audio();
      currentAudio = audio;
      audio.loop = true;
      audio.onerror = () => {
        if (audio !== currentAudio) return;
        setStatus('音频播放失败', 'error');
      };
      // Start silent play in user gesture to unlock autoplay
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
      const playPromise = audio.play();
      fetchAudioUrl(targetIndex, 'block-loop')
        .then((audioUrl) => {
          if (localSession !== sessionId) return;
          audio.src = audioUrl;
          setStatus(`正在循环朗读第 ${targetIndex + 1} 块`, 'playing');
          return audio.play();
        })
        .catch((error) => {
          if (localSession !== sessionId) return;
          // If initial silent play was rejected, try once more after fetch
          if (playPromise) {
            playPromise.catch(() => {});
          }
          console.error(error);
          setStatus(`朗读失败：${error.message}`, 'error');
        });
    }

    controls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const currentIndex = getIndex();

      if (action === 'sidebar') {
        // Open the sidebar drawer
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
        } else {
          playBlockLoop(currentIndex);
        }
        return;
      }
      if (action === 'prev') {
        const prevIndex = (currentIndex - 1 + knowledgePoints.length) % knowledgePoints.length;
        navigateToIndex(prevIndex);
        playBlockLoop(prevIndex);
        return;
      }
      if (action === 'next-block') {
        const nextIndex = (currentIndex + 1) % knowledgePoints.length;
        navigateToIndex(nextIndex);
        playBlockLoop(nextIndex);
        return;
      }
      if (action === 'next-card') {
        stopAudio(true);
        const nextIndex = (currentIndex + 1) % knowledgePoints.length;
        navigateToIndex(nextIndex);
        return;
      }
    });

    window.addEventListener('beforeunload', () => {
      stopAudio(false);
      audioCache.forEach((url) => URL.revokeObjectURL(url));
    });
  };
})();
