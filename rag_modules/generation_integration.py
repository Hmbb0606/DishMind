"""
生成集成模块
"""

import os
import logging
from typing import Dict, Iterable, List, Optional

from langchain_core.documents import Document
from openai import OpenAI

logger = logging.getLogger(__name__)


class GenerationIntegrationModule:
    """生成集成模块 - 负责LLM集成和回答生成"""

    PROVIDER_DEFAULTS: Dict[str, Dict[str, Optional[str]]] = {
        "deepseek": {
            "base_url": "https://api.deepseek.com",
            "api_key_env": "DEEPSEEK_API_KEY",
            "model": "deepseek-v4-flash",
        },
        "moonshot": {
            "base_url": "https://api.moonshot.cn/v1",
            "api_key_env": "MOONSHOT_API_KEY",
            "model": "kimi-k2.5",
        },
        "openai": {
            "base_url": None,
            "api_key_env": "OPENAI_API_KEY",
            "model": "gpt-4.1-mini",
        },
    }

    def __init__(
        self,
        model_name: str = "deepseek-v4-flash",
        temperature: float = 0.1,
        max_tokens: int = 2048,
        provider: str = "deepseek",
        base_url: str = "",
        api_key_env: str = "",
    ):
        """
        初始化生成集成模块

        Args:
            model_name: 模型名称
            temperature: 生成温度
            max_tokens: 最大token数
            provider: 模型提供方
            base_url: OpenAI-compatible接口地址
            api_key_env: API Key对应的环境变量名
        """
        self.provider = provider.lower().strip()
        provider_defaults = self.PROVIDER_DEFAULTS.get(self.provider, {})

        self.model_name = model_name or provider_defaults.get("model") or "deepseek-v4-flash"
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.base_url = base_url.strip() or provider_defaults.get("base_url")
        self.api_key_env = api_key_env.strip() or provider_defaults.get("api_key_env") or "LLM_API_KEY"

        self.client: Optional[OpenAI] = None
        self.setup_llm()

    def setup_llm(self):
        """初始化大语言模型客户端"""
        logger.info(
            "正在初始化LLM provider=%s model=%s base_url=%s",
            self.provider,
            self.model_name,
            self.base_url or "OpenAI默认地址",
        )

        api_key = os.getenv(self.api_key_env)
        if not api_key:
            raise ValueError(f"请设置 {self.api_key_env} 环境变量")

        client_kwargs = {"api_key": api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url

        self.client = OpenAI(**client_kwargs)
        logger.info("LLM初始化完成")

    def generate_basic_answer(self, query: str, context_docs: List[Document]) -> str:
        """生成基础回答"""
        context = self._build_context(context_docs)
        prompt = f"""你是一位专业的烹饪助手。请根据以下食谱信息回答用户的问题。

用户问题: {query}

相关食谱信息:
{context}

请提供详细、实用的回答。如果信息不足，请诚实说明。

回答:"""
        return self._invoke(prompt)

    def generate_step_by_step_answer(self, query: str, context_docs: List[Document]) -> str:
        """生成分步骤回答"""
        context = self._build_context(context_docs)
        prompt = f"""你是一位专业的烹饪导师。请根据食谱信息，为用户提供详细的分步骤指导。

用户问题: {query}

相关食谱信息:
{context}

请灵活组织回答，建议包含以下部分（可根据实际内容调整）：

## 菜品介绍
[简要介绍菜品特点和难度]

## 所需食材
[列出主要食材和用量]

## 制作步骤
[详细的分步骤说明，每步包含具体操作和大概所需时间]

## 制作技巧
[仅在有实用技巧时包含。优先使用原文中的实用技巧，如果原文的"附加内容"与烹饪无关或为空，可以基于制作步骤总结关键要点，或者完全省略此部分]

注意：
- 根据实际内容灵活调整结构
- 不要强行填充无关内容或重复制作步骤中的信息
- 重点突出实用性和可操作性
- 如果没有额外的技巧要分享，可以省略制作技巧部分

回答:"""
        return self._invoke(prompt)

    def query_rewrite(self, query: str) -> str:
        """智能查询重写"""
        prompt = f"""你是一个智能查询分析助手。请分析用户的查询，判断是否需要重写以提高食谱搜索效果。

原始查询: {query}

分析规则：
1. 具体明确的查询（直接返回原查询）：
   - 包含具体菜品名称：如"宫保鸡丁怎么做"、"红烧肉的制作方法"
   - 明确的制作询问：如"蛋炒饭需要什么食材"、"糖醋排骨的步骤"
   - 具体的烹饪技巧：如"如何炒菜不粘锅"、"怎样调制糖醋汁"

2. 模糊不清的查询（需要重写）：
   - 过于宽泛：如"做菜"、"有什么好吃的"、"推荐个菜"
   - 缺乏具体信息：如"川菜"、"素菜"、"简单的"
   - 口语化表达：如"想吃点什么"、"有饮品推荐吗"

重写原则：
- 保持原意不变
- 增加相关烹饪术语
- 优先推荐简单易做的
- 保持简洁性

示例：
- "做菜" → "简单易做的家常菜谱"
- "有饮品推荐吗" → "简单饮品制作方法"
- "推荐个菜" → "简单家常菜推荐"
- "川菜" → "经典川菜菜谱"
- "宫保鸡丁怎么做" → "宫保鸡丁怎么做"
- "红烧肉需要什么食材" → "红烧肉需要什么食材"

请输出最终查询（如果不需要重写就返回原查询）:"""

        response = self._invoke(prompt).strip()
        if response != query:
            logger.info("查询已重写: '%s' → '%s'", query, response)
        else:
            logger.info("查询无需重写: '%s'", query)
        return response

    def query_router(self, query: str) -> str:
        """根据查询类型选择处理方式"""
        prompt = f"""根据用户的问题，将其分类为以下三种类型之一：

1. list - 用户想要获取菜品列表或推荐，只需要菜名
   例如：推荐几个素菜、有什么川菜、给我3个简单的菜

2. detail - 用户想要具体的制作方法或详细信息
   例如：宫保鸡丁怎么做、制作步骤、需要什么食材

3. general - 其他一般性问题
   例如：什么是川菜、制作技巧、营养价值

请只返回分类结果：list、detail 或 general

用户问题: {query}

分类结果:"""

        result = self._invoke(prompt).strip().lower()
        if result in ["list", "detail", "general"]:
            return result
        return "general"

    def generate_list_answer(self, query: str, context_docs: List[Document]) -> str:
        """生成列表式回答"""
        if not context_docs:
            return "抱歉，没有找到相关的菜品信息。"

        dish_names = []
        for doc in context_docs:
            dish_name = doc.metadata.get("dish_name", "未知菜品")
            if dish_name not in dish_names:
                dish_names.append(dish_name)

        if len(dish_names) == 1:
            return f"为您推荐：{dish_names[0]}"
        if len(dish_names) <= 3:
            return "为您推荐以下菜品：\n" + "\n".join(
                [f"{i + 1}. {name}" for i, name in enumerate(dish_names)]
            )
        return (
            "为您推荐以下菜品：\n"
            + "\n".join([f"{i + 1}. {name}" for i, name in enumerate(dish_names[:3])])
            + f"\n\n还有其他 {len(dish_names) - 3} 道菜品可供选择。"
        )

    def generate_basic_answer_stream(self, query: str, context_docs: List[Document]):
        """生成基础回答 - 流式输出"""
        context = self._build_context(context_docs)
        prompt = f"""你是一位专业的烹饪助手。请根据以下食谱信息回答用户的问题。

用户问题: {query}

相关食谱信息:
{context}

请提供详细、实用的回答。如果信息不足，请诚实说明。

回答:"""
        yield from self._invoke_stream(prompt)

    def generate_step_by_step_answer_stream(self, query: str, context_docs: List[Document]):
        """生成详细步骤回答 - 流式输出"""
        context = self._build_context(context_docs)
        prompt = f"""你是一位专业的烹饪导师。请根据食谱信息，为用户提供详细的分步骤指导。

用户问题: {query}

相关食谱信息:
{context}

请灵活组织回答，建议包含以下部分（可根据实际内容调整）：

## 菜品介绍
[简要介绍菜品特点和难度]

## 所需食材
[列出主要食材和用量]

## 制作步骤
[详细的分步骤说明，每步包含具体操作和大概所需时间]

## 制作技巧
[仅在有实用技巧时包含。如果原文的"附加内容"与烹饪无关或为空，可以基于制作步骤总结关键要点，或者完全省略此部分]

注意：
- 根据实际内容灵活调整结构
- 不要强行填充无关内容
- 重点突出实用性和可操作性

回答:"""
        yield from self._invoke_stream(prompt)

    def _invoke(self, prompt: str) -> str:
        """发送一次非流式聊天请求"""
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "system", "content": "你是一个严谨、实用的中文烹饪助手。"}, {"role": "user", "content": prompt}],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stream=False,
        )
        return self._extract_response_content(response)

    def _invoke_stream(self, prompt: str) -> Iterable[str]:
        """发送一次流式聊天请求"""
        stream = self.client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "system", "content": "你是一个严谨、实用的中文烹饪助手。"}, {"role": "user", "content": prompt}],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            stream=True,
        )

        for chunk in stream:
            for choice in getattr(chunk, "choices", []) or []:
                delta = getattr(choice, "delta", None)
                content = getattr(delta, "content", None)
                if content:
                    yield content

    def _extract_response_content(self, response) -> str:
        """兼容不同SDK返回格式，提取文本内容"""
        if not getattr(response, "choices", None):
            return ""

        message = response.choices[0].message
        content = getattr(message, "content", "")

        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts = []
            for item in content:
                text = getattr(item, "text", None)
                if text:
                    parts.append(text)
                elif isinstance(item, dict) and item.get("text"):
                    parts.append(item["text"])
            return "".join(parts).strip()

        return str(content).strip()

    def _build_context(self, docs: List[Document], max_length: int = 2000) -> str:
        """构建上下文字符串"""
        if not docs:
            return "暂无相关食谱信息。"

        context_parts = []
        current_length = 0

        for i, doc in enumerate(docs, 1):
            metadata_info = f"【食谱 {i}】"
            if "dish_name" in doc.metadata:
                metadata_info += f" {doc.metadata['dish_name']}"
            if "category" in doc.metadata:
                metadata_info += f" | 分类: {doc.metadata['category']}"
            if "difficulty" in doc.metadata:
                metadata_info += f" | 难度: {doc.metadata['difficulty']}"

            doc_text = f"{metadata_info}\n{doc.page_content}\n"
            if current_length + len(doc_text) > max_length:
                break

            context_parts.append(doc_text)
            current_length += len(doc_text)

        return "\n" + "=" * 50 + "\n".join(context_parts)
