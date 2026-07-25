"""
阶段 1：RAG 查询脚本。
用户提问 → embedding → 向量检索 → 拼 prompt → LLM 回答。
这就是"让 agent 读文档再回答"的完整流程，面试必问。
"""
import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions
from openai import OpenAI
from dotenv import load_dotenv

# .env 在 step0_basics 目录下（与本目录同级的 ../step0_basics/.env）
env_path = Path(__file__).parent.parent / "step0_basics" / ".env"
load_dotenv(dotenv_path=str(env_path))

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL"),
)


# ---------- 1. 加载向量库 ----------
def load_vector_store(db_dir: str):
    """加载之前构建好的 Chroma 持久化向量库"""
    ef = embedding_functions.DefaultEmbeddingFunction()
    chroma_client = chromadb.PersistentClient(path=db_dir)
    collection = chroma_client.get_collection(
        name="knowledge_base",
        embedding_function=ef,
    )
    return collection


# ---------- 2. 检索 ----------
def retrieve(collection, query: str, top_k: int = 2) -> list[str]:
    """
    向量检索：用同样的 embedding 模型把用户问题转成向量，
    在向量空间里找最相似的 top_k 个文档块。
    
    面试官：为什么用向量检索，不用关键词（BM25）？
    你答：向量检索能捕捉语义相似——"杜兰特在哪打球"和"KD效力的球队"语义相近，
          但关键词可能匹配不上。生产可两者结合（混合检索）。
    """
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
    )
    return results["documents"][0]


# ---------- 3. 拼 prompt + 生成 ----------
def ask_with_rag(collection, query: str, top_k: int = 2) -> str:
    """
    RAG 全流程：检索 → 拼接 → 生成
    
    检索到的资料拼入 system prompt 的核心原则：
      - 放在 user 问题之前，LLM 先"读资料"再生产
      - 明确告知 LLM "只基于以下资料回答，不知道就说不知道"
        这是降低幻觉的关键策略（面试高频考点）
    """
    chunks = retrieve(collection, query, top_k)

    # 把检索到的文档块拼成一段上下文
    context = "\n---\n".join(chunks)

    messages = [
        {
            "role": "system",
            "content": (
                "你是一个知识库问答助手。请**仅基于以下资料**回答问题。\n"
                "如果资料中没有相关信息，请直接说'资料中没有找到相关信息'，不要编造。\n"
                f"\n参考资料：\n{context}"
            ),
        },
        {"role": "user", "content": query},
    ]

    # 非流式：等完整回答（这里先用同步方便演示）
    resp = client.chat.completions.create(
        model=os.getenv("MODEL_NAME", "deepseek-v4-flash"),
        messages=messages,
        temperature=0.3,  # 事实问答用低温度
    )
    return resp.choices[0].message.content


if __name__ == "__main__":
    base = Path(__file__).parent
    collection = load_vector_store(str(base / "chroma_db"))

    print("RAG 知识库已加载，输入问题（exit 退出）")
    while True:
        query = input("\n提问> ")
        if query.strip().lower() == "exit":
            break
        answer = ask_with_rag(collection, query)
        print(f"\n回答> {answer}")
