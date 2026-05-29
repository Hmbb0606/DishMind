import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  ChefHat,
  Copy,
  Info,
  Send,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
} from "lucide-react";
import InteractiveCooking from "./components/InteractiveCooking";
import MarkdownMessage from "./components/MarkdownMessage";
import RecipeDetailModal from "./components/RecipeDetailModal";
import SavedRecipes from "./components/SavedRecipes";
import { SAVED_RECIPES_STORAGE_KEY, SUGGESTED_QUERIES, WELCOME_MESSAGE } from "./constants";
import { Message, ParsedRecipe, SavedRecipe } from "./types";
import { parseRecipeText } from "./utils/recipeParser";

type AppSection = "hero" | "chat";

function createId() {
  return Math.random().toString(36).slice(2);
}

function formatRecipeForClipboard(recipe: ParsedRecipe | SavedRecipe) {
  const ingredients = recipe.ingredients.map((item) => `- ${item.name} ${item.quantity}`).join("\n");
  const steps = recipe.steps.map((step) => `${step.number}. ${step.text}`).join("\n");
  const tips = recipe.tips.map((tip) => `- ${tip}`).join("\n");

  return [
    `# ${recipe.title}`,
    "",
    "### 🍽️ 菜品介绍",
    recipe.summary,
    "",
    "### 🥬 食材清单",
    ingredients,
    "",
    "### 🍳 制作步骤",
    steps,
    "",
    "### 🌟 主厨贴士",
    tips,
  ].join("\n");
}

function playSaveChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(523.25, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(783.99, context.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  } catch (error) {
    console.warn("Unable to play save chime:", error);
  }
}

function loadSavedRecipes() {
  try {
    const raw = localStorage.getItem(SAVED_RECIPES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedRecipe[]) : [];
  } catch (error) {
    console.error("Failed to load saved recipes:", error);
    return [];
  }
}

