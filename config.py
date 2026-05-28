"""
RAG系统配置文件
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any

@dataclass
class RAGConfig:
    """RAG系统配置类"""

    # 路径配置
    data_path: str = "data/C8/cook/dishes"
    index_save_path: str = "./vector_index"

    # 模型配置
    embedding_model: str = "BAAI/bge-small-zh-v1.5"
    llm_model: str = "kimi-k2-0711-preview"

    # 检索配置
    top_k: int = 3

    # 生成配置
    temperature: float = 0.1
    max_tokens: int = 2048

    def __post_init__(self):
        """初始化后的处理"""
        base_dir = Path(__file__).resolve().parent

        if not Path(self.data_path).is_absolute():
            self.data_path = str((base_dir / self.data_path).resolve())

        if not Path(self.index_save_path).is_absolute():
            self.index_save_path = str((base_dir / self.index_save_path).resolve())
    
    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'RAGConfig':
        """从字典创建配置对象"""
        return cls(**config_dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'data_path': self.data_path,
            'index_save_path': self.index_save_path,
            'embedding_model': self.embedding_model,
            'llm_model': self.llm_model,
            'top_k': self.top_k,
            'temperature': self.temperature,
            'max_tokens': self.max_tokens
        }

# 默认配置实例
DEFAULT_CONFIG = RAGConfig()
