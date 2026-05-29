"""
DishMind 前端桥接服务。

通过 stdin/stdout 与 Node 服务通信，复用现有 Python RAG 能力，
避免改动原有检索和生成主流程。
"""

from __future__ import annotations

import contextlib
import json
import sys
from dataclasses import dataclass
from typing import Any, Dict, List

from main import RecipeRAGSystem


FOLLOW_UP_HINTS = (
    "这个",
    "它",
    "上一步",
    "下一步",
    "刚才",
    "上面",
    "这里",
    "为什么",
    "怎么改",
    "还能",
    "可以换",
    "第",
)


def emit(payload: Dict[str, Any]) -> None:
    """向 Node 进程输出一行 JSON。"""
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(message: str) -> None:
    """所有运行日志都写入 stderr，避免污染协议。"""
    sys.stderr.write(message + "\n")
    sys.stderr.flush()


@dataclass
class BridgeRequest:
    """桥接请求。"""

    request_id: str
    message: str
    history: List[Dict[str, str]]

    @classmethod
    def from_payload(cls, payload: Dict[str, Any]) -> "BridgeRequest":
        history = payload.get("history")
        if not isinstance(history, list):
            history = []

        return cls(
            request_id=str(payload.get("id", "")),
            message=str(payload.get("message", "")).strip(),
            history=history,
        )


class RecipeRAGBridge:
    """包装现有 RAG 系统，提供给前端调用。"""

    def __init__(self) -> None:
        self.system = RecipeRAGSystem()

    def initialize(self) -> None:
        with contextlib.redirect_stdout(sys.stderr):
            self.system.initialize_system()
            self.system.build_knowledge_base()

    def answer(self, message: str, history: List[Dict[str, str]]) -> str:
        effective_query = self._build_effective_query(message, history)
        with contextlib.redirect_stdout(sys.stderr):
            result = self.system.ask_question(effective_query, stream=False)
        return result if isinstance(result, str) else "".join(result)

    def _build_effective_query(self, message: str, history: List[Dict[str, str]]) -> str:
        """
        对追问做最小适配。

        不改变原有 RAG 主流程，只在明显依赖上下文的追问里，
        拼接最近几轮对话帮助现有问答逻辑理解指代。
        """
        if not history or not self._looks_like_follow_up(message):
            return message

        recent_turns = history[-4:]
        transcript: List[str] = []
        for turn in recent_turns:
            role = "用户" if turn.get("role") == "user" else "助手"
            content = str(turn.get("content", "")).strip()
            if not content:
                continue
            transcript.append(f"{role}: {content[:400]}")

        if not transcript:
            return message

        return (
            "请结合以下最近对话，理解用户当前追问的指代对象后再回答。\n"
            + "\n".join(transcript)
            + f"\n当前问题: {message}"
        )

    @staticmethod
    def _looks_like_follow_up(message: str) -> bool:
        if len(message) <= 18:
            return True
        return any(hint in message for hint in FOLLOW_UP_HINTS)


def main() -> None:
    bridge = RecipeRAGBridge()

    try:
        bridge.initialize()
        emit({"type": "ready"})
    except Exception as exc:
        log(f"Bridge init failed: {exc}")
        emit({"type": "init_error", "error": str(exc)})
        raise

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request = None
        try:
            request = BridgeRequest.from_payload(json.loads(line))
            if not request.request_id or not request.message:
                raise ValueError("请求缺少 id 或 message")

            answer = bridge.answer(request.message, request.history)
            emit({"id": request.request_id, "ok": True, "text": answer})
        except Exception as exc:
            log(f"Bridge request failed: {exc}")
            emit(
                {
                    "id": request.request_id if request else "",
                    "ok": False,
                    "error": str(exc),
                }
            )


if __name__ == "__main__":
    main()