function persistSavedRecipes(recipes: SavedRecipe[]) {
  localStorage.setItem(SAVED_RECIPES_STORAGE_KEY, JSON.stringify(recipes));
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("hero");
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [activeCookingRecipe, setActiveCookingRecipe] = useState<ParsedRecipe | null>(null);
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<ParsedRecipe | SavedRecipe | null>(null);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSavedRecipes(loadSavedRecipes());
  }, []);

  useEffect(() => {
    if (!feedbackText) {
      return;
    }

    const timer = window.setTimeout(() => setFeedbackText(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedbackText]);

  useEffect(() => {
    let lastScrollTime = 0;
    const cooldown = 950;

    const handleWheel = (event: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime < cooldown) {
        return;
      }

      if (activeSection === "hero" && event.deltaY > 15) {
        setActiveSection("chat");
        lastScrollTime = now;
        return;
      }

      if (activeSection === "chat" && event.deltaY < -15) {
        const container = document.getElementById("chat-messages-scroll-container");
        if (container && container.scrollTop <= 5) {
          setActiveSection("hero");
          lastScrollTime = now;
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [activeSection]);

  useEffect(() => {
    let touchStartY = 0;
    let lastScrollTime = 0;
    const cooldown = 950;

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0].clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastScrollTime < cooldown) {
        return;
      }

      const touchEndY = event.changedTouches[0].clientY;
      const diffY = touchStartY - touchEndY;

      if (activeSection === "hero" && diffY > 60) {
        setActiveSection("chat");
        lastScrollTime = now;
        return;
      }

      if (activeSection === "chat" && diffY < -60) {
        const container = document.getElementById("chat-messages-scroll-container");
        if (container && container.scrollTop <= 5) {
          setActiveSection("hero");
          lastScrollTime = now;
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [activeSection]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const syncSavedRecipes = (recipes: SavedRecipe[]) => {
    setSavedRecipes(recipes);
    persistSavedRecipes(recipes);
  };

  const isRecipeSaved = (recipe: ParsedRecipe) =>
    savedRecipes.some((item) => item.title.toLowerCase() === recipe.title.toLowerCase());

  const copyText = async (text: string, successLabel: string, messageId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedbackText(successLabel);

      if (messageId) {
        setCopiedMessageId(messageId);
        window.setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 1800);
      }
    } catch (error) {
      console.error("Failed to copy text:", error);
      setFeedbackText("复制失败，请检查浏览器权限");
    }
  };

  const handleCopyMessage = async (message: Message) => {
    await copyText(message.content, "回答已复制到剪贴板", message.id);
  };

  const handleCopyRecipe = async (recipe: ParsedRecipe | SavedRecipe) => {
    await copyText(formatRecipeForClipboard(recipe), `《${recipe.title}》已复制`);
  };

  const handleSaveRecipe = (recipe: ParsedRecipe) => {
    if (isRecipeSaved(recipe)) {
      setFeedbackText(`《${recipe.title}》已在私房菜谱本中`);
      return;
    }

    const nextRecipes = [
      ...savedRecipes,
      {
        ...recipe,
        id: createId(),
        savedAt: new Date().toISOString(),
      },
    ];

    syncSavedRecipes(nextRecipes);
    playSaveChime();
    setFeedbackText(`已收藏《${recipe.title}》`);
  };

  const handleDeleteSavedRecipe = (id: string) => {
    const nextRecipes = savedRecipes.filter((recipe) => recipe.id !== id);
    syncSavedRecipes(nextRecipes);
    setFeedbackText("已删除收藏");
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawMessage = (textToSend || inputValue).trim();
    if (!rawMessage || isLoading) {
      return;
    }

    setActiveSection("chat");
    if (!textToSend) {
      setInputValue("");
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: rawMessage,
      timestamp: new Date(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const chatHistory = messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: rawMessage,
          history: chatHistory,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const replyText = payload.text || "";
      const parsedRecipe = parseRecipeText(replyText, rawMessage);

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: replyText,
          timestamp: new Date(),
          parsedRecipe: parsedRecipe || undefined,
        },
      ]);
    } catch (error) {
      console.error("Error communicating with backend:", error);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content:
            "### ⚠️ 当前请求失败\n请确认 `cook-rag` 环境依赖、模型密钥和向量索引已准备完成，然后再试一次。",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const openRecipeDetail = (recipe: ParsedRecipe | SavedRecipe) => {
    setSelectedRecipeDetail(recipe);
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-linear-to-tr from-[#fbf8f5] via-[#FCFAF8] to-[#fef6f0] font-sans text-[#332C28]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-15%] h-[700px] w-[700px] animate-pulse rounded-full bg-[#FF6321]/8 blur-[150px]" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[#df5813]/6 blur-[130px]" />
        <div className="absolute right-[15%] top-[35%] h-[450px] w-[450px] rounded-full bg-orange-100/30 blur-[110px]" />
      </div>

      <nav className="relative z-20 flex items-center justify-between border-b border-white/20 bg-white/40 px-6 py-5 backdrop-blur-md md:px-12">
        <div onClick={() => setActiveSection("hero")} className="group flex cursor-pointer items-center gap-3 select-none">
          <div className="animate-float flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6321] shadow-[0_4px_15px_rgba(255,99,33,0.3)] transition-transform group-hover:scale-105">
            <ChefHat className="h-5 w-5 stroke-[2.5] text-white" />
          </div>
          <div>
            <span className="inline-block text-xl font-light uppercase italic tracking-[0.15em] text-[#332C28] md:text-2xl">
              Dish<span className="font-bold not-italic text-[#FF6321]">Mind</span>
            </span>
            <span className="ml-3 hidden rounded-full border border-[#ffdec9] bg-[#ffebe2] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#FF6321] sm:inline-block">
              RAG Chef
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsSavedDrawerOpen((open) => !open)}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-xs font-semibold tracking-wider text-[#332C28] shadow-xs transition-all hover:border-[#FF6321]/40 hover:bg-white/80"
        >
          <BookOpen className="h-4 w-4 text-[#FF6321]" />
          <span className="hidden sm:inline">私房菜谱本</span>
          <span className="ml-1 rounded-full bg-[#FF6321] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {savedRecipes.length}
          </span>
        </button>
      </nav>

      <div className="relative z-10 flex flex-1 overflow-hidden" id="workspace-scroll-container">
        <AnimatePresence mode="wait">
          {activeSection === "hero" ? (
            <motion.div
              key="hero-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -45, scale: 0.98 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center select-none md:px-12"
            >
              <div className="mx-auto flex max-w-4xl flex-col items-center justify-center">
                <h1 className="mb-6 text-5xl leading-none tracking-tight text-[#332C28] md:text-8xl">
                  Your <span className="font-serif italic text-[#FF6321]">Culinary</span> <br className="sm:hidden" />
                  Consciousness
                </h1>

                <p className="mb-6 font-serif text-xl font-light tracking-widest text-[#7c6f62] md:text-2xl">
                  美味，源自一问一应的默契
                </p>

                <div className="mb-8 h-[1px] w-12 bg-[#FF6321]/40" />

                <p className="mb-10 max-w-2xl text-sm leading-relaxed text-[#7c6f62] md:text-base">
                  DishMind 直接连接项目里的菜谱知识库和检索问答能力。
                  <br />
                  选一个经典问题开始，或向下滚动进入对话区。
                </p>

                <div className="mb-10 grid w-full max-w-3xl grid-cols-2 gap-3.5 md:grid-cols-4">
                  {SUGGESTED_QUERIES.map((item) => (
                    <motion.button
                      key={item.text}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => handleSendMessage(item.text)}
                      className="group flex h-24 cursor-pointer flex-col justify-between rounded-2xl border border-white/60 bg-white/45 p-4 text-left text-[#332C28] shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all hover:border-[#FF6321]/30 hover:bg-white/85"
                    >
                      <span className="mb-1 text-2xl transition-transform group-hover:scale-110">{item.icon}</span>
                      <div>
                        <p className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#FF6321]">
                          {item.label}
                        </p>
                        <p className="truncate text-xs font-semibold">{item.text}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  onClick={() => setActiveSection("chat")}
                  animate={{ y: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="flex cursor-pointer flex-col items-center gap-2 text-[#FF6321] transition-colors hover:text-[#df5813]"
                >
                  <span className="font-mono text-xs font-semibold uppercase tracking-widest">向下滚动 或 点击探索</span>
                  <ChevronDown className="h-5 w-5 stroke-[2.5]" />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat-view"
              initial={{ opacity: 0, y: 70, scale: 1.01 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 70, scale: 1.01 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex flex-col overflow-hidden bg-transparent"
            >
              <div id="chat-messages-scroll-container" className="scrollbar flex-grow space-y-6 overflow-y-auto bg-transparent p-4 md:p-8">
                {messages.map((message) => {
                  const recipeSaved = message.parsedRecipe ? isRecipeSaved(message.parsedRecipe) : false;

                  return (
                    <div
                      key={message.id}
                      className={`mx-auto flex max-w-4xl gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-xl border border-[#ffdec9] bg-[#ffebe2] text-xs select-none">
                          👩‍🍳
                        </div>
                      )}

                      <div className={`flex max-w-[85%] flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                        <div
                          className={`max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all duration-300 md:px-5 md:py-4 ${
                            message.role === "user"
                              ? "rounded-tr-xs border border-[#FF6321]/10 bg-[#FF6321]/90 font-medium text-white shadow-[0_3px_12px_rgba(255,99,33,0.12)]"
                              : "rounded-tl-xs border border-white/70 bg-white/50 text-[#3c3029] shadow-[0_3px_16px_rgba(0,0,0,0.015)] backdrop-blur-md"
                          }`}
                        >
                          {message.role === "user" ? (
                            <p className="whitespace-pre-wrap leading-relaxed select-text">{message.content}</p>
                          ) : (
                            <MarkdownMessage content={message.content} />
                          )}

                          {message.role === "assistant" && message.parsedRecipe && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1efe9] pt-4"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-medium text-[#b9420b]">
                                <Sparkles className="h-4 w-4 animate-pulse fill-[#FF6321]/15 text-[#FF6321]" />
                                <span>已识别菜谱：</span>
                                <span className="rounded-md bg-[#FF6321] px-2 py-0.5 font-semibold text-white">
                                  {message.parsedRecipe.title}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => handleSaveRecipe(message.parsedRecipe!)}
                                  className={`flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                                    recipeSaved
                                      ? "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]"
                                      : "border-[#e5dfd4] bg-[#faf6f0] text-[#3c3029] hover:bg-[#ffebe2] hover:text-[#e2501a]"
                                  }`}
                                  title="保存到私房菜谱本"
                                >
                                  {recipeSaved ? (
                                    <BookmarkCheck className="h-3.5 w-3.5 text-[#FF6321]" />
                                  ) : (
                                    <Bookmark className="h-3.5 w-3.5 text-[#FF6321]" />
                                  )}
                                  <span>{recipeSaved ? "已收藏" : "收藏"}</span>
                                </button>

                                <button
                                  onClick={() => openRecipeDetail(message.parsedRecipe!)}
                                  className="cursor-pointer rounded-lg bg-[#FF6321] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#df5813]"
                                >
                                  详情
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div className="mt-1.5 flex items-center gap-3 px-1 font-mono text-[10px] text-[#7c6f62]">
                          <span>
                            {message.timestamp.toLocaleTimeString("zh-CN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                          {message.role === "assistant" && (
                            <button
                              onClick={() => handleCopyMessage(message)}
                              className="flex cursor-pointer items-center gap-0.5 transition-colors hover:text-amber-500"
                            >
                              <Copy className="h-2.5 w-2.5" />
                              <span>{copiedMessageId === message.id ? "已复制" : "复制"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {message.role === "user" && (
                        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-xl border border-[#ebdcd0] bg-white font-mono text-xs font-bold text-[#FF6321] shadow-xs select-none">
                          ME
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="mx-auto flex max-w-4xl gap-4 justify-start">
                    <div className="flex h-9 w-9 shrink-0 animate-bounce items-center justify-center self-start rounded-xl bg-[#FF6321]/20 text-xs">
                      🍲
                    </div>
                    <div className="flex max-w-[80%] items-center gap-3.5 rounded-3xl border border-white/60 bg-white/45 p-5 backdrop-blur-md shadow-xs">
                      <div className="relative h-5 w-5">
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#FF6321]/20 border-t-[#FF6321]" />
                      </div>
                      <span className="text-xs font-medium tracking-wide text-[#6e6259]">
                        大厨正在检索菜谱、整理食材与步骤，请稍候...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="relative border-t border-white/20 bg-white/30 p-4 backdrop-blur-md select-none md:p-6">
                <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-white/0 to-transparent" />

                <div className="relative mx-auto max-w-4xl">
                  <div className="pointer-events-none absolute inset-0 scale-95 rounded-3xl bg-[#FF6321]/10 blur-2xl" />

                  <div className="relative flex items-center rounded-2xl border border-white/80 bg-white/70 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.02)] transition-all focus-within:border-[#FF6321]/60 focus-within:bg-white/90 focus-within:ring-2 focus-within:ring-[#FF6321]/10 backdrop-blur-md">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="想吃点什么？试试输入“番茄炒蛋怎么做？”或“推荐几道清爽减脂的夏日素菜”..."
                      className="flex-1 bg-transparent px-4 py-3 text-sm font-light text-[#332C28] outline-none placeholder:text-stone-500 placeholder:opacity-40 md:px-6 md:py-4 md:text-base"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputValue.trim() || isLoading}
                      className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#FF6321] text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:hover:scale-100 md:h-14 md:w-14"
                    >
                      <Send className="h-5 w-5 shrink-0 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                <div className="mx-auto mt-3 flex max-w-4xl items-center justify-between px-2 font-sans text-[10px] text-stone-500">
                  <div className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-[#FF6321]" />
                    <span>支持继续追问细节，比如“第三步为什么要加黄酒？”</span>
                  </div>
                  <div className="font-mono">Enter 发送</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSavedDrawerOpen && (
            <>
              <div className="fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden" onClick={() => setIsSavedDrawerOpen(false)} />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l border-white/45 bg-white/70 shadow-2xl backdrop-blur-xl sm:w-[400px]"
              >
                <SavedRecipes
                  saved={savedRecipes}
                  onDelete={handleDeleteSavedRecipe}
                  onSelect={(recipe) => {
                    openRecipeDetail(recipe);
                    setIsSavedDrawerOpen(false);
                  }}
                  onClose={() => setIsSavedDrawerOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <footer className="pointer-events-none relative z-10 flex flex-col items-center justify-between gap-2 border-t border-[#ebdcd0] bg-[#FAF8F5] px-6 py-3 select-none sm:flex-row md:px-12">
        <div className="flex gap-4 text-[10px] text-stone-500 md:gap-8">
          <div className="flex flex-col">
            <span className="mb-0.5 font-bold uppercase tracking-widest opacity-50">Knowledge Base</span>
            <span className="font-mono text-[#7c6f62]">PYTHON RAG / MARKDOWN RECIPES</span>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 font-bold uppercase tracking-widest opacity-50">Favorites</span>
            <span className="font-mono text-[#7c6f62]">{savedRecipes.length} SAVED RECIPES</span>
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#7c6f62]">
          © 2026 DishMind Culinary Systems
        </div>
      </footer>

      <AnimatePresence>
        {feedbackText && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-4 py-2 text-sm font-medium text-[#c2410c] shadow-lg"
          >
            {feedbackText}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedRecipeDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeDetail}
          onClose={() => setSelectedRecipeDetail(null)}
          onCopy={handleCopyRecipe}
          onCook={(recipe) => {
            setSelectedRecipeDetail(null);
            setActiveCookingRecipe(recipe);
          }}
        />
      )}

      <AnimatePresence>
        {activeCookingRecipe && <InteractiveCooking recipe={activeCookingRecipe} onClose={() => setActiveCookingRecipe(null)} />}
      </AnimatePresence>
    </div>
  );
}
