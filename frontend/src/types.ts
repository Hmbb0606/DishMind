export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  // If the message contains a parsed recipe, keep its structure here
  parsedRecipe?: ParsedRecipe;
}

export interface Ingredient {
  name: string;
  quantity: string;
  checked?: boolean;
}

export interface RecipeStep {
  number: number;
  text: string;
  completed?: boolean;
  timerSeconds?: number; // Detected duration if specified (e.g. "焖煮20分钟" -> 1200s)
}

export interface ParsedRecipe {
  title: string;
  summary: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tips: string[];
}

export interface SavedRecipe {
  id: string;
  title: string;
  summary: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tips: string[];
  savedAt: string;
}

export interface PresetMood {
  id: string;
  title: string;
  emoji: string;
  prompt: string;
  description: string;
  colorClass: string;
}
