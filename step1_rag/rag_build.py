"""
阶段 1：RAG 知识库构建脚本。
把文档 → 切分 → embedding → 存入 Chroma 向量库。

为什么用 Chroma？
  - 嵌入式（不用启动服务），适合学习和小项目
  - 100% Python，pip install 就完事
  - 面试常问：Chroma vs Pinecone vs Weaviate 区别

为什么用本地 embedding（all-MiniLM-L6-v2）？
  - 免费、离线、不依赖外部 API
  - 面试问点：本地 embedding vs API embedding（OpenAI text-embedding-3-small）
    取舍：成本 vs 质量 vs 隐私
"""
import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions


# ---------- 1. 切分 ----------
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    最简单的按字符数切分 + overlap。
    生产环境会用 RecursiveCharacterTextSplitter（LangChain），
    但原理一样：固定窗口 + 重叠避免切碎关键信息。
    
    面试官：overlap 的作用？
    你答：避免关键句恰好被切分边界切断，保证上下文连贯。
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap  # 重叠部分让边界信息不丢失
    return chunks


# ---------- 2. 构建向量库 ----------
def build_vector_store(doc_dir: str, db_dir: str):
    """
    读取目录下的所有 .md/.txt 文件，切分 → embedding → 存入 Chroma。
    """
    # Chroma 默认使用 all-MiniLM-L6-v2（ONNX 版本），无需额外模型下载账户
    # 第一次运行会自动下载模型文件（~80MB）
    ef = embedding_functions.DefaultEmbeddingFunction()

    # 持久化存储：下次启动无需重建
    client = chromadb.PersistentClient(path=db_dir)
    collection = client.get_or_create_collection(
        name="knowledge_base",
        embedding_function=ef,
    )

    doc_path = Path(doc_dir)
    doc_id = 0
    for fpath in doc_path.glob("*.md"):
        text = fpath.read_text(encoding="utf-8")
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            collection.add(
                documents=[chunk],
                ids=[f"{fpath.stem}_{i}"],
                metadatas=[{"source": fpath.name, "chunk_index": i}],
            )
            doc_id += 1

    print(f"✅ 已构建完成，共 {doc_id} 个文档块")
    print(f"   向量库位置: {db_dir}")


if __name__ == "__main__":
    # 项目根目录
    base = Path(__file__).parent
    build_vector_store(
        doc_dir=str(base / "data"),
        db_dir=str(base / "chroma_db"),
    )
