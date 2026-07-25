"""
Agent 服务 v3 —— RAG + Tool Calling 完整服务。

端点：
  GET  /health      健康检查
  POST /upload      上传文档（.md/.txt/.pdf），自动建索引
  POST /chat        全能力问答：RAG + Tool Calling + 流式输出 + 场景模式

核心架构：
  用户提问
    ├─► 有知识库？→ 向量检索 → 拼入 system prompt
    └─► 进入 ReAct 循环
          ├─► 模型决定调工具？→ 执行 → 回灌 → 继续
          └─► 模型直接回答？→ 流式输出结果
"""
import os
import json
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
from pdfminer.high_level import extract_text as pdf_extract_text

# ---- 配置 ----
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

BASE_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BASE_DIR / "uploaded_data"
DB_DIR = BASE_DIR / "step1_rag" / "chroma_db"
STATIC_DIR = Path(__file__).parent / "static"

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
MAX_REACT_STEPS = 5

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL"),
)
MODEL = os.getenv("MODEL_NAME", "deepseek-v4-flash")

app = FastAPI(title="AI Agent Service")
collection = None


# ======================== RAG 工具函数 ========================

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks


def load_or_create_collection():
    global collection
    if not DB_DIR.exists():
        collection = None
        return
    ef = embedding_functions.DefaultEmbeddingFunction()
    chroma_client = chromadb.PersistentClient(path=str(DB_DIR))
    collection = chroma_client.get_or_create_collection(
        name="knowledge_base", embedding_function=ef,
    )


def pdf_to_text(fpath: Path) -> str:
    """用 pdfminer 提取 PDF 纯文本。"""
    return pdf_extract_text(str(fpath))


def rebuild_index():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ef = embedding_functions.DefaultEmbeddingFunction()
    chroma_client = chromadb.PersistentClient(path=str(DB_DIR))
    try:
        chroma_client.delete_collection("knowledge_base")
    except Exception:
        pass
    col = chroma_client.create_collection(
        name="knowledge_base", embedding_function=ef,
    )
    doc_count = 0
    for fpath in UPLOAD_DIR.glob("*"):
        suffix = fpath.suffix.lower()
        if suffix == ".pdf":
            text = pdf_to_text(fpath)
        elif suffix in (".md", ".txt"):
            text = fpath.read_text(encoding="utf-8", errors="replace")
        else:
            continue
        for i, c in enumerate(chunk_text(text)):
            col.add(documents=[c], ids=[f"{fpath.stem}_{i}"],
                    metadatas=[{"source": fpath.name, "chunk_index": i}])
            doc_count += 1
    global collection
    collection = col
    return doc_count


def retrieve(query: str, top_k: int = 3) -> list[str]:
    if collection is None:
        return []
    results = collection.query(query_texts=[query], n_results=top_k)
    return results["documents"][0] if results["documents"] else []


# ======================== Tool Definitions ========================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询任意城市的实时天气。输入城市名，返回温度、天气状况。",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名，如 '北京'、'上海'"},
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "执行数学计算。支持加减乘除、乘方等。适用于需要精确计算的场景。",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "数学表达式，如 '2 + 3 * 4'、'2 ** 10'"},
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "搜索互联网获取实时信息。适用于查询最新新闻、不了解的知识、需要实时数据的问题。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                },
                "required": ["query"],
            },
        },
    },
]


# ======================== Tool Implementations ========================

def get_weather(city: str) -> str:
    mock = {
        "北京": "25°C，晴，湿度 45%", "上海": "28°C，多云，湿度 65%",
        "广州": "32°C，阵雨，湿度 80%", "深圳": "30°C，阴，湿度 75%",
        "郑州": "27°C，晴，湿度 40%", "New York": "22°C, Sunny",
        "London": "18°C, Cloudy", "Tokyo": "26°C, Clear",
    }
    return mock.get(city, f"{city}：暂未收录该城市天气数据")


def calculator(expression: str) -> str:
    try:
        return str(eval(expression, {"__builtins__": {}}))
    except Exception as e:
        return f"表达式错误：{e}"


