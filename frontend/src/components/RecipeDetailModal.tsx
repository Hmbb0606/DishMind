import React from "react";
import { motion } from "motion/react";
import { Calendar, ChefHat, Copy } from "lucide-react";
import { ParsedRecipe, SavedRecipe } from "../types";

interface RecipeDetailModalProps {
  recipe: ParsedRecipe | SavedRecipe;
  onClose: () => void;
  onCook: (recipe: ParsedRecipe) => void;
  onCopy: (recipe: ParsedRecipe | SavedRecipe) => void;
}

export default function RecipeDetailModal({
  recipe,
  onClose,
  onCook,
  onCopy,
}: RecipeDetailModalProps) {
  const savedAt = "savedAt" in recipe ? recipe.savedAt : undefined;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#36271c]/35 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/60 bg-white/75 p-6 shadow-2xl backdrop-blur-xl md:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="font-display text-xl font-semibold text-[#b9420b] md:text-2xl">
              {recipe.title}
            </h3>
            {savedAt && (
              <div className="flex items-center gap-1.5 text-xs text-[#8c7e74]">
                <Calendar className="h-3.5 w-3.5 text-[#f97316]" />
                <span>
                  收藏于{" "}
                  {new Date(savedAt).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-white/50 bg-white/40 px-3.5 py-1.5 text-xs font-semibold text-[#7c6f62] transition-colors hover:bg-white/80 hover:text-[#332C28]"
          >
            关闭
          </button>
        </div>

        <p className="mb-6 border-l-2 border-[#FF6321] pl-3 text-sm italic leading-relaxed text-[#7c6f62]">
          {recipe.summary}
        </p>

        <div className="space-y-6">
          <section>
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold tracking-wide text-[#b9420b]">
              <span className="text-base">🥦</span>食材与配佐
            </h4>
            <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/70 bg-white/45 p-4 md:grid-cols-2">
              {recipe.ingredients.map((ingredient, index) => (
                <div
                  key={`${ingredient.name}-${index}`}
                  className="flex justify-between border-b border-[#e8dfd5]/45 py-1.5 text-xs text-[#4d403a] last:border-b-0"
                >
                  <span>{ingredient.name}</span>
                  <span className="font-semibold text-[#FF6321]">{ingredient.quantity}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold tracking-wide text-[#b9420b]">
              <span className="text-base">🍳</span>制作步骤
            </h4>
            <div className="space-y-3">
              {recipe.steps.map((step, index) => (
                <div
                  key={`${step.number}-${index}`}
                  className="flex gap-3 rounded-xl border border-white/60 bg-white/40 p-3.5 text-xs"
                >
                  <span className="shrink-0 font-mono text-sm font-bold leading-none text-[#FF6321]">
                    {step.number}.
                  </span>
                  <span className="leading-relaxed text-[#4d403a]">{step.text}</span>
                </div>
              ))}
            </div>
          </section>

          {recipe.tips.length > 0 && (
            <section className="rounded-2xl border border-[#ffdec9] bg-[#fff3eb]/60 p-4 backdrop-blur-xs">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#c2410c]">
                <span>🌟</span>主厨贴士
              </h4>
              <ul className="space-y-1.5">
                {recipe.tips.map((tip, index) => (
                  <li key={`${tip}-${index}`} className="flex items-start gap-1 text-xs text-[#7c2d12]">
                    <span className="shrink-0 text-[#FF6321]">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[#ebdcd0] pt-4 sm:flex-row">
          <button
            onClick={() => onCopy(recipe)}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#c2410c] transition-colors hover:bg-[#ffedd5]"
          >
            <Copy className="h-4 w-4" />
            <span>复制菜谱</span>
          </button>
          <button
            onClick={() => onCook(recipe)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF6321] py-3 text-sm font-semibold text-white transition-all hover:bg-[#df5813]"
          >
            <ChefHat className="h-4 w-4" />
            <span>立即开始一步步烹饪</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
