import React, { useState, useEffect, useRef } from "react";
import { ParsedRecipe } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, Clock, Volume2, Sparkles } from "lucide-react";

interface InteractiveCookingProps {
  recipe: ParsedRecipe;
  onClose: () => void;
}

// Simple browser synthesizer for sound effects (no external audio assets required)
const playSound = (type: "ding" | "complete" | "click") => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "ding") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch ding
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); 
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "complete") {
      // Arpeggio chime
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + idx * 0.1);
        g.gain.setValueAtTime(0.12, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.4);
      });
    }
  } catch (e) {
    console.warn("Audio Context could not start:", e);
  }
};

export default function InteractiveCooking({ recipe, onClose }: InteractiveCookingProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [ingredientsState, setIngredientsState] = useState(
    recipe.ingredients.map(ing => ({ ...ing, checked: false }))
  );
  
  const currentStep = recipe.steps[currentStepIdx] || recipe.steps[0];
  
  // Timer states
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state whenever active step changes
  useEffect(() => {
    if (currentStep && currentStep.timerSeconds) {
      setTimerLeft(currentStep.timerSeconds);
    } else {
      setTimerLeft(null);
    }
    setTimerActive(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  }, [currentStepIdx]);

  // Hook up timer tick
  useEffect(() => {
    if (timerActive && timerLeft !== null) {
      timerIntervalRef.current = setInterval(() => {
        setTimerLeft(prev => {
          if (prev !== null && prev <= 1) {
            setTimerActive(false);
            clearInterval(timerIntervalRef.current!);
            playSound("complete");
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerActive, timerLeft]);

  const toggleIngredient = (idx: number) => {
    playSound("click");
    setIngredientsState(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], checked: !copy[idx].checked };
      return copy;
    });
  };

  const nextStep = () => {
    if (currentStepIdx < recipe.steps.length - 1) {
      playSound("click");
      setCurrentStepIdx(prev => prev + 1);
    } else {
      playSound("complete");
      alert("太棒了！您已完成这道美味佳肴的所有步骤！🎉");
    }
  };

  const prevStep = () => {
    if (currentStepIdx > 0) {
      playSound("click");
      setCurrentStepIdx(prev => prev - 1);
    }
  };

  // Convert seconds to mm:ss format
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const allIngredientsChecked = ingredientsState.every(i => i.checked);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#faf8f4]/95 backdrop-blur-md flex flex-col md:flex-row shadow-2xl overflow-hidden"
    >
      {/* Sidebar: Checklist of ingredients */}
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-[#e8e2d9] p-6 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-full">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg text-[#3c2f2f] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#e2501a]" />
              准备食材与配佐
            </h3>
            <span className="text-xs bg-[#fdedd5] text-[#b45309] font-medium px-2 py-0.5 rounded-full">
              {ingredientsState.filter(i => i.checked).length} / {ingredientsState.length}
            </span>
          </div>
          <p className="text-xs text-[#7c6f62] mb-4">开始做菜前，请勾选核对，确保调料备齐。这能避免手忙脚乱哦！</p>
          
          <div className="space-y-2">
            {ingredientsState.map((ing, idx) => (
              <label 
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-sm cursor-pointer transition-all ${
                  ing.checked 
                    ? "bg-[#fffaf3] border-[#fdba74] text-[#7c2d12] font-medium line-through decoration-[#fdba74]" 
                    : "bg-[#fcfcfc] border-[#f1efe9] text-[#4d403a] hover:bg-[#fafaf9]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={ing.checked}
                    onChange={() => toggleIngredient(idx)}
                    className="rounded text-[#e2501a] focus:ring-[#e2501a] border-[#e1ded8] w-4 h-4"
                  />
                  <span>{ing.name}</span>
                </div>
                <span className={`text-xs ${ing.checked ? "text-[#c2410c]" : "text-[#8c7e74]"}`}>{ing.quantity}</span>
              </label>
            ))}
          </div>
        </div>

        {allIngredientsChecked && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-6 p-4 rounded-xl bg-[#fff2ec] border border-[#ffdbce] text-[#7c2d12] flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-[#e2501a] shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-xs">调料备齐，主厨就绪！</p>
              <p className="text-xs opacity-90 mt-0.5">您已集齐了全部食材！现在大展身手的时候到了。</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Focus Area: Responsive cooking process */}
      <div className="flex-1 flex flex-col justify-between p-6 md:p-10 relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-xs tracking-wider uppercase font-semibold bg-[#ffebe2] text-[#ff5f1e] px-3 py-1 rounded-full">
              正在烹饪：{recipe.title}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="bg-white border border-[#e8e2d9] text-[#7c6f62] hover:bg-[#f5eeeb] hover:text-[#4d403a] px-4 py-2 rounded-xl text-sm transition-all"
          >
            结束并退出
          </button>
        </div>

        {/* Progress Bar (Dot indicators) */}
        <div className="w-full flex items-center justify-between gap-1 mb-6">
          {recipe.steps.map((s, idx) => (
            <div 
              key={idx}
              className={`h-2 flex-grow rounded-full transition-all duration-300 ${
                idx === currentStepIdx 
                  ? "bg-[#e2501a]" 
                  : idx < currentStepIdx 
                    ? "bg-[#ffdbce]" 
                    : "bg-[#e2dfd9]"
              }`}
            />
          ))}
        </div>

        {/* Focused Step Display Block */}
        <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full py-4 md:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIdx}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl border border-[#ece7de] shadow-sm p-6 md:p-12 flex flex-col justify-between min-h-[300px] relative"
            >
              {/* Step indicator */}
              <div className="absolute top-6 left-6 md:top-10 md:left-12 flex items-center gap-1.5 text-[#e2501a] font-display font-semibold text-sm">
                <span>STEP</span>
                <span className="text-3xl font-extrabold leading-none">{currentStep?.number || currentStepIdx + 1}</span>
                <span className="text-xs text-[#a0948b]">/ {recipe.steps.length}</span>
              </div>

              {/* Step content */}
              <div className="mt-14 md:mt-16 text-xl md:text-2xl lg:text-3xl font-sans text-[#332b26] font-medium leading-relaxed md:leading-normal">
                {currentStep?.text}
              </div>

              {/* Kitchen Timer Integration */}
              {timerLeft !== null && (
                <div className="mt-8 flex flex-col items-center justify-center p-4 bg-[#fbfaf8] rounded-2xl border border-[#efe9df] max-w-sm self-center w-full">
                  <div className="flex items-center gap-2 text-xs text-[#8c7e74] mb-2">
                    <Clock className="w-3.5 h-3.5 text-[#e2501a]" />
                    <span>此步骤含预设计时提醒</span>
                  </div>
                  
                  <div className={`font-display text-4xl font-semibold tracking-wider tabular-nums ${timerLeft === 0 ? "text-green-600 animate-pulse" : "text-[#3c3029]"}`}>
                    {timerLeft === 0 ? "已完成! 🎉" : formatTime(timerLeft)}
                  </div>

                  <div className="flex items-center gap-3 mt-3 w-full justify-center">
                    <button 
                      onClick={() => {
                        playSound("click");
                        setTimerActive(prev => !prev);
                      }}
                      className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all ${
                        timerActive 
                          ? "bg-[#7c2d12] hover:bg-[#621e02] text-white" 
                          : "bg-[#e2501a] hover:bg-[#df5813] text-white"
                      }`}
                    >
                      {timerActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      <span>{timerActive ? "暂停" : "启动计时"}</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        playSound("click");
                        setTimerActive(false);
                        setTimerLeft(currentStep.timerSeconds || 0);
                      }}
                      className="bg-white border border-[#ece7de] hover:bg-[#f6f2ec] text-[#7c6f62] p-2 rounded-full transition-all"
                      title="重置"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action controls below card */}
        <div className="flex justify-between items-center max-w-4xl mx-auto w-full mt-6">
          <button
            onClick={prevStep}
            disabled={currentStepIdx === 0}
            className={`flex items-center gap-1.5 px-6 py-3.5 rounded-2xl text-sm font-semibold border transition-all ${
              currentStepIdx === 0 
                ? "border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed" 
                : "border-[#e2ded6] text-[#4d403a] hover:bg-white bg-[#faf8f4] hover:shadow-sm"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </button>

          <div className="text-xs text-[#a39485] font-display">
            进度: <span className="font-semibold text-[#e2501a]">{Math.round(((currentStepIdx + 1) / recipe.steps.length) * 100)}%</span>
          </div>

          <button
            onClick={nextStep}
            className="flex items-center gap-1.5 px-8 py-3.5 bg-[#e2501a] hover:bg-[#df5813] text-white rounded-2xl text-sm font-semibold shadow-md shadow-[#e2501a]/10 hover:shadow-lg transition-all"
          >
            {currentStepIdx === recipe.steps.length - 1 ? "完成烹饪! 🎉" : "下一步"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