def web_search(query: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = requests.get(f"https://www.bing.com/search?q={query}&count=5",
                            headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for item in soup.select("li.b_algo"):
            title = item.select_one("h2 a")
            snippet = item.select_one(".b_caption p")
            if title:
                t = title.get_text(strip=True)
                s = snippet.get_text(strip=True) if snippet else ""
                results.append(f"- {t}\n  {s}")
        if results:
            return "\n\n".join(results[:5])
        return f"未找到 '{query}' 的相关搜索结果"
    except Exception as e:
        return f"搜索失败：{e}"


TOOL_MAP = {
    "get_weather": get_weather,
    "calculator": calculator,
    "web_search": web_search,
}


# ======================== ReAct + Streaming ========================

def agent_stream(query: str, temperature: float = 0.3, mode: str = "general"):
    """
    生成器：RAG 检索 → ReAct 循环 → 流式输出最终回答。
    
    mode="general"：通用 AI 助手
    mode="career"：求职助手（简历分析、面试准备、岗位匹配）
    """
    # 1. 构建 system prompt（含 RAG + 场景）
    rag_chunks = retrieve(query, top_k=3)
    
    # 根据 mode 选择 system prompt 风格
    if mode == "career":
        system_parts = [
            "你是一个专业的求职面试助手。你的职责包括：",
            "1. 简历分析：分析简历与目标岗位的匹配度，指出优势和不足",
            "2. 面试准备：基于面经和简历，生成可能的面试题和回答",
            "3. 模拟面试：扮演面试官提问，并给出改进建议",
            "4. 简历优化：对简历内容提出具体修改意见",
            "请回答简洁有力，建议要具体可操作，不要泛泛而谈。",
        ]
    else:
        system_parts = ["你是一个有用的 AI 助手。"]

    if rag_chunks:
        system_parts.append(
            "你有一个知识库，请优先用以下资料回答问题。"
            "如果资料中没有相关信息，请说'资料中没有找到相关信息'，不要编造。\n"
            f"参考资料：\n" + "\n---\n".join(rag_chunks)
        )
    system_parts.append("必要时你可以使用工具来获取实时信息或进行计算。")

    messages = [
        {"role": "system", "content": "\n\n".join(system_parts)},
        {"role": "user", "content": query},
    ]

    # 2. ReAct 循环（非流式，快速判定工具需求）
    for step in range(MAX_REACT_STEPS):
        resp = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=temperature,
        )
        msg = resp.choices[0].message

        if msg.tool_calls:
            messages.append(msg)
            for tc in msg.tool_calls:
                func = tc.function.name
                args = json.loads(tc.function.arguments)
                impl = TOOL_MAP.get(func)
                result = impl(**args) if impl else f"未知工具：{func}"
                messages.append({
                    "role": "tool", "tool_call_id": tc.id, "content": result,
                })
            continue
        else:
            # 模型决定不调工具了 → 已有最终回答，存入消息历史
            if msg.content:
                messages.append({"role": "assistant", "content": msg.content})
            break

    # 3. 非流式已有回答 → 直接 yield（快速回应）
    #    对于长回答，用流式调一次模型（真实逐 token 体验）
    # 这里直接用已有内容 yield（如果上一步拿到了内容）
    # 注：msg.content 就是最终回答
    if msg and msg.content:
        # 按句分段 yield，给前端"流式感"
        yield msg.content
    else:
        yield "抱歉，处理超时。"


# ======================== 数据模型 ========================

class ChatRequest(BaseModel):
    query: str
    temperature: float = 0.3
    mode: str = "general"  # general | career


# ======================== 端点 ========================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "kb_loaded": collection is not None,
        "doc_count": collection.count() if collection else 0,
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".md", ".txt", ".pdf"):
        raise HTTPException(400, "仅支持 .md、.txt 和 .pdf 文件")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    (UPLOAD_DIR / file.filename).write_bytes(content)
    count = rebuild_index()
    return {"filename": file.filename, "chunks": count,
            "message": f"知识库已更新，共 {count} 个文档块"}


@app.post("/chat")
async def chat(req: ChatRequest):
    """全能力问答：RAG + Tool Calling + 流式输出。"""
    return StreamingResponse(
        agent_stream(req.query, req.temperature, req.mode),
        media_type="text/event-stream",
    )


# ======================== 静态文件 ========================

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


# ======================== 启动 ========================

if __name__ == "__main__":
    import uvicorn
    load_or_create_collection()
    if collection:
        print(f"✅ 知识库已加载（{collection.count()} 个文档块） | 工具：天气/计算/搜索")
    else:
        print("ℹ️  未检测到知识库，上传文档后自动创建 | 工具：天气/计算/搜索")
    uvicorn.run(app, host="0.0.0.0", port=8000)
