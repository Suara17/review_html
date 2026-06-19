import React, { useState, useEffect, useRef } from "react";
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
  RefreshCw
} from "lucide-react";

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
  const ttsSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

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
      const res = await fetch("/api/cards");
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
  useEffect(() => {
    // Clear existing intervals
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (currentView !== "dashboard" || !activeCard) return;

    // Reset countdown timer whenever Card changes
    setTimerCount(30);
    setIsRevealed(false);
    setRecallMode("recall");

    timerIntervalRef.current = setInterval(() => {
      if (isTimerPaused) return;

      setTimerCount(prev => {
        if (prev <= 1) {
          // Timer finished
          if (recallMode === "recall") {
            // Auto reveal content
            setIsRevealed(true);
            setRecallMode("cooldown");
            updateStatus("RECALL COOLDOWN COMMENCED - UNMASKING CODES");
            return 30; // Next countdown to auto advance
          } else {
            // Transition to Next Topic
            // Skip automated jump if TTS or Audio is actively reading
            if (isPlayingTTS) {
              updateStatus("TTS TRANSMISSION ACTIVE: POSTPONING AUTOMATED HOP");
              return 15; // Delay 15s to check again
            }
            handleNextCard();
            return 30;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [selectedCategorySlug, activeCardIndex, isTimerPaused, recallMode, currentView, isPlayingTTS]);

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

  useEffect(() => {
    // If paragraph shifts during playback
    if (isPlayingTTS) {
      speakActiveParagraph();
    }
  }, [currentParagraphIndex]);

  const speakActiveParagraph = () => {
    if (!window.speechSynthesis) {
      updateStatus("CRITICAL: TTS AUDIO NOT SUPPORTED IN HOST CONTAINER");
      return;
    }

    // Cancel dynamic synthesis first
    window.speechSynthesis.cancel();

    if (!activeCard || activeParagraphs.length === 0) return;

    const rawBlock = activeParagraphs[currentParagraphIndex];
    const cleanedText = cleanTalkText(rawBlock);

    // Call server API for timeline segment breakdown in background to sync screen display
    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanedText, segments: cleanedText.split(/([，。！？；\n]+)/).filter(Boolean).map((s, i) => ({ index: i, text: s })) })
    })
    .then(res => res.json())
    .then(data => {
      if (data.segments && data.segments.length > 0) {
        setTtsTimeline(data.segments);
      }
    })
    .catch(err => console.debug("Offline estimate timeline configured"));

    // Real synthesis player initialized on user container
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = "zh-CN";
    utterance.rate = voiceSpeed;
    
    utterance.onend = () => {
      // Auto trigger skip to subsequent block
      if (currentParagraphIndex < activeParagraphs.length - 1) {
        setCurrentParagraphIndex(prev => prev + 1);
      } else {
        setIsPlayingTTS(false);
        updateStatus("TRANSMISSION COMPLETE - TERMINATING SYNTH VOICE");
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesiser interrupted:", e);
    };

    ttsSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsRevealed(true); // force reveal content if they listen to voice

    // Ensure highlighted paragraph remains visible on active board
    setTimeout(() => {
      const activeEl = document.getElementById(`p-block-${currentParagraphIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  };

  const handleToggleTTS = () => {
    if (isPlayingTTS) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
      updateStatus("TTS DEACTIVATED");
    } else {
      setIsPlayingTTS(true);
      speakActiveParagraph();
      updateStatus(`TTS ACTIVATED SECURE CHANNEL (VOICE CHANNEL AT SPEED ${voiceSpeed}x)`);
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
      // Auto move down to Next card
      handleNextCard();
    }
  };

  const handleNextCard = () => {
    if (filteredCards.length === 0) return;
    const nextIdx = (activeCardIndex + 1) % filteredCards.length;
    setActiveCardIndex(nextIdx);
    setCurrentParagraphIndex(0);
    // Restart active sound if playing
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
      const res = await fetch("/api/cards/sync", {
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
        const res = await fetch("/api/cards", { method: "DELETE" });
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
      await fetch("/api/cards/sync", {
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
    <div className="min-h-screen bg-cyber-black text-slate-100 font-sans relative overflow-hidden select-none">
      {/* 1. Background Matrix Animation Layer */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-40 z-0" />

      {/* 2. Cyberpunk CRT Scanline overlay effect */}
      <div className="crt-overlay" />
      <div className="crt-scan" />

      {/* Main Container */}
      <div className="relative z-10 min-h-screen flex flex-col max-w-[1360px] mx-auto border-l border-r border-[#00ffff]/20 bg-black/75 backdrop-blur-md shadow-2xl">
        
        {/* ==================================================== */}
        {/* HEADER AREA */}
        {/* ==================================================== */}
        <header className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b border-[#00ffff]/30 bg-black/90 z-20 sticky top-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-cyber-cyan shadow-[0_0_12px_#00ffff] animate-pulse rounded-sm"></div>
            <h1 className="text-xs xs:text-sm sm:text-base md:text-xl font-display font-extrabold tracking-wider sm:tracking-widest text-[#ffffff] flex items-center gap-1.5 sm:gap-3">
              <span className="hidden xs:inline">CYBER INTERVIEW</span>
              <span className="xs:hidden">CYBER</span>
              <span className="text-[10px] sm:text-xs bg-cyber-cyan text-black px-1 sm:px-1.5 leading-none py-0.5 sm:py-1 font-mono font-bold tracking-normal rounded-sm">面经笔记</span>
            </h1>
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
          </main>
        )}

        {/* ==================================================== */}
        {/* DETAIL VIEW / SPECIALIST TECHNICAL DASHBOARD */}
        {/* ==================================================== */}
        {currentView === "dashboard" && (
          <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            
            {/* Mobile Sidebar backdrop overlay */}
            {isMobileSidebarOpen && (
              <div 
                className="md:hidden fixed inset-0 z-30 bg-black/75 backdrop-blur-sm"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            )}

            {/* LEFT SIDEBAR: Topic Cards registry navigator */}
            <aside className={`w-full md:w-80 border-r border-[#00ffff]/20 bg-black/95 md:bg-black/85 backdrop-blur-md flex flex-col ${isMobileSidebarOpen ? "fixed top-14 bottom-0 left-0 z-40" : "hidden md:flex"} transition-all`}>
              
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
            <section className="flex-1 flex flex-col p-4 md:p-8 relative bg-gradient-to-br from-black via-[#000d0d] to-black overflow-y-auto">
              
              {/* Corner decoratives */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t border-l border-[#00ffff]/30 pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-[#00ffff]/30 pointer-events-none"></div>

              {/* Mobile View Sidebar toggle handle */}
              <div className="md:hidden flex items-center justify-between bg-black/80 border border-[#00ffff]/20 p-2 mb-4 rounded-sm">
                <button 
                  onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                  className="flex items-center gap-2 text-xs text-cyber-cyan font-mono uppercase border border-cyber-cyan/30 px-3 py-1 rounded-sm"
                >
                  <Menu className="w-4 h-4" />
                  {isMobileSidebarOpen ? "CLOSE INDEX LIST" : "OPEN INDEX LIST_"}
                </button>
                <span className="text-xs text-slate-300 font-mono">
                  {activeCardIndex + 1} / {filteredCards.length}
                </span>
              </div>

              {activeCard ? (
                <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full relative z-10">
                  
                  {/* Category badging and index header */}
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2.5">
                      <span className="text-[10px] px-2 py-0.5 border border-cyber-cyan bg-cyber-cyan/15 text-cyber-cyan font-mono uppercase rounded-sm">
                        {activeCard.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                        NODE CHIP ID: CODE-[{activeCard.id.slice(0, 14)}]
                      </span>
                      <span className="text-[10px] text-cyber-green font-mono tracking-widest uppercase ml-auto">
                        VERIFIED SECURE
                      </span>
                    </div>

                    <h2 
                      className="text-2xl md:text-3xl font-display font-black tracking-tight text-white pt-2"
                      style={{ textShadow: "0 0 10px rgba(0,255,255,0.2)" }}
                    >
                      {activeCard.title}
                    </h2>
                  </div>

                  {/* 30s Cooldown State Alert Banner */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#00ffff]/5 border border-[#00ffff]/25 text-xs text-cyber-cyan font-mono rounded-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isRevealed ? "bg-cyber-green shadow-[0_0_6px_#00ffcc]" : "bg-[#ff0055] animate-ping"}`}></div>
                      <span>
                        {isRevealed 
                          ? "🛡️ 内容已完全解密运行中 (Decrypted mode)" 
                          : "🔒 状态：内容处于遮罩回忆态 (Recall state: mask applied)"}
                      </span>
                    </div>
                    <button 
                      onClick={toggleReveal}
                      className="px-3 py-0.5 border border-cyber-cyan/40 hover:bg-cyber-cyan/15 text-[11px] uppercase cursor-pointer"
                    >
                      {isRevealed ? "重置回忆遮盖 [LOCK]" : "手动提前解密 [DECRYPT]"}
                    </button>
                  </div>

                  {/* Glassy Core Document Node Display */}
                  <div className="flex-1 bg-black/60 border border-[#00ffff]/15 p-5 md:p-7 relative overflow-hidden group/board min-h-[300px] flex flex-col justify-between shadow-[inset_0_0_15px_rgba(0,255,255,0.03)] rounded-sm">
                    {/* Top action layout triggers */}
                    <div className="absolute top-3 right-3 flex gap-2 z-20">
                      <button 
                        onClick={() => handleOpenEditModal(activeCard)}
                        className="p-1 px-2 border border-[#00ffff]/30 bg-black/80 text-[10px] text-cyber-cyan hover:bg-[#00ffff]/20 hover:border-cyber-cyan font-mono flex items-center gap-1 cursor-pointer transition-all rounded-sm"
                        title="双击进入富自定义文本编辑器"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        MODIFY
                      </button>
                      <button 
                        onClick={() => handleDeleteCard(activeCard.id)}
                        className="p-1 px-2 border border-[#ff0055]/30 bg-black/80 text-[10px] text-[#ff0055] hover:bg-[#ff0055]/15 font-mono flex items-center gap-1 cursor-pointer transition-all rounded-sm"
                        title="删除该节点"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        DELETE
                      </button>
                    </div>

                    {/* Unmask / Mask rendering block */}
                    {!isRevealed ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-cyber-cyan/50 font-mono space-y-4">
                        <Cpu className="w-12 h-12 text-cyber-cyan animate-pulse" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-100 tracking-wider">🔒 DATA BLOCKS UNDER LOCK & KEY </p>
                          <p className="text-xs text-cyber-cyan/80">在 30 秒内自行默默回忆本题面经的底层解答。</p>
                        </div>
                        <div className="text-4xl font-black text-cyber-cyan tracking-wider blink bg-[#00ffff]/5 border border-cyber-cyan/20 px-8 py-3 rounded-sm">
                          00:{timerCount < 10 ? `0${timerCount}` : timerCount}
                        </div>
                        <button 
                          onClick={toggleReveal}
                          className="px-6 py-2 bg-cyber-cyan text-black text-xs font-black uppercase shadow-[0_0_12px_rgba(0,255,255,0.3)] hover:shadow-[0_0_20px_#00ffff] hover:scale-105 active:scale-95 transition-all cursor-pointer rounded-sm"
                        >
                          立即强制解锁芯片 (DECRYPT INTEGRITY_
                        </button>
                      </div>
                    ) : (
                      <div ref={textContainerRef} className="flex-1 overflow-y-auto pr-2">
                        <div className="markdown-body text-[#e2e8f0]/95 space-y-4 font-mono select-text mb-4 text-sm md:text-[15px]">
                          {activeParagraphs.map((block, idx) => {
                            const isCurrentBlock = idx === currentParagraphIndex && isPlayingTTS;
                            return (
                              <div 
                                key={idx}
                                id={`p-block-${idx}`}
                                onClick={() => {
                                  setCurrentParagraphIndex(idx);
                                  if (isPlayingTTS) {
                                    speakActiveParagraph();
                                  }
                                }}
                                className={`p-4 transition-all duration-300 rounded-sm cursor-pointer ${
                                  isCurrentBlock 
                                    ? "bg-cyber-cyan/15 border-l-4 border-cyber-cyan text-white shadow-[0_0_15px_rgba(0,255,255,0.1)] font-medium" 
                                    : "border-l-4 border-transparent hover:bg-white/5"
                                }`}
                                dangerouslySetInnerHTML={{ __html: block }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer decoration indicator */}
                    <div className="border-t border-cyber-cyan/10 pt-3 flex items-center justify-between text-[9px] text-[#00ffff]/50 font-mono uppercase">
                      <span>CHIP TYPE: INNODB_ACTIVE_REVISION</span>
                      <span>LAST PROTOCOL UPDATE: {new Date(activeCard.updatedAt).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* FLOATING TTS SOUND CONTROLLER FOOTPRINT */}
                  {/* ==================================================== */}
                  <div className="bg-black/95 border border-[#00ffff]/30 p-4 sm:p-5 shadow-[0_0_30px_rgba(0,255,255,0.15)] flex flex-col xl:flex-row items-center justify-between gap-4 sm:gap-6 relative overflow-hidden backdrop-blur-xl rounded-sm">
                    {/* Retro Grid Accent for specialist physical controls feel */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{ background: "linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)", backgroundSize: "8px 8px" }}></div>
                    
                    {/* Neon pulsing audio bars decoration on background bottom */}
                    <div className="absolute right-0 left-0 bottom-0 pointer-events-none opacity-15 h-1.5 flex gap-[2px] justify-between z-0">
                      {Array.from({ length: 90 }).map((_, i) => (
                        <div 
                          key={i} 
                          className="bg-cyber-cyan w-full" 
                          style={{ 
                            height: isPlayingTTS ? `${20 + Math.random() * 80}%` : "1px",
                            transition: "height 0.15s ease-in-out" 
                          }}
                        />
                      ))}
                    </div>

                    {/* CONTROL PART 1: AUDIO STATUS & LAUNCH BUTTON */}
                    <div className="flex items-center gap-4 z-10 w-full xl:w-auto justify-between">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleToggleTTS}
                          className={`group relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center cursor-pointer transition-all rounded-sm border-2 ${
                            isPlayingTTS 
                              ? "bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta shadow-[0_0_20px_#ff0055]" 
                              : "bg-black border-cyber-cyan hover:bg-cyber-cyan/15 text-cyber-cyan hover:shadow-[0_0_15px_#00ffff]"
                          }`}
                          title={isPlayingTTS ? "暂停语音朗读" : "开始 AI 自动语音朗读"}
                        >
                          {/* Angled corner accents */}
                          <div className={`absolute -top-1 -right-1 w-1.5 h-1.5 ${isPlayingTTS ? "bg-cyber-magenta" : "bg-cyber-cyan"}`}></div>
                          
                          {isPlayingTTS ? (
                            <VolumeX className="w-5.5 h-5.5 sm:w-6 h-6 animate-pulse" />
                          ) : (
                            <Volume2 className="w-5.5 h-5.5 sm:w-6 h-6 group-hover:scale-110 transition-transform" />
                          )}
                        </button>

                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] sm:text-[10px] text-white font-mono tracking-widest uppercase font-extrabold flex items-center gap-1.5">
                              {isPlayingTTS ? (
                                <>
                                  <span className="w-1.5 h-1.5 bg-cyber-magenta rounded-full animate-ping"></span>
                                  <span className="text-cyber-magenta">TTS TRANSMITTING</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 bg-cyber-green rounded-full"></span>
                                  <span className="text-slate-400 font-bold">READER STANDBY</span>
                                </>
                              )}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] font-mono text-slate-300">
                            <span className="font-black bg-[#00ffff]/10 border border-[#00ffff]/20 px-1 py-0.5 text-cyber-cyan">
                              SEG [{String(currentParagraphIndex + 1).padStart(2, "0")}/{String(activeParagraphs.length).padStart(2, "0")}]
                            </span>
                            <div className="flex items-center gap-1 bg-black/50 px-1.5 py-0.5 border border-white/5">
                              <span className="text-[8px] text-[#00ffff]/60 uppercase hidden xs:inline">SPEED:</span>
                              <span className="text-cyber-green font-bold text-center w-6">{voiceSpeed.toFixed(1)}x</span>
                              <input 
                                type="range" 
                                min="0.8" 
                                max="1.8" 
                                step="0.1" 
                                value={voiceSpeed}
                                onChange={(e) => {
                                  const newspeed = parseFloat(e.target.value);
                                  setVoiceSpeed(newspeed);
                                  if (isPlayingTTS) {
                                    setTimeout(() => speakActiveParagraph(), 200);
                                  }
                                }}
                                className="w-12 sm:w-16 accent-cyber-cyan h-1 bg-cyber-gray-light cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CONTROL PART 2: THE SEGMENT SEQUENCER STRIP (CHANNELS OVERLAY) */}
                    <div className="flex-1 w-full xl:w-auto flex flex-col justify-center px-1 border-t border-b xl:border-t-0 xl:border-b-0 border-white/5 z-10 py-1.5 xl:py-0">
                      <div className="flex items-center justify-between mb-1 text-[8px] sm:text-[9px] font-mono text-[#00ffff]/50">
                        <span>AUDIO DECODER SEQUENCER STATE</span>
                        <span>{isPlayingTTS ? `DECODING STREAM CHUNKS...` : `READY TO PLAY`}</span>
                      </div>
                      <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-cyber-cyan/30 scrollbar-track-transparent">
                        {activeParagraphs.map((_, i) => {
                          const isActive = i === currentParagraphIndex;
                          const isPlayed = i < currentParagraphIndex;
                          return (
                            <button 
                              key={i}
                              onClick={() => {
                                setCurrentParagraphIndex(i);
                                if (isPlayingTTS) speakActiveParagraph();
                              }}
                              className={`flex-1 min-w-[20px] sm:min-w-0 h-4 sm:h-3.5 relative focus:outline-none border rounded-sm cursor-pointer transition-all ${
                                isActive 
                                  ? "bg-cyber-cyan border-cyber-cyan shadow-[0_0_12px_#00ffff]" 
                                  : isPlayed 
                                  ? "bg-cyber-cyan/40 border-cyber-cyan/30 hover:bg-cyber-cyan/60" 
                                  : "bg-[#00ffff]/5 border-[#00ffff]/15 hover:bg-[#00ffff]/20 hover:border-[#00ffff]/30"
                              }`}
                              title={`切换到第 ${i + 1} 段`}
                            >
                              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black border border-cyber-cyan text-[8px] text-cyber-cyan px-1 py-0.5 opacity-0 hover:opacity-100 pointer-events-none transition-opacity font-mono z-30 whitespace-nowrap">
                                SEG_CH #{i + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* CONTROL PART 3: NAVIGATION TACTICAL KEYBOARD */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Segment hoppers */}
                      <div className="flex items-center gap-1 border border-white/10 bg-black/40 p-1 rounded-sm">
                        <button 
                          onClick={handlePrevBlock}
                          className="p-1.5 border border-transparent text-[#00ffff]/60 hover:text-cyber-cyan hover:bg-[#00ffff]/10 cursor-pointer rounded-sm active:scale-95 transition-all"
                          title="跳转到上一段 (PREVIOUS SEGMENT)"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        
                        <div className="h-4 w-px bg-white/15" />
                        
                        <button 
                          onClick={handleNextBlock}
                          className="p-1.5 border border-transparent text-[#00ffff]/60 hover:text-cyber-cyan hover:bg-[#00ffff]/10 cursor-pointer rounded-sm active:scale-95 transition-all"
                          title="跳转到下一段 (NEXT SEGMENT)"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Topic swappers - styled elegantly like core terminal buttons */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handlePrevCard}
                          className="px-3.5 py-2 border border-cyber-cyan/45 bg-black text-[11px] font-mono text-cyber-cyan hover:bg-cyber-cyan/15 hover:text-white hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all cursor-pointer rounded-sm uppercase tracking-wider flex items-center gap-1"
                          title="跳转向上一知识点"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          PREV_CHIP
                        </button>
                        
                        <button 
                          onClick={handleNextCard}
                          className="relative group overflow-hidden px-4 py-2 bg-cyber-cyan hover:bg-[#00ffff] text-black font-extrabold text-[11px] font-mono uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,255,0.35)] hover:shadow-[0_0_25px_#00ffff] transition-all cursor-pointer rounded-sm flex items-center gap-1.5"
                          title="跳转向下一知识点"
                        >
                          {/* Inner glowing effect on hover */}
                          <div className="absolute top-0 right-0 w-2 h-2 bg-white"></div>
                          <span>NEXT_CHIP</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#00ffff]/40 font-mono">
                  <span>WARNING: NO KNOWLEDGE CARD SELECTED ON ACTIVE CHANNEL.</span>
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

        {/* ==================================================== */}
        {/* FOOTER METRICS SYSTEM STATUS */}
        {/* ==================================================== */}
        <footer className="h-8 border-t border-[#00ffff]/20 bg-black/90 flex items-center justify-between px-4 text-[9px] font-mono uppercase tracking-[0.2em] text-[#00ffff]/40 shrink-0">
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
