import { ParsedRecipe, Ingredient, RecipeStep } from "../types";

/**
 * Clean title to strip markdown headings and emojis (e.g., "### 🥬 食材清单" -> "食材清单")
 */
function cleanHeading(line: string): string {
  return line
    .replace(/^#+\s*/, "") // Remove #
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "") // Remove emojis
    .trim();
}

/**
 * Attempt to extract timer seconds from step text (e.g., "小火慢炖 30 分钟" -> 1800)
 */
function extractTimerFromText(text: string): number | undefined {
  // Matches "30分钟", "15 分钟", "5分钟" etc.
  const minutePattern = /(\d+)\s*分(钟||)/;
  const match = text.match(minutePattern);
  if (match) {
    const minutes = parseInt(match[1], 10);
    if (!isNaN(minutes) && minutes > 0 && minutes <= 180) {
      return minutes * 60;
    }
  }
  
  // For shorter actions: "大火收汁 30 秒" -> 30s
  const secondPattern = /(\d+)\s*秒/;
  const secondMatch = text.match(secondPattern);
  if (secondMatch) {
    const seconds = parseInt(secondMatch[1], 10);
    if (!isNaN(seconds) && seconds > 0) {
      return seconds;
    }
  }
  return undefined;
}

function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isMarkdownTableDivider(line: string): boolean {
  return /^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(line.trim());
}

function parseMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map(cell => cell.trim());
}

function parseIngredientLine(line: string): Ingredient | null {
  const normalizedLine = line.replace(/^[\-\*\+]\s*/, "").trim();
  if (!normalizedLine) return null;

  let name = normalizedLine;
  let quantity = "适量";

  const parts = normalizedLine.split(/[\s\：\:]+/);
  if (parts.length >= 2) {
    name = parts.slice(0, -1).join(" ");
    quantity = parts[parts.length - 1];
  } else {
    const spaceIdx = normalizedLine.search(/[\s\d]/);
    if (spaceIdx > 0) {
      name = normalizedLine.substring(0, spaceIdx).trim();
      quantity = normalizedLine.substring(spaceIdx).trim();
    }
  }

  if (!name || name.includes("●") || name.includes("食材名称") || name.length >= 30) {
    return null;
  }

  return {
    name,
    quantity,
    checked: false
  };
}

export function parseRecipeText(rawText: string, defaultTitle: string = "智能推荐食谱"): ParsedRecipe | null {
  if (!rawText) return null;

  // Let's check if the text looks like a recipe. If it has no ingredients/steps identifiers, return null.
  const hasIngredients = rawText.includes("食材") || rawText.includes("备料") || rawText.includes("准备");
  const hasSteps = rawText.includes("步骤") || rawText.includes("做法") || rawText.includes("制作");
  
  if (!hasIngredients && !hasSteps) {
    return null;
  }

  const lines = rawText.split("\n");
  
  let currentSection = "";
  let title = defaultTitle;
  let summaryParts: string[] = [];
  const ingredients: Ingredient[] = [];
  const steps: RecipeStep[] = [];
  const tips: string[] = [];

  // Try to find if there is a primary dish title in the first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.startsWith("# ") || (line.startsWith("## ") && !line.includes("食材") && !line.includes("步骤") && !line.includes("秘诀"))) {
      title = cleanHeading(line);
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect heading switches
    if (line.startsWith("###") || line.startsWith("##")) {
      const cleaned = cleanHeading(line);
      
      if (cleaned.includes("简述") || cleaned.includes("介绍") || cleaned.includes("特点")) {
        currentSection = "summary";
      } else if (cleaned.includes("食材") || cleaned.includes("配料") || cleaned.includes("准备") || cleaned.includes("备料")) {
        currentSection = "ingredients";
      } else if (cleaned.includes("步骤") || cleaned.includes("制作") || cleaned.includes("做法") || cleaned.includes("过程")) {
        currentSection = "steps";
      } else if (cleaned.includes("秘诀") || cleaned.includes("窍门") || cleaned.includes("贴士") || cleaned.includes("注意") || cleaned.includes("提示")) {
        currentSection = "tips";
      } else {
        // Unknown heading, check if it's more general
        currentSection = "other";
      }
      continue;
    }

    // Process line according to active section
    if (currentSection === "summary") {
      summaryParts.push(line);
    } else if (currentSection === "ingredients") {
      if (isMarkdownTableLine(line)) {
        const tableLines = [line];
        while (i + 1 < lines.length && isMarkdownTableLine(lines[i + 1].trim())) {
          tableLines.push(lines[i + 1].trim());
          i += 1;
        }

        if (tableLines.length >= 2 && isMarkdownTableDivider(tableLines[1])) {
          const headers = parseMarkdownTableRow(tableLines[0]);
          const nameIndex = headers.findIndex(header => header.includes("食材") || header.includes("配料") || header.includes("名称"));
          const quantityIndex = headers.findIndex(header => header.includes("数量") || header.includes("用量"));

          tableLines.slice(2).forEach(rowLine => {
            const row = parseMarkdownTableRow(rowLine);
            const name = nameIndex >= 0 ? row[nameIndex] : row[0];
            const quantity = quantityIndex >= 0 ? row[quantityIndex] : row[1];
            if (name && quantity) {
              ingredients.push({
                name,
                quantity,
                checked: false
              });
            }
          });
        }
        continue;
      }

      const ingredient = parseIngredientLine(line);
      if (ingredient) {
        ingredients.push(ingredient);
      }
    } else if (currentSection === "steps") {
      if (isMarkdownTableLine(line)) {
        // 步骤区如果混入表格，一般属于说明性内容，不作为步骤处理。
        continue;
      }

      // Matches "1. ", "1、", "第1步", "(1)" etc.
      const stepMatch = line.match(/^(\d+)[\.\、\s\)]\s*(.+)$/);
      if (stepMatch) {
        const stepNum = parseInt(stepMatch[1], 10);
        const text = stepMatch[2].trim();
        steps.push({
          number: stepNum,
          text,
          completed: false,
          timerSeconds: extractTimerFromText(text)
        });
      } else if (steps.length > 0 && !line.startsWith("#")) {
        // Append to last step if it's continue text (e.g. multi-line paragraphs)
        steps[steps.length - 1].text += "\n" + line;
      }
    } else if (currentSection === "tips") {
      const listMatch = line.match(/^[\-\*\d\.\、\+]\s*(.+)$/);
      const cleanedTip = listMatch ? listMatch[1].trim() : line;
      if (cleanedTip && cleanedTip.length > 3) {
        tips.push(cleanedTip);
      }
    } else {
      // If no section yet, and the line looks like an intro, treat as general summary
      if (!currentSection && line.length < 150 && !line.startsWith("#")) {
        summaryParts.push(line);
      }
    }
  }

  // Fallback defaults
  if (ingredients.length === 0 && steps.length === 0) {
    return null;
  }

  return {
    title: title || "美味食谱",
    summary: summaryParts.join(" "),
    ingredients,
    steps: steps.sort((a, b) => a.number - b.number),
    tips: tips.length > 0 ? tips : ["慢工出细活，祝您烹饪愉快！"]
  };
}
