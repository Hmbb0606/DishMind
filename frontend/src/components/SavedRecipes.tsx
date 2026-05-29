import React from "react";
import { SavedRecipe } from "../types";
import { motion } from "motion/react";
import { BookOpen, Trash2, ChefHat, Calendar } from "lucide-react";

interface SavedRecipesProps {
  saved: SavedRecipe[];
  onDelete: (id: string) => void;
  onSelect: (recipe: SavedRecipe) => void;
  onClose: () => void;
}

export default function SavedRecipes({ saved, onDelete, onSelect, onClose }: SavedRecipesProps) {
  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Drawer Header */}
      <div className="p-5 border-b border-white/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#e2501a]" />
          <h3 className="font-display font-semibold text-[#3c2f2f] text-base">私房菜谱本 ({saved.length})</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-xs font-semibold px-2.5 py-1 text-[#7c6f62] hover:text-[#3c3029] bg-white/40 hover:bg-white/80 border border-white/50 transition-colors rounded-lg cursor-pointer"
        >
          返回助理
        </button>
      </div>

      {/* Main Recipe Book Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar">
        {saved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 bg-white/30 backdrop-blur-xs rounded-full flex items-center justify-center text-xl animate-float mb-4 border border-white/40">
              📔
            </div>
            <h4 className="text-sm font-semibold text-[#4d403a] mb-1">您的食谱书还空空如也</h4>
            <p className="text-xs text-[#8c7e74] max-w-[200px]">
              点击对话框里智能食谱卡片右上角的 “收藏” 按钮，即可将灵感保存在这里！
            </p>
          </div>
        ) : (
          saved.map(recipe => (
            <motion.div 
              key={recipe.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group p-4 rounded-2xl border border-white/40 bg-white/40 backdrop-blur-xs hover:bg-white/75 hover:border-[#fed7aa]/60 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h4 
                    onClick={() => onSelect(recipe)}
                    className="font-display font-semibold text-sm hover:text-[#e2501a] text-[#332b26] cursor-pointer transition-colors max-w-[180px] truncate"
                  >
                    {recipe.title}
                  </h4>
                  
                  <button 
                    onClick={() => onDelete(recipe.id)}
                    className="text-[#a89d93] hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="从食谱书中移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p 
                  onClick={() => onSelect(recipe)}
                  className="text-xs text-[#8c7e74] line-clamp-2 mt-1.5 cursor-pointer leading-relaxed hover:opacity-90"
                >
                  {recipe.summary || "点击查看详情及食材明细..."}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
                <div className="flex items-center gap-1 text-[10px] text-[#a0938a]">
                  <Calendar className="w-3 h-3 text-[#c5b5aa]" />
                  <span>{new Date(recipe.savedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
                </div>

                <button 
                  onClick={() => onSelect(recipe)}
                  className="text-[11px] font-medium text-white px-2.5 py-1 bg-[#e2501a] hover:bg-[#df5813] hover:shadow-xs transition-all rounded-lg cursor-pointer"
                >
                  详情
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Notebook footer */}
      <div className="p-4 bg-white/20 backdrop-blur-md border-t border-white/25 rounded-b-3xl">
        <div className="bg-white/70 backdrop-blur-md p-3.5 rounded-xl border border-white/80 text-xs leading-relaxed text-[#7c6f62] flex items-start gap-2.5 shadow-2xs">
          <ChefHat className="w-4 h-4 text-[#e2501a] shrink-0 mt-0.5" />
          <p>
            点击任意食谱卡中的 <strong>“详情”</strong>，可查看完整食材、步骤，并从详情页进入一步步烹饪。
          </p>
        </div>
      </div>
    </div>
  );
}
