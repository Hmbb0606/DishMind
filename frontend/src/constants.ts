import { Message } from "./types";

export const WELCOME_MESSAGE: Message = {
  id: "welcome-msg",
  role: "assistant",
  content: `### 👩‍🍳 欢迎来到 DishMind 智能美食实验室！

我是您的**智能私人主厨**与**健康饮食顾问**。我可以帮助您：
- 🥘 查询菜谱做法：输入“宫保鸡丁怎么做？”、“佛跳墙的关键步骤是什么？”
- 🥗 推荐搭配方案：输入“推荐几个适合减脂的简单素菜”
- 🥩 核对备料清单：输入“红烧肉需要买些什么食材？”
- 🧊 清理冰箱库存：告诉我现有食材，我会给您匹配做法

直接在下方输入框提问，或点击上方推荐卡片开始。`,
  timestamp: new Date(),
};

export const SUGGESTED_QUERIES = [
  { text: "宫保鸡丁怎么做？", icon: "🍗", label: "经典做法" },
  { text: "推荐几个简单素菜", icon: "🥦", label: "清爽减脂" },
  { text: "红烧肉需要什么食材？", icon: "🥩", label: "食材备料" },
  { text: "冰箱有番茄和冷饭能做什么", icon: "🍚", label: "快手创意" },
];

export const SAVED_RECIPES_STORAGE_KEY = "dishmind_saved_recipes";
