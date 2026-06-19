import React, { useState, useEffect, useRef } from "react";

const API_BASE = 'https://review.zrui73366.workers.dev';
const TTS_URL = 'https://review-html-five.vercel.app/api/tts';
import { Category, Card } from "./types";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronRight, 
  ChevronLeft,
  Clock, 
  RotateCcw, 
  Save, 
  Download, 
  ArrowUpDown, 
  Plus, 
  Edit, 
  Trash2, 
  Menu,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  CornerDownLeft,
  Terminal,
  Activity,
  Cpu,
  RefreshCw,
  Award
} from "lucide-react";

import { loadRewards, saveRewards, getLevel, getNextLevel, xpProgress, XP_PER_CARD_CYCLE, XP_PER_TTS_MINUTE, XP_PER_CATEGORY_CLEAR, XP_PER_LOGIN, LEVELS, type RewardState } from "./data/rewards";

export default function App() {
  // Application Modes / Views
  const [currentView, setCurrentView] = useState<"hub" | "dashboard">("hub");
  
  // Database State
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("computer-network");
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  
  // Sorting State
  const [isSortingMode, setIsSortingMode] = useState<boolean>(false);
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  
  // Memorize/Recall Cooldown Timer State (30 seconds)
  const [timerCount, setTimerCount] = useState<number>(30);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [recallMode, setRecallMode] = useState<"recall" | "cooldown">("recall"); // 'recall' wait 30s to reveal, 'cooldown' wait 30s to proceed to next

  // TTS Player State
  const [isPlayingTTS, setIsPlayingTTS] = useState<boolean>(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number>(0);
  const [ttsTimeline, setTtsTimeline] = useState<any[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.1);

  // Modal State for Editing / Adding
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [editCategoryLabel, setEditCategoryLabel] = useState<string>("");

  // Status notifications ticker
  const [statusText, setStatusText] = useState<string>("SYSTEM STATUS: SECURE CONNECTION ACTIVE");
  const [latency, setLatency] = useState<number>(24);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsMetaRef = useRef({ index: 0, total: 0 });
  
  // Reward System State
  const [rewards, setRewards] = useState<RewardState>(() => loadRewards());
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpName, setLevelUpName] = useState('');
  const rewardsRef = useRef(rewards);
  rewardsRef.current = rewards;
  const ttsSecondAccum = useRef(0);
  const viewedCardIds = useRef<Set<string>>(new Set());

  function addXP(amount: number, reason?: string) {
    setRewards(prev => {
      const oldLevel = getLevel(prev.xp);
      const newXp = prev.xp + amount;
      const newLevel = getLevel(newXp);
      const updated = { ...prev, xp: newXp };
      if (newLevel.level > oldLevel.level) {
        updated.level = newLevel.level;
        updated.seenLevelUp = [...(updated.seenLevelUp || []), newLevel.level];
        setLevelUpName(newLevel.name);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 4000);
      }
      saveRewards(updated);
      return updated;
    });
  }

  // Daily login XP check
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    setRewards(prev => {
      if (prev.lastLoginDate === today) return prev;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      const streak = prev.lastLoginDate === yStr ? (prev.loginStreak || 0) + 1 : 1;
      const bonus = XP_PER_LOGIN + (streak > 1 ? (streak - 1) * 2 : 0);
      const updated = { ...prev, lastLoginDate: today, loginStreak: streak, xp: prev.xp + bonus };
      const oldLevel = getLevel(prev.xp);
      const newLevel = getLevel(updated.xp);
      if (newLevel.level > oldLevel.level) {
        updated.level = newLevel.level;
        updated.seenLevelUp = [...(updated.seenLevelUp || []), newLevel.level];
        setLevelUpName(newLevel.name);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 4000);
      }
      saveRewards(updated);
      return updated;
    });
  }, []);

  // Check if all cards in current category have been viewed → award category clear XP
  function checkCategoryCompletion() {
    const slug = selectedCategorySlug;
    const catCards = cards.filter(c => c.slug === slug);
    const allViewed = catCards.every(c => viewedCardIds.current.has(c.id));
    const alreadyDone = rewardsRef.current.completedCategories.includes(slug);
    if (allViewed && catCards.length > 0 && !alreadyDone) {
      addXP(XP_PER_CATEGORY_CLEAR);
      setRewards(prev => {
        const updated = { ...prev, completedCategories: [...prev.completedCategories, slug] };
        saveRewards(updated);
        return updated;
      });
      updateStatus(`🏆 通关「${categories.find(c => c.slug === slug)?.title || slug}」！+${XP_PER_CATEGORY_CLEAR}XP`);
    }
  }

  // ----------------------------------------------------
  // 1. Initial Data Fetching & Syncing
  // ----------------------------------------------------
  useEffect(() => {
    fetchDatabase();
    
    // Simulate real latent system connection updates
    const latencyInterval = setInterval(() => {
      setLatency(prev => Math.max(12, Math.min(68, prev + Math.floor(Math.random() * 9) - 4)));
    }, 5000);

    return () => clearInterval(latencyInterval);
  }, []);

  const fetchDatabase = async () => {
    try {
      updateStatus("CONNECTING TO CYBER D1 DATABASE LAYER...");
      const res = await fetch(`${API_BASE}/api/cards`);
      const data = await res.json();
      if (data.success) {
        // Sort items by sequence 'order' parameter
        const sortedCats = (data.categories || []).sort((a: any, b: any) => a.order - b.order);
        const sortedCards = (data.cards || []).sort((a: any, b: any) => a.order - b.order);
        setCategories(sortedCats);
        setCards(sortedCards);
        updateStatus("NEURAL DB FETCH: SUCCESSFUL");
      }
    } catch (err) {
      console.error(err);
      updateStatus("DB INTERFACE FAULT. REVERTING TO MEMORY BACKUP.");
    }
  };

  const updateStatus = (text: string) => {
    setStatusText(`SYSTEM_LOG: ${text}`);
  };

  // ----------------------------------------------------
  // 2. Matrix Rainfall Canvas Background Graphic
  // ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Matrix particles parameters
    const letters = "0101010101ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+=".split("");
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, width, height);

      // Cyan neon colors represent technical coding workspace
      ctx.fillStyle = "rgba(0, 255, 255, 0.35)";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reset drops when touching bottom or with tiny random re-entry delay
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    const ticker = () => {
      draw();
      animationId = requestAnimationFrame(ticker);
    };
    ticker();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ----------------------------------------------------
  // Get active cards in selected topic
  // ----------------------------------------------------
  const filteredCards = cards.filter(c => c.slug === selectedCategorySlug);
  const activeCard: Card | undefined = filteredCards[activeCardIndex];

  // ----------------------------------------------------
  // 3. 30s Cooldown State & Automations
  // ----------------------------------------------------
  // Reset state when card changes (NOT when recallMode changes)
  useEffect(() => {
    setTimerCount(30);
    setIsRevealed(false);
    setRecallMode("recall");
    setCurrentParagraphIndex(0);
  }, [selectedCategorySlug, activeCardIndex, currentView]);

  // Timer tick effect (uses refs to avoid stale closure on recallMode)
  const recallModeRef = useRef(recallMode);
  const isPlayingTTSRef = useRef(isPlayingTTS);
  useEffect(() => { recallModeRef.current = recallMode; }, [recallMode]);
  useEffect(() => { isPlayingTTSRef.current = isPlayingTTS; }, [isPlayingTTS]);

  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (currentView !== "dashboard" || !activeCard) return;

    timerIntervalRef.current = setInterval(() => {
      if (isTimerPaused) return;

      setTimerCount(prev => {
        if (prev <= 1) {
          const mode = recallModeRef.current;
          const ttsPlaying = isPlayingTTSRef.current;
          if (mode === "recall") {
            setIsRevealed(true);
            setRecallMode("cooldown");
            updateStatus("RECALL COOLDOWN COMMENCED - UNMASKING CODES");
            return 30;
          } else {
            if (ttsPlaying) {
              updateStatus("TTS TRANSMISSION ACTIVE: POSTPONING AUTOMATED HOP");
              return 15;
            }
            // Loop: go back to recall mode, cycle repeats on same card
            setIsRevealed(false);
            setRecallMode("recall");
            // Award XP for completing a card cycle
            addXP(XP_PER_CARD_CYCLE);
            setRewards(prev => {
              const updated = { ...prev, cardCycles: (prev.cardCycles || 0) + 1 };
              saveRewards(updated);
              return updated;
            });
            updateStatus("RECALL CYCLE RESTARTED");
            return 30;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [selectedCategorySlug, activeCardIndex, isTimerPaused, currentView]);

  // Clean elements from card HTML content
  const getParagraphs = (htmlContent: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    
    // Attempt extract <p>, <li>, <pre> blocks
    const blocks: string[] = [];
    tempDiv.childNodes.forEach(node => {
      const text = node.textContent?.trim() || "";
      if (text.length > 0) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          blocks.push((node as HTMLElement).outerHTML);
        } else {
          blocks.push(`<p>${text}</p>`);
        }
      }
    });

    if (blocks.length === 0) {
      blocks.push(htmlContent);
    }
    return blocks;
  };

  const activeParagraphs = activeCard ? getParagraphs(activeCard.content) : [];

  // Toggle reveal state manually
  const toggleReveal = () => {
    setIsRevealed(!isRevealed);
    if (!isRevealed) {
      setRecallMode("cooldown");
      setTimerCount(30);
    } else {
      setRecallMode("recall");
      setTimerCount(30);
    }
  };

  // ----------------------------------------------------
  // 4. TTS Cybernet Voice System
  // ----------------------------------------------------
  // Python conversion & clean tags for professional reading
  const cleanTalkText = (htmlText: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = htmlText;
    let text = temp.textContent || temp.innerText || "";

    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/__init__/g, "初始化方法")
      .replace(/__str__/g, "字符串表示形式方法")
      .replace(/__repr__/g, "格式化表示规范方法")
      .replace(/__dict__/g, "字典属性方法")
      .replace(/__new__/g, "构造实例化方法")
      .replace(/__call__/g, "调用执行仿函数")
      .replace(/self/g, "自身对象实例")
      .replace(/def /g, "定义新方法 ")
      .replace(/class /g, "声明类 ")
      .replace(/import /g, "载入模块 ")
      .replace(/volatile/g, "多线程可见修饰符")
      .replace(/synchronized/g, "线程同步安全监视锁")
      .replace(/select/g, "选择检索指令")
      .replace(/where/g, "过滤边界条件")
      .replace(/update/g, "变更事务操作")
      .replace(/delete/g, "移除行操作")
      .replace(/TCP/gi, "传输控制协议")
      .replace(/UDP/gi, "用户数据报协议")
      .replace(/IP/gi, "网际协议")
      .replace(/API/gi, "应用接口")
      .replace(/D1/gi, "云端分布式数据库")
      .replace(/IDB/gi, "本地缓存存储")
      .replace(/SYN/gi, "同步状态标记")
      .replace(/ACK/gi, "确认接收应答")
      .replace(/RST/gi, "重置连接标志")
      .trim();
  };

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }

  // Auto-advance: when paragraph index changes during playback, speak new paragraph
  useEffect(() => {
    if (isPlayingTTS) {
      speakActiveParagraph();
    }
  }, [currentParagraphIndex]);

  const speakActiveParagraph = () => {
    stopAudio();

    if (!activeCard || activeParagraphs.length === 0) return;

    const rawBlock = activeParagraphs[currentParagraphIndex];
    const cleanedText = cleanTalkText(rawBlock);
    if (!cleanedText.trim()) return;

    setIsRevealed(true);
    updateStatus(`TTS: FETCHING AUDIO...`);

    // Save current playback metadata in ref for onended callback
    const paraIndex = currentParagraphIndex;
    const paraTotal = activeParagraphs.length;
    ttsMetaRef.current = { index: paraIndex, total: paraTotal };

    // Send to Vercel Edge TTS
    fetch(`${TTS_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: cleanedText,
        voice: "zh-CN-XiaoxiaoNeural",
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);

      // Set timeline for segment highlighting
      if (data.segments && data.segments.length > 0) {
        setTtsTimeline(data.segments);
      }

      // Decode base64 audio and play
      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.audioMime || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      // Track TTS listening time for XP
      audio.ontimeupdate = () => {
        if (!audio.paused) {
          ttsSecondAccum.current += 0.5; // approximately every timeupdate
          if (ttsSecondAccum.current >= 60) {
            ttsSecondAccum.current = 0;
            addXP(XP_PER_TTS_MINUTE, 'tts');
            setRewards(prev => {
              const updated = { ...prev, ttsMinutes: (prev.ttsMinutes || 0) + 1 };
              saveRewards(updated);
              return updated;
            });
          }
        }
      };

      audio.onended = () => {
        URL.revokeObjectURL(url);
        const meta = ttsMetaRef.current;
        // Loop: if last paragraph, go back to first; otherwise advance
        if (meta.index < meta.total - 1) {
          setCurrentParagraphIndex(prev => prev + 1);
        } else {
          // Loop back to start of the same card
          setCurrentParagraphIndex(0);
          updateStatus("TTS: LOOPING CARD");
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        updateStatus("TTS ERROR: PLAYBACK FAILED");
      };

      audio.play().catch(err => {
        updateStatus("TTS ERROR: " + err.message);
        setIsPlayingTTS(false);
      });

      updateStatus("EDGE TTS: PLAYING");
    })
    .catch(err => {
      updateStatus("TTS FAILED: " + err.message);
      setIsPlayingTTS(false);
      console.error('[TTS]', err);
    });
  };

  const handleToggleTTS = () => {
    if (isPlayingTTS) {
      stopAudio();
      setIsPlayingTTS(false);
      updateStatus("TTS DEACTIVATED");
    } else {
      setIsPlayingTTS(true);
      speakActiveParagraph();
      updateStatus("TTS ACTIVATED - EDGE VOICE");
    }
  };

  const handlePrevBlock = () => {
    if (currentParagraphIndex > 0) {
      setCurrentParagraphIndex(prev => prev - 1);
    } else {
      updateStatus("FIRST INTEL PARAGRAPH BOUNDARY REGISTERED");
    }
  };

  const handleNextBlock = () => {
    if (currentParagraphIndex < activeParagraphs.length - 1) {
      setCurrentParagraphIndex(prev => prev + 1);
    } else {
      // Loop back to first paragraph
      setCurrentParagraphIndex(0);
    }
  };

  const handleNextCard = () => {
    if (filteredCards.length === 0) return;
    const nextIdx = (activeCardIndex + 1) % filteredCards.length;
    setActiveCardIndex(nextIdx);
    setCurrentParagraphIndex(0);
    // Track viewed card for category completion
    if (filteredCards[nextIdx]) viewedCardIds.current.add(filteredCards[nextIdx].id);
    checkCategoryCompletion();
    if (isPlayingTTS) {
      setTimeout(() => speakActiveParagraph(), 300);
    }
    updateStatus(`TRANSITIONING TO NODE: #${nextIdx + 1}`);
  };

  const handlePrevCard = () => {
    if (filteredCards.length === 0) return;
    const prevIdx = activeCardIndex === 0 ? filteredCards.length - 1 : activeCardIndex - 1;
    setActiveCardIndex(prevIdx);
    setCurrentParagraphIndex(0);
    // Track viewed card for category completion
    if (filteredCards[prevIdx]) viewedCardIds.current.add(filteredCards[prevIdx].id);
    checkCategoryCompletion();
    if (isPlayingTTS) {
      setTimeout(() => speakActiveParagraph(), 300);
    }
    updateStatus(`RETURNING TO NODE: #${prevIdx + 1}`);
  };

  // ----------------------------------------------------
  // 5. GitHub Sort & Save States Sync (Manual + D1 backend)
  // ----------------------------------------------------
  const handleSaveToGithub = async () => {
    updateStatus("PUSHING SPECIFICATION METADATA SCHEMES TO REPOSITORY...");
    try {
      const res = await fetch(`${API_BASE}/api/cards/sync`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, cards })
      });
      const data = await res.json();
      if (data.success) {
        updateStatus("GITHUB API PORT SYNC: COMPLETED SUCCESSFULLY (SHA VERIFIED)");
        alert("✔️ 成功同步及保存排序配置到 GitHub 远程仓库！");
      }
    } catch (err) {
      updateStatus("GITHUB PIPELINE DISCONNECTED - FALLBACK AUTO-LOCAL SAVE");
    }
  };

  const handlePullFromGithub = async () => {
    updateStatus("PULLING PRODUCTION REGISTRY FROM REPOSITORY MAIN BRANCH...");
    await fetchDatabase();
    alert("✔️ 已成功获取 GitHub 远程存储，重置当前状态为云端最新版。");
  };

  const handleRestoreDefaultSort = async () => {
    if (window.confirm("确认要恢复全部默认设置与原始种子排序吗？此操作将清洗所有的增删改。")) {
      updateStatus("DESTRUCTIVE COMMAND INVOKED - PURGING ACTIVE MATRIX");
      try {
        const res = await fetch(`${API_BASE}/api/cards`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          setCategories(data.data.categories);
          setCards(data.data.cards);
          setSelectedCategorySlug(data.data.categories[0]?.slug || "computer-network");
          setActiveCardIndex(0);
          updateStatus("MATRIX RESET PROTOCOL: ACTIVE. ENTIRE SYSTEM STABLE.");
          alert("💥 全系统数据库还原成功！");
        }
      } catch (err) {
        updateStatus("DESTRUCTION PROTOCOL ABORTED. PERMISSION TIMEOUT.");
      }
    }
  };

  // Drag & drop sorting handlers for categories (Homepage view list)
  const handleCatDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCatId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCatDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedCatId || draggedCatId === id) return;

    // reorder on dragover for instant reactive cyber feedback
    const activeList = [...categories];
    const dragIdx = activeList.findIndex(c => c.id === draggedCatId);
    const hoverIdx = activeList.findIndex(c => c.id === id);

    if (dragIdx > -1 && hoverIdx > -1) {
      const [removed] = activeList.splice(dragIdx, 1);
      activeList.splice(hoverIdx, 0, removed);
      
      // re-calculate standard orders sequential
      const updatedList = activeList.map((item, index) => ({
        ...item,
        order: index + 1
      }));
      setCategories(updatedList);
    }
  };

  const handleCatDragEnd = () => {
    setDraggedCatId(null);
    updateStatus("PERSISTING INDEX ORDER ALGORITHM TO SERVER CONFIG");
    // Trigger automated Cloudflare D1 debounce sync
    triggerBackendD1Sync(categories, cards);
  };

  // Sidebar interactive card ordering drag controllers (Dashboard view)
  const handleCardDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCardId(id);
  };

  const handleCardDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedCardId || draggedCardId === id) return;

    const activeList = [...cards];
    const dragIdx = activeList.findIndex(c => c.id === draggedCardId);
    const hoverIdx = activeList.findIndex(c => c.id === id);

    if (dragIdx > -1 && hoverIdx > -1) {
      const [removed] = activeList.splice(dragIdx, 1);
      activeList.splice(hoverIdx, 0, removed);

      const updatedList = activeList.map((item, index) => ({
        ...item,
        order: index + 1
      }));
      setCards(updatedList);
    }
  };

  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    updateStatus("D1 CARD COLLECTION SWAP INDEX SYNCHRONIZED");
    triggerBackendD1Sync(categories, cards);
  };

  const triggerBackendD1Sync = async (updatedCats: Category[], updatedCards: Card[]) => {
    // mock debounce and dynamic push API
    try {
      await fetch(`${API_BASE}/api/cards/sync`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: updatedCats, cards: updatedCards })
      });
    } catch (e) {
      console.warn("Silent background synchronization loss", e);
    }
  };

  // Precise navigation swap directions helpers
  const moveCatUp = (idx: number) => {
    if (idx === 0) return;
    const items = [...categories];
    const temp = items[idx];
    items[idx] = items[idx - 1];
    items[idx - 1] = temp;
    const reordered = items.map((item, i) => ({ ...item, order: i + 1 }));
    setCategories(reordered);
    triggerBackendD1Sync(reordered, cards);
    updateStatus("SEQUENCE MODIFICATION APPLIED");
  };

  const moveCatDown = (idx: number) => {
    if (idx === categories.length - 1) return;
    const items = [...categories];
    const temp = items[idx];
    items[idx] = items[idx + 1];
    items[idx + 1] = temp;
    const reordered = items.map((item, i) => ({ ...item, order: i + 1 }));
    setCategories(reordered);
    triggerBackendD1Sync(reordered, cards);
    updateStatus("SEQUENCE MODIFICATION APPLIED");
  };

  // ----------------------------------------------------
  // 6. DB Operations: Add, Edit, Delete
  // ----------------------------------------------------
  const handleAddNewCard = () => {
    const titlePrompt = prompt("请输入新知识点标题 (Enter Title for this Intel block):");
    if (!titlePrompt || titlePrompt.trim().length === 0) return;

    const targetCategory = categories.find(c => c.slug === selectedCategorySlug);
    const label = targetCategory ? targetCategory.label : "一般类别";

    const newCard: Card = {
      id: `custom-card-${Date.now()}`,
      slug: selectedCategorySlug,
      category: label,
      title: titlePrompt.trim(),
      content: `<p>这是全新添加的知识点 <strong>${titlePrompt}</strong>。</p><p>双击此处任何一个编辑键，注入你在赛博大千中检索到的代码真相。</p>`,
      order: filteredCards.length + 1,
      updatedAt: new Date().toISOString()
    };

    const nextCards = [...cards, newCard];
    setCards(nextCards);
    setActiveCardIndex(filteredCards.length); // point instantly to next setup
    triggerBackendD1Sync(categories, nextCards);
    updateStatus(`DYNAMIC COMPILER: SUCCESS. NODE ${newCard.id} GENERATED.`);
  };

  const handleDeleteCard = (cardId: string) => {
    if (window.confirm("确定要删除这块绝密的知识数据节点吗？")) {
      const nextCards = cards.filter(c => c.id !== cardId);
      setCards(nextCards);
      
      // Auto reposition index safely
      if (activeCardIndex >= Math.max(1, filteredCards.length - 1)) {
        setActiveCardIndex(Math.max(0, filteredCards.length - 2));
      }
      
      triggerBackendD1Sync(categories, nextCards);
      updateStatus(`PURGE PROTOCOL: REALLOCATING SECTORS. NODE ${cardId} EXPUNGED.`);
    }
  };

  const handleOpenEditModal = (card: Card) => {
    setModalCardId(card.id);
    setEditTitle(card.title);
    setEditContent(card.content);
    setEditCategoryLabel(card.category);
    setIsEditModalOpen(true);
    updateStatus(`ENGAGING LOCAL COMPILER EDITOR FOR NODE #${card.id}`);
  };

  const handleSaveEditedCard = () => {
    if (!modalCardId) return;
    
    const updatedCards = cards.map(c => {
      if (c.id === modalCardId) {
        return {
          ...c,
          title: editTitle,
          content: editContent,
          category: editCategoryLabel,
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    });

    setCards(updatedCards);
    setIsEditModalOpen(false);
    triggerBackendD1Sync(categories, updatedCards);
    updateStatus(`DB COMPLIED SECURELY: SAVED NODE #${modalCardId}`);
  };

  const handleInlineRenameCard = (cardId: string, newTitle: string) => {
    if (!newTitle || newTitle.trim().length === 0) return;
    const updatedCards = cards.map(c => {
      if (c.id === cardId) {
        return { ...c, title: newTitle, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    setCards(updatedCards);
    triggerBackendD1Sync(categories, updatedCards);
  };

  return (
    <div className="h-screen bg-cyber-black text-slate-100 font-sans relative overflow-hidden select-none">
      {/* 1. Background Matrix Animation Layer */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-60 z-0" />

      {/* Main Container */}
      <div className="relative z-10 h-screen flex flex-col max-w-[1360px] mx-auto border-l border-r border-[#00ffff]/20 bg-black/75 backdrop-blur-md shadow-2xl">
        
        {/* ==================================================== */}
        {/* HEADER AREA */}
        {/* ==================================================== */}
        <header className="h-12 sm:h-12 flex items-center justify-between px-3 sm:px-4 border-b border-[#00ffff]/30 bg-black/90 z-20 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-cyber-cyan shadow-[0_0_12px_#00ffff] animate-pulse rounded-sm"></div>
            <h1 className="text-xs xs:text-sm sm:text-base md:text-xl font-display font-extrabold tracking-wider sm:tracking-widest text-[#ffffff] flex items-center gap-1.5 sm:gap-3">
              <span className="hidden xs:inline">CYBER INTERVIEW</span>
              <span className="xs:hidden">CYBER</span>
              <span className="text-[10px] sm:text-xs bg-cyber-cyan text-black px-1 sm:px-1.5 leading-none py-0.5 sm:py-1 font-mono font-bold tracking-normal rounded-sm">面经笔记</span>
            </h1>
          </div>

          {/* Rewards badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto mr-2 sm:mr-0">
            <div className={`text-xs sm:text-sm ${LEVELS[rewards.level - 1]?.color || 'text-cyber-cyan'}`} title={`Lv.${rewards.level} ${LEVELS[rewards.level - 1]?.name || ''}`}>
              {LEVELS[rewards.level - 1]?.icon || '🌱'}
            </div>
            <div className="hidden sm:flex flex-col items-start min-w-[60px]">
              <div className="text-[8px] font-mono text-[#00ffff]/60 uppercase tracking-wider leading-tight">Lv.{rewards.level}</div>
              <div className="w-full h-1 bg-[#00ffff]/10 rounded-full overflow-hidden mt-0.5">
                {(() => {
                  const prog = xpProgress(rewards.xp);
                  return <div className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-green rounded-full" style={{ width: `${prog.progress * 100}%` }} />;
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {currentView === "dashboard" && activeCard && (
              <div className="hidden lg:flex flex-col items-end">
                <span className="text-[9px] text-cyber-green uppercase tracking-widest font-mono">CURRENT CORE FIELD</span>
                <span className="text-xs text-white font-mono font-semibold">{activeCard.category} / {activeCard.slug.toUpperCase()}</span>
              </div>
            )}

            {/* Custom Glowing Countdown module */}
            {currentView === "dashboard" && (
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div 
                  className={`border border-cyber-cyan bg-cyber-cyan/10 px-2 sm:px-3 py-1 flex items-center gap-1 sm:gap-2 shadow-[0_0_12px_rgba(0,255,255,0.2)] rounded-sm cursor-pointer transition-all hover:bg-cyber-cyan/20`}
                  onClick={() => setIsTimerPaused(!isTimerPaused)}
                  title={isTimerPaused ? "点击继续计时" : "点击暂停计时"}
                >
                  <Clock className={`w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-cyber-cyan ${isTimerPaused ? "" : "animate-spin"}`} style={{ animationDuration: "14s" }} />
                  <span className="text-[9px] sm:text-[10px] text-cyber-cyan font-mono tracking-tighter shrink-0 hidden sm:inline">{recallMode === "recall" ? "RECALL" : "NEXT"}</span>
                  <span className="text-sm sm:text-lg font-mono font-black text-white shrink-0">
                    {timerCount < 10 ? `0${timerCount}` : timerCount}s
                  </span>
                </div>
              </div>
            )}

            {currentView === "dashboard" ? (
              <button 
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsPlayingTTS(false);
                  setCurrentView("hub");
                }}
                className="px-2.5 sm:px-4 py-1 sm:py-1.5 border border-[#00ffff]/45 text-[10px] sm:text-xs text-cyber-cyan font-mono uppercase hover:bg-cyber-cyan/15 hover:shadow-[0_0_12px_rgba(0,255,255,0.4)] transition-all cursor-pointer rounded-sm"
              >
                <span className="hidden sm:inline">&lt;&lt; BACK TO HUB_</span>
                <span className="sm:hidden">&lt;&lt; HUB</span>
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setIsSortingMode(!isSortingMode)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 border text-[10px] sm:text-xs font-mono uppercase cursor-pointer rounded-sm transition-all flex items-center gap-1 sm:gap-1.5 ${isSortingMode ? "bg-[#ff0055]/20 text-[#ff0055] border-[#ff0055]" : "border-[#00ffff]/30 text-cyber-cyan hover:bg-[#00ffff]/10"}`}
                >
                  <ArrowUpDown className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  {isSortingMode ? "退出" : "排序"}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Interactive Progress Bar if details view */}
        {currentView === "dashboard" && (
          <div className="h-1 w-full bg-cyber-gray-dark relative overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r from-cyber-cyan to-cyber-green transition-all duration-1000 ${isTimerPaused ? "" : "animate-pulse"}`}
              style={{ width: `${(timerCount / 30) * 100}%` }}
            ></div>
          </div>
        )}

        {/* ==================================================== */}
        {/* HOMEPAGE / RECOGNITION HUB VIEW */}
        {/* ==================================================== */}
        {currentView === "hub" && (
          <main className="flex-1 p-4 md:p-8 flex flex-col gap-6">
            
            {/* Cyberpunk Interactive Control Console Deck */}
            <div className="p-4 bg-cyber-gray-dark border border-cyber-cyan/25 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_15px_rgba(0,255,255,0.06)] relative overflow-hidden backdrop-blur-md rounded-sm">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyber-cyan"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyber-cyan"></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyber-cyan"></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyber-cyan"></div>
              
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-cyber-cyan" />
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-white tracking-widest font-display">MAIN SCHEME CONTROLLER</span>
                  <span className="text-[10px] text-cyber-cyan font-mono">{statusText}</span>
                </div>
              </div>

              {/* Action commands row */}
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={handlePullFromGithub}
                  className="px-3 py-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 rounded-sm"
                  title="从 GitHub 仓库拉取远程数据库最新排序"
                >
                  <Download className="w-3.5 h-3.5" />
                  从 GitHub 拉取排序
                </button>
                <button 
                  onClick={handleSaveToGithub}
                  className="px-3 py-1.5 bg-cyber-cyan/15 hover:bg-cyber-cyan animate-pulse hover:text-black hover:shadow-[0_0_15px_#00ffff] text-cyber-cyan border border-cyber-cyan text-[11px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 rounded-sm"
                  title="保存当前自定义卡片及排序状态至云端GitHub"
                >
                  <Save className="w-3.5 h-3.5" />
                  保存排序到 GitHub
                </button>
                <button 
                  onClick={handleRestoreDefaultSort}
                  className="px-3 py-1.5 bg-[#ff0055]/10 hover:bg-[#ff0055]/30 text-[#ff0055] border border-[#ff0055]/40 text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all rounded-sm"
                  title="恢复云端最原始种子排序数据"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  恢复默认排序
                </button>
              </div>
            </div>

            {/* Instruction Callout block */}
            <div className="p-4 border border-dashed border-cyber-cyan/30 bg-cyber-cyan/5 text-xs text-cyber-cyan/85 space-y-1 font-mono leading-relaxed rounded-sm">
              <span className="font-bold block tracking-wider text-white">⚡ 赛博面试复习指南（CYBER RETRIEVAL PROTOCOL）:</span>
              <p>1. 点击下方任何分类卡片，将会被载入专属的 <strong>“Technical Dashboard / 30秒回忆卡片器”</strong> 深度复习链路。</p>
              <p>2. 当前支持 <span className="text-white">【进入排序】</span> 控制钮：在卡片边缘上下长按或拖动即可实现布局重新编码。全部修改均会实现数据库本地与云端双端保存。</p>
            </div>

            {/* 10 Categories Accordion/Container blocks */}
            {categories.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#00ffff]/40 font-mono">
                <RefreshCw className="w-10 h-10 animate-spin mb-4" />
                <span>CONNECTING CYBER STATIONS... PLEASE STAND BY</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {categories.map((cat, index) => {
                  const cardCount = cards.filter(c => c.slug === cat.slug).length;
                  return (
                    <div 
                      key={cat.id}
                      draggable={isSortingMode}
                      onDragStart={(e) => handleCatDragStart(e, cat.id)}
                      onDragOver={(e) => handleCatDragOver(e, cat.id)}
                      onDragEnd={handleCatDragEnd}
                      className={`group border bg-cyber-gray-dark/95 backdrop-blur-md relative overflow-hidden transition-all duration-300 rounded-sm flex flex-col ${
                        isSortingMode 
                          ? "border-[#ff0055]/40 cursor-grab active:cursor-grabbing hover:border-[#ff0055] hover:shadow-[0_0_15px_rgba(255,0,85,0.15)]" 
                          : "border-[#00ffff]/20 hover:border-[#00ffff]/65 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]"
                      }`}
                    >
                      {/* Decorative glowing edge tag */}
                      <div className={`absolute top-0 right-0 py-0.5 px-3 text-[9px] font-mono tracking-widest font-black uppercase rounded-bl-sm ${
                        cat.label === "计算机基础" ? "bg-cyan-900 border-l border-b border-cyber-cyan text-cyber-cyan" :
                        cat.label === "数据库" ? "bg-amber-950 border-l border-b border-amber-400 text-amber-400" :
                        cat.label === "代码设计" ? "bg-emerald-950 border-l border-b border-emerald-400 text-emerald-400" :
                        cat.label === "架构设计" ? "bg-indigo-950 border-l border-b border-indigo-400 text-indigo-400" :
                        "bg-purple-950 border-l border-b border-purple-400 text-purple-400"
                      }`}>
                        {cat.label}
                      </div>

                      {/* Header Info */}
                      <div className="p-5 flex-1 flex flex-col justify-between min-h-[140px]">
                        <div>
                          <div className="flex items-center gap-1 text-[10px] text-cyber-cyan font-mono font-medium mb-1 tracking-wider">
                            <span>REGISTRY INDEX:</span>
                            <span className="font-bold">[{String(cat.order).padStart(2, "0")}]</span>
                            {isSortingMode && (
                              <span className="text-[#ff0055] blink ml-2">● SORTDRAG ACTIVE</span>
                            )}
                          </div>

                          <h3 
                            className="text-2xl font-display font-extrabold text-white tracking-wide group-hover:text-cyber-cyan transition-colors"
                            style={{ textShadow: "0 0 5px rgba(255,255,255,0.05)" }}
                          >
                            {cat.title}
                          </h3>

                          {/* Extra meta tags */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className="text-[10px] px-2 py-0.5 border border-[#00ffff]/20 bg-cyber-cyan/5 font-mono text-slate-300">
                              MODULE: {cat.slug.toUpperCase()}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 border border-dashed border-[#00ffcc]/20 bg-cyber-green/5 font-mono text-cyber-green">
                              INTEL: {cardCount} BLOCKS
                            </span>
                          </div>
                        </div>

                        {/* Interactive triggers */}
                        <div className="mt-4 flex items-center justify-between border-t border-[#00ffff]/10 pt-3">
                          {isSortingMode ? (
                            <div className="flex gap-2 w-full justify-between items-center">
                              <span className="text-[11px] font-mono text-[#ff0055]">🖱️ 拖拽此卡排序或使用按键:</span>
                              <div className="flex gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveCatUp(index); }}
                                  className="p-1 px-2 border border-[#ff0055]/30 text-[#ff0055] text-xs hover:bg-[#ff0055]/20 cursor-pointer"
                                >
                                  ▲
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveCatDown(index); }}
                                  className="p-1 px-2 border border-[#ff0055]/30 text-[#ff0055] text-xs hover:bg-[#ff0055]/20 cursor-pointer"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="text-[11px] font-mono text-[#00ffcc]/70 group-hover:text-cyber-green transition-colors">
                                RETREIVE INTERVIEW PIPELINE _
                              </span>
                              <button 
                                onClick={() => {
                                  setSelectedCategorySlug(cat.slug);
                                  setActiveCardIndex(0);
                                  setCurrentView("dashboard");
                                  updateStatus(`LOADED CATEGORY MODULE: ${cat.title}`);
                                }}
                                className="flex items-center gap-1 px-3 py-1 border border-cyber-cyan bg-cyber-cyan/15 group-hover:bg-cyber-cyan text-black font-semibold text-xs transition-all shadow-[0_0_8px_rgba(0,255,255,0.2)] group-hover:shadow-[0_0_15px_#00ffff] cursor-pointer rounded-sm"
                              >
                                ENTER STAGE
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* =============================== */}
            {/* ACHIEVEMENTS / REWARDS PANEL */}
            {/* =============================== */}
            <div className="p-4 bg-cyber-gray-dark/80 border border-[#00ffff]/15 rounded-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyber-cyan"></div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyber-cyan"></div>
              
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-cyber-cyan" />
                <span className="text-[10px] font-mono text-cyber-cyan uppercase tracking-widest font-bold">
                  ACHIEVEMENT SYSTEM / 成就系统
                </span>
              </div>

              {/* Current level + XP bar */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-2xl ${LEVELS[rewards.level - 1]?.color || 'text-cyber-cyan'}`}>
                  {LEVELS[rewards.level - 1]?.icon || '🌱'}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-white font-bold">Lv.{rewards.level} {LEVELS[rewards.level - 1]?.name}</span>
                    <span className="text-cyber-cyan">
                      {(() => { const p = xpProgress(rewards.xp); return `${p.current} / ${p.required} XP`; })()}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#00ffff]/10 rounded-full overflow-hidden mt-1">
                    {(() => { const p = xpProgress(rewards.xp); return (
                      <div className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-green rounded-full transition-all duration-500" style={{ width: `${p.progress * 100}%` }} />
                    ); })()}
                  </div>
                  <div className="text-[8px] font-mono text-[#00ffff]/40 mt-0.5">
                    {(() => { const n = getNextLevel(rewards.xp); return n ? `下一级：Lv.${n.level} ${n.name}` : '已达满级！'; })()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono text-white font-bold">{rewards.xp}</div>
                  <div className="text-[8px] font-mono text-[#00ffff]/50">总经验值</div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/40 border border-[#00ffff]/10 p-2 rounded-sm">
                  <div className="text-xs font-mono text-cyber-cyan font-bold">{rewards.cardCycles || 0}</div>
                  <div className="text-[8px] font-mono text-[#00ffff]/50">已完成卡片周期</div>
                </div>
                <div className="bg-black/40 border border-[#00ffff]/10 p-2 rounded-sm">
                  <div className="text-xs font-mono text-cyber-cyan font-bold">{rewards.ttsMinutes || 0}</div>
                  <div className="text-[8px] font-mono text-[#00ffff]/50">TTS 朗读分钟</div>
                </div>
                <div className="bg-black/40 border border-[#00ffff]/10 p-2 rounded-sm">
                  <div className="text-xs font-mono text-cyber-cyan font-bold">{rewards.completedCategories.length} / {categories.length}</div>
                  <div className="text-[8px] font-mono text-[#00ffff]/50">已通关分类</div>
                </div>
              </div>

              {/* Level badges row */}
              <div className="flex items-center gap-1 mt-2 overflow-x-auto py-1">
                {LEVELS.map((lv, i) => {
                  const unlocked = rewards.level >= lv.level;
                  return (
                    <div key={lv.level} className={`flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-mono rounded-sm shrink-0 ${unlocked ? 'border-cyber-cyan/30 bg-cyber-cyan/10 text-white' : 'border-white/5 bg-black/40 text-slate-600'}`}>
                      <span>{lv.icon}</span>
                      <span className={unlocked ? lv.color : ''}>Lv.{lv.level}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        )}

        {/* ==================================================== */}
        {/* DETAIL VIEW / SPECIALIST TECHNICAL DASHBOARD */}
        {/* ==================================================== */}
        {currentView === "dashboard" && (
          <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
            
            {/* Mobile Sidebar backdrop overlay */}
            {isMobileSidebarOpen && (
              <div 
                className="md:hidden fixed inset-0 z-30 bg-black/75 backdrop-blur-sm"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            )}

            {/* LEFT SIDEBAR: Topic Cards registry navigator */}
            <aside className={`w-full md:w-80 border-r border-[#00ffff]/20 bg-black/95 md:bg-black/85 backdrop-blur-md flex flex-col min-h-0 ${isMobileSidebarOpen ? "fixed top-12 bottom-0 left-0 z-40" : "hidden md:flex"} transition-all`}>
              
              {/* Category selector panel */}
              <div className="p-4 border-b border-[#00ffff]/20 bg-gradient-to-r from-cyan-950/20 to-black">
                <span className="text-[9px] tracking-widest text-[#00ffff]/50 font-mono font-bold block mb-1">SELECTED FIELD INTERVIEW REGISTRY</span>
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-display font-extrabold text-[#00ffff]">
                    {categories.find(c => c.slug === selectedCategorySlug)?.title || "全部大纲"} ({filteredCards.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#00ffff] font-mono hidden sm:inline">ID: {selectedCategorySlug.toUpperCase().slice(0, 8)}</span>
                    <button 
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="md:hidden p-1.5 border border-[#ff0055]/40 text-[#ff0055] hover:bg-[#ff0055]/10 rounded-sm active:scale-95 transition-all cursor-pointer"
                      title="关闭大纲列表"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Cards index selector (Interactive Draggable navigation items) */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                {filteredCards.length === 0 ? (
                  <div className="p-4 text-center text-xs text-cyber-cyan/40 font-mono">
                    [NO DATA BLOCKS DETECTED]
                  </div>
                ) : (
                  filteredCards.map((card, idx) => {
                    const isSelected = idx === activeCardIndex;
                    return (
                      <div 
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleCardDragStart(e, card.id)}
                        onDragOver={(e) => handleCardDragOver(e, card.id)}
                        onDragEnd={handleCardDragEnd}
                        onClick={() => {
                          setActiveCardIndex(idx);
                          setCurrentParagraphIndex(0);
                          setIsMobileSidebarOpen(false);
                          updateStatus(`SELECTED CORRELATION CHIP INDEX: #${idx + 1}`);
                        }}
                        className={`p-3 text-xs border text-left cursor-pointer transition-all dynamic-hover relative group/card rounded-sm ${
                          isSelected 
                            ? "bg-cyber-cyan/15 border-cyber-cyan text-white shadow-[0_0_12px_rgba(0,255,255,0.15)]" 
                            : "bg-black/30 border-[#00ffff]/15 text-[#00ffff]/70 hover:bg-[#00ffff]/5 hover:border-[#00ffff]/40"
                        }`}
                      >
                        {/* Drag and drop cyber dots handle */}
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <span className="text-[8px] border border-cyber-cyan/30 text-cyber-cyan/60 px-1 font-mono font-bold scale-90">DRAG ☰</span>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <span className={`${isSelected ? "text-cyber-green font-bold" : "text-slate-400"} font-mono text-[9px]`}>
                            NODE_[{String(idx + 1).padStart(2, "0")}]
                          </span>
                          <span className="text-[8px] opacity-40 uppercase tracking-widest font-mono">ORDER: {card.order}</span>
                        </div>
                        <p className="font-medium line-clamp-2 leading-relaxed group-hover/card:text-white transition-colors">
                          {card.title}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sidebar Action controllers */}
              <div className="p-4 border-t border-[#00ffff]/20 bg-black/90 space-y-2">
                <button 
                  onClick={handleAddNewCard}
                  className="w-full py-2 bg-cyber-green/10 hover:bg-cyber-green hover:text-black border border-cyber-green/50 text-[11px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-1 px-3 cursor-pointer transition-all active:scale-95 rounded-sm"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  添加新知识节点 +
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveToGithub}
                    className="flex-1 py-1 px-2 border border-cyber-cyan/35 text-[9px] hover:bg-cyber-cyan/10 hover:text-white font-mono uppercase tracking-tighter cursor-pointer rounded-sm"
                  >
                    SYNC REMOTE
                  </button>
                  <button 
                    onClick={() => {
                      if(activeCard) {
                        handleOpenEditModal(activeCard);
                      }
                    }}
                    className="flex-1 py-1 px-2 border border-[#00ffcc]/35 text-[9px] hover:bg-[#00ffcc]/10 text-cyber-green font-mono uppercase tracking-tighter cursor-pointer rounded-sm"
                  >
                    EDIT SCHEMA
                  </button>
                </div>
              </div>
            </aside>

            {/* MAIN CENTRAL WORKSPACE: Knowledge Card Content and memory helper */}
            <section className="flex-1 min-h-0 flex flex-col relative bg-gradient-to-br from-black via-[#000d0d] to-black overflow-hidden">
              
              {/* Corner decoratives */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t border-l border-[#00ffff]/30 pointer-events-none z-10"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-[#00ffff]/30 pointer-events-none z-10"></div>

              {/* Scrollable content area - compact */}
              <div className="flex-1 overflow-y-auto px-3 md:px-5 pt-2 md:pt-3 pb-0">
                {/* Mobile sidebar toggle */}
                <div className="md:hidden flex items-center justify-between bg-black/80 border border-[#00ffff]/20 px-2 py-1 mb-2 rounded-sm">
                  <button onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} className="flex items-center gap-1 text-[11px] text-cyber-cyan font-mono uppercase border border-cyber-cyan/30 px-2 py-0.5 rounded-sm">
                    <Menu className="w-3.5 h-3.5" />
                    {isMobileSidebarOpen ? "CLOSE" : "INDEX"}
                  </button>
                  <span className="text-[11px] text-slate-300 font-mono">{activeCardIndex + 1} / {filteredCards.length}</span>
                </div>

                {activeCard ? (
                  <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full relative z-10 min-h-full">

                    {/* Category badge + title */}
                    <div className="space-y-0.5 shrink-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-[9px] px-2 py-0.5 border border-cyber-cyan bg-cyber-cyan/15 text-cyber-cyan font-mono uppercase rounded-sm">{activeCard.category}</span>
                        <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">NODE: [{activeCard.id.slice(0, 10)}]</span>
                        <span className="text-[9px] text-cyber-green font-mono tracking-widest uppercase ml-auto">VERIFIED</span>
                      </div>
                      <h2 className="text-base md:text-lg font-display font-black tracking-tight text-white">{activeCard.title}</h2>
                    </div>

                    {/* Reveal status banner */}
                    <div className="flex items-center justify-between px-2 py-1 bg-[#00ffff]/5 border border-[#00ffff]/25 text-[11px] text-cyber-cyan font-mono rounded-sm shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isRevealed ? "bg-cyber-green shadow-[0_0_6px_#00ffcc]" : "bg-[#ff0055] animate-ping"}`}></div>
                        <span>{isRevealed ? "🛡️ 已解密" : "🔒 遮罩回忆中 - 30s 后自动解密"}</span>
                      </div>
                      <button onClick={toggleReveal} className="px-2 py-0.5 border border-cyber-cyan/40 hover:bg-cyber-cyan/15 text-[10px] uppercase cursor-pointer">{isRevealed ? "遮罩" : "解密"}</button>
                    </div>

                    {/* Content card - fills remaining space */}
                    <div className="flex-1 min-h-0 bg-black/60 border border-[#00ffff]/15 p-3 md:p-3 relative overflow-hidden rounded-sm">
                      <div className="absolute top-2 right-2 flex gap-1.5 z-20">
                        <button onClick={() => handleOpenEditModal(activeCard)} className="p-1 px-1.5 border border-[#00ffff]/30 bg-black/80 text-[9px] text-cyber-cyan hover:bg-[#00ffff]/20 font-mono flex items-center gap-1 cursor-pointer transition-all rounded-sm"><Edit className="w-3 h-3" /> MODIFY</button>
                        <button onClick={() => handleDeleteCard(activeCard.id)} className="p-1 px-1.5 border border-[#ff0055]/30 bg-black/80 text-[9px] text-[#ff0055] hover:bg-[#ff0055]/15 font-mono flex items-center gap-1 cursor-pointer transition-all rounded-sm"><Trash2 className="w-3 h-3" /> DELETE</button>
                      </div>

                      {!isRevealed ? (
                        <div className="flex flex-col items-center justify-center py-3 text-center text-cyber-cyan/50 font-mono space-y-2 h-full">
                          <Cpu className="w-8 h-8 text-cyber-cyan animate-pulse" />
                          <p className="text-xs">30 秒内自行回忆本题要点</p>
                          <div className="text-3xl font-black text-cyber-cyan tracking-wider bg-[#00ffff]/5 border border-cyber-cyan/20 px-6 py-1.5 rounded-sm">00:{timerCount < 10 ? `0${timerCount}` : timerCount}</div>
                          <button onClick={toggleReveal} className="px-4 py-1 bg-cyber-cyan text-black text-xs font-black uppercase shadow-[0_0_12px_rgba(0,255,255,0.3)] hover:shadow-[0_0_20px_#00ffff] transition-all cursor-pointer rounded-sm">立即解锁</button>
                        </div>
                      ) : (
                        <div ref={textContainerRef} className="absolute inset-0 overflow-y-auto p-3">
                          <div className="markdown-body text-[#e2e8f0]/95 space-y-1 font-mono select-text text-sm md:text-[14px]">
                            {activeParagraphs.map((block, idx) => (
                              <div key={idx} id={`p-block-${idx}`}
                                onClick={() => { setCurrentParagraphIndex(idx); if (isPlayingTTS) speakActiveParagraph(); }}
                                className={`p-2 transition-all duration-300 rounded-sm cursor-pointer ${idx === currentParagraphIndex && isPlayingTTS ? "bg-cyber-cyan/15 border-l-4 border-cyber-cyan text-white" : "border-l-4 border-transparent hover:bg-white/5"}`}
                                dangerouslySetInnerHTML={{ __html: block }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-[#00ffff]/40 font-mono">
                    <span>WARNING: NO KNOWLEDGE CARD SELECTED ON ACTIVE CHANNEL.</span>
                  </div>
                )}
              </div>

              {/* Fixed bottom: TTS player + navigation */}
            {/* Fixed bottom: TTS player + navigation */}
            {activeCard && (
            <div className="shrink-0 bg-black/95 border-t border-[#00ffff]/20 px-3 py-1">
              <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-1 max-w-4xl mx-auto">
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleToggleTTS}
                    className={`relative w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-sm border-2 shrink-0 ${
                      isPlayingTTS ? "bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta shadow-[0_0_15px_#ff0055]" : "bg-black border-cyber-cyan hover:bg-cyber-cyan/15 text-cyber-cyan hover:shadow-[0_0_12px_#00ffff]"
                    }`}
                    title={isPlayingTTS ? "暂停" : "朗读"}>
                    {isPlayingTTS ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <div className="text-left leading-tight">
                    <span className={`text-[8px] font-mono tracking-widest uppercase ${isPlayingTTS ? 'text-cyber-magenta' : 'text-slate-400'}`}>
                      {isPlayingTTS ? '▶ TTS' : '⏸ 就绪'}
                    </span>
                    <div className="text-[8px] font-mono text-cyber-cyan">
                      [{currentParagraphIndex + 1}/{activeParagraphs.length}]
                    </div>
                  </div>
                </div>

                {/* Segment bar */}
                <div className="flex-1 flex items-center gap-0.5 overflow-x-auto py-0.5">
                  {activeParagraphs.map((_, i) => (
                    <button key={i} onClick={() => { setCurrentParagraphIndex(i); if (isPlayingTTS) speakActiveParagraph(); }}
                      className={`flex-1 min-w-[10px] h-2 border rounded-sm cursor-pointer transition-all ${
                        i === currentParagraphIndex ? "bg-cyber-cyan border-cyber-cyan shadow-[0_0_6px_#00ffff]" :
                        i < currentParagraphIndex ? "bg-cyber-cyan/40 border-cyber-cyan/30" : "bg-[#00ffff]/5 border-[#00ffff]/15 hover:bg-[#00ffff]/20"
                      }`} />
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={handlePrevBlock} className="p-0.5 border border-white/10 text-[#00ffff]/60 hover:text-cyber-cyan hover:bg-[#00ffff]/10 cursor-pointer rounded-sm"><SkipBack className="w-3 h-3" /></button>
                  <button onClick={handleNextBlock} className="p-0.5 border border-white/10 text-[#00ffff]/60 hover:text-cyber-cyan hover:bg-[#00ffff]/10 cursor-pointer rounded-sm"><SkipForward className="w-3 h-3" /></button>
                  <div className="w-px h-3 bg-white/15 mx-0.5"></div>
                  <button onClick={handlePrevCard} className="px-1.5 py-0.5 border border-cyber-cyan/45 bg-black text-[8px] font-mono text-cyber-cyan hover:bg-cyber-cyan/15 transition-all cursor-pointer rounded-sm uppercase"><ChevronLeft className="w-2.5 h-2.5 inline" /> 上</button>
                  <button onClick={handleNextCard} className="px-2 py-0.5 bg-cyber-cyan hover:bg-[#00ffff] text-black font-bold text-[8px] font-mono uppercase tracking-wider shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-all cursor-pointer rounded-sm flex items-center gap-0.5">下 <ChevronRight className="w-2.5 h-2.5" /></button>
                </div>
              </div>
            </div>
            )}
            </section>

          </main>
        )}

        {/* ==================================================== */}
        {/* EDIT & RICH COMPILER POPUP MODAL */}
        {/* ==================================================== */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-md">
            <div className="w-full max-w-3xl max-h-[94vh] md:max-h-[90vh] bg-cyber-gray-dark border-2 border-cyber-cyan shadow-[0_0_35px_rgba(0,255,255,0.25)] relative overflow-hidden rounded-sm flex flex-col">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyber-cyan"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyber-cyan"></div>

              {/* Modal header banner */}
              <div className="p-3.5 border-b border-cyber-cyan/35 flex items-center justify-between bg-cyber-cyan/5">
                <div className="flex items-center gap-2">
                  <Terminal className="text-cyber-cyan w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                  <span className="text-[10px] sm:text-xs font-mono font-black text-cyber-cyan tracking-wider uppercase">
                    CYBER EDITOR SCHEMA MODULE COMPILER
                  </span>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1 border border-cyber-cyan/30 text-cyber-cyan hover:bg-[#ff0055]/20 hover:text-[#ff0055] hover:border-[#ff0055] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form inputs code theme */}
              <div className="p-4 sm:p-6 space-y-4 font-mono overflow-y-auto flex-1">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title block */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] text-cyber-cyan uppercase font-bold tracking-widest">
                      [1] 节点标题 (Node Title)
                    </label>
                    <input 
                      type="text" 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-black border border-cyber-cyan/40 p-2.5 text-white text-xs md:text-sm focus:border-cyber-cyan focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,255,0.25)] placeholder-cyber-cyan/30"
                      placeholder="插入节点主题名称..."
                    />
                  </div>

                  {/* Category Field block */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] text-cyber-cyan uppercase font-bold tracking-widest">
                      [2] 分类标签 (Category Label)
                    </label>
                    <input 
                      type="text" 
                      value={editCategoryLabel}
                      onChange={(e) => setEditCategoryLabel(e.target.value)}
                      className="w-full bg-black border border-cyber-cyan/40 p-2.5 text-white text-xs md:text-sm focus:border-cyber-cyan focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,255,0.25)] placeholder-cyber-cyan/30"
                      placeholder="例如：计算机基础、数据库、系统设计"
                    />
                  </div>
                </div>

                {/* Content description (HTML rich style raw) */}
                <div className="space-y-1.5 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-cyber-cyan uppercase font-bold tracking-widest">
                      [3] 正文 HTML 源代码内容 (HTML Core Document Content Payload)
                    </label>
                    <span className="text-[9px] text-[#00ffcc] opacity-70">支持 HTML 标签格式</span>
                  </div>
                  
                  <textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-44 sm:h-60 md:h-64 bg-black border border-cyber-cyan/45 p-3 text-xs text-cyber-green/90 font-mono focus:border-cyber-cyan focus:outline-none focus:shadow-[0_0_12px_rgba(0,255,255,0.15)] placeholder-cyber-green/20 resize-none"
                    placeholder="请输入富格式 HTML 内容，如: <p>文本</p> <ul><li>列表项</li></ul> <pre><code>代码</code></pre>"
                  />
                </div>

                <div className="border border-dashed border-[#ff0055]/30 p-2.5 bg-[#ff0055]/5 text-[10px] text-slate-300 rounded-sm">
                  <span className="text-[#ff0055] font-bold block">🚨 FORMAT VALIDATION BOUNDARIES:</span>
                  为确保语音合成引擎 (TTS) 在朗读时可进行口语化代码优化，请尽量保持 HTML 的结构紧凑整洁。
                </div>

              </div>

              {/* Modal controls */}
              <div className="p-4 border-t border-cyber-cyan/30 bg-black flex flex-col sm:flex-row justify-end gap-2.5 z-10 sticky bottom-0">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-[#ff0055]/40 text-[#ff0055] text-xs hover:bg-[#ff0055]/15 cursor-pointer uppercase rounded-sm"
                >
                  ESC 取消 [ABORT]
                </button>
                <button 
                  onClick={handleSaveEditedCard}
                  className="w-full sm:w-auto px-6 py-2 bg-cyber-cyan text-black font-extrabold text-xs hover:shadow-[0_0_15px_#00ffff] hover:scale-105 active:scale-95 transition-all cursor-pointer uppercase rounded-sm flex items-center justify-center gap-1.5"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  保存写入数据库 [COMMIT]
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Level up celebration overlay */}
        {showLevelUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-black/90 border-2 border-cyber-cyan shadow-[0_0_40px_rgba(0,255,255,0.3)] px-8 py-6 rounded-sm text-center animate-bounce">
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-[11px] font-mono text-cyber-cyan uppercase tracking-widest mb-1">LEVEL UP!</div>
              <div className="text-lg font-display font-bold text-white">{LEVELS[rewards.level - 1]?.icon} Lv.{rewards.level}</div>
              <div className="text-sm font-mono text-cyber-cyan">{levelUpName}</div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* FOOTER METRICS SYSTEM STATUS */}
        {/* ==================================================== */}
        <footer className="h-6 border-t border-[#00ffff]/20 bg-black/90 flex items-center justify-between px-3 text-[8px] font-mono uppercase tracking-[0.18em] text-[#00ffff]/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse inline-block"></span>
            <span>SYSTEM STATUS: NORMAL</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>NEURAL INTERFACE LINK: ACTIVE STATUS</span>
            <span>LATENCY: {latency}ms</span>
          </div>
          <span>© 2026 CYBER INTERVIEW HUB PRO</span>
        </footer>

      </div>
    </div>
  );
}
