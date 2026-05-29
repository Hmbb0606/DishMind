"""
索引构建模块
"""

import logging
import os
import json
import hashlib
from typing import Dict, List, Optional
from pathlib import Path

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

class IndexConstructionModule:
    """索引构建模块 - 负责向量化和索引构建"""

    def __init__(self, model_name: str = "BAAI/bge-small-zh-v1.5", index_save_path: str = "./vector_index"):
        """
        初始化索引构建模块

        Args:
            model_name: 嵌入模型名称
            index_save_path: 索引保存路径
        """
        self.model_name = model_name
        self.index_save_path = index_save_path
        self.embeddings = None
        self.vectorstore = None
        self.setup_embeddings()

    @property
    def manifest_path(self) -> Path:
        """索引元数据清单文件路径"""
        return Path(self.index_save_path) / "manifest.json"
    
    def setup_embeddings(self):
        """初始化嵌入模型"""
        logger.info(f"正在初始化嵌入模型: {self.model_name}")

        model_path = Path(self.model_name).expanduser()
        resolved_model_name = str(model_path.resolve()) if model_path.exists() else self.model_name

        if model_path.exists():
            logger.info(f"检测到本地嵌入模型目录: {resolved_model_name}")
        elif os.getenv("HF_ENDPOINT"):
            logger.info(f"当前使用 Hugging Face 镜像: {os.getenv('HF_ENDPOINT')}")

        try:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=resolved_model_name,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
        except Exception as e:
            raise RuntimeError(
                "嵌入模型初始化失败。"
                " 如果当前网络无法访问 huggingface.co，可在项目 .env 中设置 "
                "HF_ENDPOINT=https://hf-mirror.com；"
                " 或者先把 BAAI/bge-small-zh-v1.5 下载到本地，再把 config.py 里的 "
                "embedding_model 改成本地目录路径。"
                f" 原始错误: {e}"
            ) from e
        
        logger.info("嵌入模型初始化完成")
    
    def build_vector_index(self, chunks: List[Document]) -> FAISS:
        """
        构建向量索引
        
        Args:
            chunks: 文档块列表
            
        Returns:
            FAISS向量存储对象
        """
        logger.info("正在构建FAISS向量索引...")
        
        if not chunks:
            raise ValueError("文档块列表不能为空")
        
        # 构建FAISS向量存储
        self.vectorstore = FAISS.from_documents(
            documents=chunks,
            embedding=self.embeddings
        )
        
        logger.info(f"向量索引构建完成，包含 {len(chunks)} 个向量")
        return self.vectorstore
    
    def add_documents(self, new_chunks: List[Document]):
        """
        向现有索引添加新文档
        
        Args:
            new_chunks: 新的文档块列表
        """
        if not self.vectorstore:
            raise ValueError("请先构建向量索引")
        
        logger.info(f"正在添加 {len(new_chunks)} 个新文档到索引...")
        self.vectorstore.add_documents(new_chunks)
        logger.info("新文档添加完成")

    def build_index_metadata(self, chunks: List[Document], data_path: str) -> Dict[str, object]:
        """
        为当前索引构建可比较的元数据，用于判断旧索引是否过期
        """
        source_signatures = []
        for chunk in chunks:
            source = chunk.metadata.get("source", "")
            parent_id = chunk.metadata.get("parent_id", "")
            chunk_index = chunk.metadata.get("chunk_index", -1)
            source_signatures.append(f"{source}|{parent_id}|{chunk_index}")

        source_signatures.sort()
        fingerprint = hashlib.md5("\n".join(source_signatures).encode("utf-8")).hexdigest()

        return {
            "embedding_model": self.model_name,
            "data_path": str(Path(data_path).resolve()),
            "document_count": len({chunk.metadata.get("parent_id") for chunk in chunks}),
            "chunk_count": len(chunks),
            "fingerprint": fingerprint,
        }

    def save_index(self, metadata: Optional[Dict[str, object]] = None):
        """
        保存向量索引到配置的路径
        """
        if not self.vectorstore:
            raise ValueError("请先构建向量索引")

        # 确保保存目录存在
        Path(self.index_save_path).mkdir(parents=True, exist_ok=True)

        self.vectorstore.save_local(self.index_save_path)
        if metadata is not None:
            self.manifest_path.write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        logger.info(f"向量索引已保存到: {self.index_save_path}")
    
    def load_index(self, expected_metadata: Optional[Dict[str, object]] = None):
        """
        从配置的路径加载向量索引

        Returns:
            加载的向量存储对象，如果加载失败返回None
        """
        if not self.embeddings:
            self.setup_embeddings()

        if not Path(self.index_save_path).exists():
            logger.info(f"索引路径不存在: {self.index_save_path}，将构建新索引")
            return None

        if expected_metadata is not None:
            manifest = self._load_manifest()
            if manifest != expected_metadata:
                logger.info("检测到索引清单与当前数据不匹配，将重建索引")
                return None

        try:
            self.vectorstore = FAISS.load_local(
                self.index_save_path,
                self.embeddings,
                allow_dangerous_deserialization=True
            )
            logger.info(f"向量索引已从 {self.index_save_path} 加载")
            return self.vectorstore
        except Exception as e:
            logger.warning(f"加载向量索引失败: {e}，将构建新索引")
            return None

    def _load_manifest(self) -> Optional[Dict[str, object]]:
        """加载索引清单"""
        if not self.manifest_path.exists():
            return None

        try:
            return json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"读取索引清单失败: {e}")
            return None
    
    def similarity_search(self, query: str, k: int = 5) -> List[Document]:
        """
        相似度搜索
        
        Args:
            query: 查询文本
            k: 返回结果数量
            
        Returns:
            相似文档列表
        """
        if not self.vectorstore:
            raise ValueError("请先构建或加载向量索引")
        
        return self.vectorstore.similarity_search(query, k=k)
