"""
阶段 2：Tool Calling —— 让 agent 拥有"双手"。

核心概念：ReAct（Reasoning + Acting）循环
  1. 用户提问
  2. 模型判断是否需要调用工具
  3. 需要 → 返回 tool_calls（哪个工具 + 参数）
  4. 服务端执行函数，拿到结果
  5. 把结果回灌给模型
  6. 模型基于结果生成最终回答（或再次调用工具）
  7. 不需要 → 直接回答

面试官：为什么叫 Tool Calling 不叫 Function Calling？
你答：OpenAI 在 2024 年把 API 里的 function calling 改名为 tool calling，
      因为除了函数，还支持 web_search、code_interpreter 等内置工具。
      统一叫"工具"更通用。
"""
import os
import json
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).parent.parent / "step0_basics" / ".env")

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL"),
)
MODEL = os.getenv("MODEL_NAME", "deepseek-v4-flash")

# ======================== 1. 定义工具 ========================

# 每个工具 = JSON Schema 描述 + 一个 Python 函数
# Schema 的 description 字段非常关键——模型靠它决定什么时候选哪个工具

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询任意城市的实时天气。输入城市名，返回温度、天气状况。",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名，如 '北京'、'上海'、'New York'",
                    }
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
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，如 '2 + 3 * 4'、'2 ** 10'、'(15 + 7) / 2'",
                    }
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
                    "query": {
                        "type": "string",
                        "description": "搜索关键词，如 '2026年NBA总冠军'、'最新AI新闻'",
                    }
                },
                "required": ["query"],
            },
        },
    },
]


# ======================== 2. 工具实现 ========================

def get_weather(city: str) -> str:
    """模拟查询天气（生产环境替换为真实 API 调用）。"""
    # 模拟数据：实际开发中调 openweathermap / 和风天气 等 API
    mock_data = {
        "北京": "25°C，晴，湿度 45%",
        "上海": "28°C，多云，湿度 65%",
        "广州": "32°C，阵雨，湿度 80%",
        "深圳": "30°C，阴，湿度 75%",
        "郑州": "27°C，晴，湿度 40%",
        "New York": "22°C, Sunny, Humidity 50%",
        "London": "18°C, Cloudy, Humidity 70%",
        "Tokyo": "26°C, Clear, Humidity 55%",
    }
    return mock_data.get(city, f"{city}：暂未收录该城市天气数据")


def calculator(expression: str) -> str:
    """安全执行数学计算。"""
    # 限制 __builtins__ 为空，防止任意代码执行（安全常识）
    try:
        result = eval(expression, {"__builtins__": {}})
        return str(result)
    except Exception as e:
        return f"表达式错误：{e}"


def web_search(query: str) -> str:
    """搜索 Bing 获取实时信息（国内可访问，无 API key 要求）。"""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        resp = requests.get(
            f"https://www.bing.com/search?q={query}&count=5",
            headers=headers,
            timeout=10,
        )
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
        else:
            return f"未找到 '{query}' 的相关搜索结果"
    except Exception as e:
        return f"搜索失败：{e}"


# 工具名称 → 实现函数的映射表
TOOL_IMPL = {
    "get_weather": get_weather,
    "calculator": calculator,
    "web_search": web_search,
}


# ======================== 3. ReAct 循环 ========================

def run_agent(user_input: str, max_steps: int = 5) -> str:
    """
    ReAct 循环：
      模型思考 → 决定调工具或回答 → 若调工具则执行并回灌 → 重复
    """
    messages = [
        {"role": "system", "content": "你是一个有帮助的 AI 助手，必要时会使用工具来获取信息或进行计算。"},
        {"role": "user", "content": user_input},
    ]

    for step in range(max_steps):
        print(f"\n  [ReAct Step {step + 1}] 调用模型...")

        resp = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,          # ← 关键参数：告诉模型有哪些工具可用
            tool_choice="auto",   # ← 让模型自己决定是否调工具
            temperature=0.3,
        )

        msg = resp.choices[0].message

        # 情况 A：模型决定调用工具
        if msg.tool_calls:
            # 先把模型的 tool_calls 请求追加到消息历史
            messages.append(msg)

            for tc in msg.tool_calls:
                func_name = tc.function.name
                args = json.loads(tc.function.arguments)
                print(f"  → 调用工具：{func_name}({args})")

                # 执行函数
                impl = TOOL_IMPL.get(func_name)
                if impl:
                    result = impl(**args)
                else:
                    result = f"错误：未找到工具 {func_name}"

                print(f"  ← 工具返回：{result[:60]}...")

                # 把工具执行结果回灌给模型（role="tool"）
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

            # 继续循环，让模型基于工具结果生成回答（或再调工具）
            continue

        # 情况 B：模型直接回答了（没有 tool_calls）
        answer = msg.content
        print(f"  ✓ 模型生成回答")
        return answer

    return "已达到最大重试次数，请重试。"


# ======================== 4. 交互演示 ========================

if __name__ == "__main__":
    print("=" * 50)
    print("Tool Calling Agent（输入 exit 退出）")
    print("=" * 50)
    print("可用工具：get_weather（查天气）、calculator（数学计算）、web_search（搜索互联网）")
    print()

    while True:
        user_input = input("你 > ")
        if user_input.strip().lower() == "exit":
            break
        answer = run_agent(user_input)
        print(f"\n🤖 {answer}\n")
