"""
阶段 0：最小对话 Agent —— 先把"怎么和 LLM 对话"跑通。
本文件刻意保持最简单，所有进阶（RAG、工具、流式、服务化）都建立在这之上。
核心概念见下方注释 + 陪练讲解。
"""
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # 从 .env 读取密钥，避免硬编码进代码

# OpenAI 兼容客户端：同一个库能接 OpenAI、DeepSeek、通义、智谱……
# 关键参数 base_url 决定连哪个服务 —— 这是"供应商可替换"的设计起点
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
)


def ask(messages: list[dict]) -> str:
    """发送一次对话请求，返回模型文本。
    messages 是字典列表，结构是 agent 的"记忆"载体（详见陪练讲解）。
    """
    resp = client.chat.completions.create(
        model=os.getenv("MODEL_NAME", "gpt-3.5-turbo"),
        messages=messages,
        temperature=0.7,  # 随机性：0 最确定，越高越发散
    )
    return resp.choices[0].message.content


# 对话历史：system 设定角色，后面交替 user / assistant
messages = [
    {"role": "system", "content": "你是一个简洁、准确的中文 AI 助手。"},
]

print("（输入 exit 退出）")
while True:
    user_input = input("你> ")
    if user_input.strip().lower() == "exit":
        break
    messages.append({"role": "user", "content": user_input})
    reply = ask(messages)
    messages.append({"role": "assistant", "content": reply})
    print("AI>", reply)
