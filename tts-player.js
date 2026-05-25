(function () {
  const STYLE_ID = 'tts-player-style';
  const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
  const DEFAULT_RATE = '+0%';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tts-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 16px 0 12px;
        align-items: center;
      }
      .tts-btn {
        min-height: 40px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid rgba(0,255,255,0.28);
        background: rgba(0,255,255,0.1);
        color: #00ffff;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s;
      }
      .tts-btn:hover {
        background: rgba(0,255,255,0.18);
        box-shadow: 0 0 16px rgba(0,255,255,0.14);
      }
      .tts-status {
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.82);
        font-size: 0.92em;
      }
      .tts-status[data-state="error"] {
        color: #ff9f9f;
        border-color: rgba(255,120,120,0.28);
      }
      .tts-status[data-state="loading"] {
        color: #8ce7ff;
      }
      @media (max-width: 640px) {
        .tts-controls {
          gap: 8px;
        }
        .tts-btn, .tts-status {
          width: 100%;
          justify-content: center;
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
    if (!anchor || anchor.dataset.ttsMounted === 'true') return;

    const controls = document.createElement('div');
    controls.className = 'tts-controls';
    controls.innerHTML = `
      <button type="button" class="tts-btn" data-action="block-loop">循环当前块</button>
      <button type="button" class="tts-btn" data-action="page">整页顺播</button>
      <button type="button" class="tts-btn" data-action="next">下一块朗读</button>
      <button type="button" class="tts-btn" data-action="stop">停止朗读</button>
      <span class="tts-status" data-state="idle">朗读待命</span>
    `;
    anchor.parentNode.insertBefore(controls, anchor);
    anchor.dataset.ttsMounted = 'true';

    const statusEl = controls.querySelector('.tts-status');
    const audioCache = new Map();
    let currentAudio = null;
    let sessionId = 0;
    let currentMode = 'idle';

    function setStatus(text, state) {
      statusEl.textContent = text;
      statusEl.dataset.state = state;
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

    async function playBlockLoop(targetIndex) {
      stopAudio(false);
      currentMode = 'block-loop';
      const localSession = sessionId;
      navigateToIndex(targetIndex);
      if (typeof ensureExpanded === 'function') ensureExpanded();
      setStatus(`正在生成第 ${targetIndex + 1} 块音频...`, 'loading');
      try {
        const audioUrl = await fetchAudioUrl(targetIndex, 'block-loop');
        if (localSession !== sessionId) return;
        const audio = new Audio(audioUrl);
        currentAudio = audio;
        audio.loop = true;
        audio.onerror = () => {
          if (audio !== currentAudio) return;
          setStatus('音频播放失败', 'error');
        };
        setStatus(`正在循环朗读第 ${targetIndex + 1} 块`, 'playing');
        await audio.play();
      } catch (error) {
        if (localSession !== sessionId) return;
        console.error(error);
        setStatus(`朗读失败：${error.message}`, 'error');
      }
    }

    async function playPageFrom(targetIndex) {
      stopAudio(false);
      currentMode = 'page';
      const localSession = sessionId;

      async function playSequential(cursor) {
        navigateToIndex(cursor);
        if (typeof ensureExpanded === 'function') ensureExpanded();
        setStatus(`正在生成第 ${cursor + 1} 块音频...`, 'loading');
        try {
          const audioUrl = await fetchAudioUrl(cursor, 'page');
          if (localSession !== sessionId) return;
          const audio = new Audio(audioUrl);
          currentAudio = audio;
          audio.loop = false;
          audio.onended = () => {
            if (localSession !== sessionId) return;
            if (cursor >= knowledgePoints.length - 1) {
              currentAudio = null;
              currentMode = 'idle';
              setStatus('整页朗读完成', 'idle');
              return;
            }
            playSequential(cursor + 1);
          };
          audio.onerror = () => {
            if (localSession !== sessionId) return;
            setStatus('音频播放失败', 'error');
          };
          setStatus(`正在顺播第 ${cursor + 1}/${knowledgePoints.length} 块`, 'playing');
          await audio.play();
        } catch (error) {
          if (localSession !== sessionId) return;
          console.error(error);
          setStatus(`朗读失败：${error.message}`, 'error');
        }
      }

      playSequential(targetIndex);
    }

    controls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const currentIndex = getIndex();
      if (action === 'block-loop') {
        playBlockLoop(currentIndex);
        return;
      }
      if (action === 'page') {
        playPageFrom(currentIndex);
        return;
      }
      if (action === 'next') {
        const nextIndex = (currentIndex + 1) % knowledgePoints.length;
        if (currentMode === 'page') {
          playPageFrom(nextIndex);
        } else {
          playBlockLoop(nextIndex);
        }
        return;
      }
      if (action === 'stop') {
        stopAudio(true);
      }
    });

    window.addEventListener('beforeunload', () => {
      stopAudio(false);
      audioCache.forEach((url) => URL.revokeObjectURL(url));
    });
  };
})();
