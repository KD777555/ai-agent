# AI Agent 项目面试准备手册

---

## 一、项目一句话描述（简历 + 开场用）

> 基于 FastAPI + Chroma + DeepSeek 构建的全链路 AI Agent 服务，支持 RAG 知识库问答与 Tool Calling（天气查询、数学计算、网页搜索），完整实现 ReAct 推理循环，具备流式输出与交互式 Web 界面。

---

## 二、技术栈

| 层 | 技术 | 原因 |
|---|---|---|
| 后端框架 | FastAPI | 异步支持好、自动生成 API 文档、性能高 |
| LLM | DeepSeek API | 便宜、OpenAI 兼容、中文好、长上下文 1M |
| 向量库 | Chroma | 嵌入式（无服务）、Python 原生、适合学习 |
| Embedding | all-MiniLM-L6-v2 (本地 ONNX) | 免费离线、不依赖外部 API |
| 前端 | 纯 HTML/CSS/JS | 无需框架，轻量自包含 |
| 搜索 | Bing + BeautifulSoup | 国内可访问、无需 API key |

---

## 三、项目架构（面试画图用）

```
用户 ──► 前端页面（http://localhost:8000）
              │
              ▼
         FastAPI 服务
              │
        ┌─────┼─────┐
        │     │     │
        ▼     ▼     ▼
      /health /upload /chat
        │     │     │
        │     ▼     ├── RAG 检索（Chroma 向量库）
        │  切分 →   ├── ReAct 循环
        │  Embed   │    ├── 模型决定是否调工具
        │  → 存库  │    ├── 调用外部工具（天气/计算/搜索）
        │          │    └── 生成最终回答
        │          └── 流式输出（SSE）
        ▼
    健康检查
```

---

## 四、各阶段原理 + 面试 Q&A

### 阶段 0：LLM 对话基础

**原理要点：**
- LLM 本质是"预测下一个 token 的统计模型"，不是数据库
- token 是计费/长度单位，中文约 1-2 字 = 1 token
- messages 结构：system（角色设定）→ user（输入）→ assistant（回复，回灌做"记忆"）
- 模型无状态：每次 HTTP 请求独立，客户端维护 messages 列表
- context window 是硬限制（1M tokens），超限需要截断/摘要/RAG
- temperature：0 确定 → 高发散，生产常 0.7

**面试 Q&A：**

Q: token 是什么？成本怎么算？
A: 模型输入输出的最小计费单位，基于子词(BPE)切分。成本 = (输入 tokens + 输出 tokens) × 单价。中文 token 更碎，相同字数比英文更贵。

Q: 模型为什么无状态？怎么做多轮对话？
A: 每次请求独立，服务端不存会话。客户端维护 messages 列表，每轮 append user/assistant 消息后整体重发。

Q: context window 超长怎么办？
A: 三种方案：1) 滑动窗口截断（丢最早的消息）2) 旧消息摘要压缩 3) RAG 外挂知识（只塞相关资料）。生产环境组合使用。

Q: temperature 怎么选？
A: 事实问答（RAG、代码）用 0–0.3；创造性任务用 0.7–0.9；生产默认 0.7。做成可配参数，不同场景不同值。

---

### 阶段 0.5：流式输出（SSE）

**原理要点：**
- SSE（Server-Sent Events）：HTTP 长连接，服务端主动推送事件
- 对比普通请求：等全部生成完才返回 vs 边生成边推送
- StreamingResponse + 同步生成器逐 token yield
- 前端用 fetch + ReadableStream 消费

**面试 Q&A：**

Q: 为什么用流式输出？
A: 用户体验从"卡几秒→啪一段"变成"逐字出现"。产品感的分水岭。技术上让客户端能逐步渲染，降低首字节等待时间。

Q: SSE 和 WebSocket 有什么区别？怎么选？
A: SSE 是服务端→客户端的单向流（HTTP 长连接），WebSocket 是双向全双工。这里只推送文本，不需要客户端往后端推数据，SSE 更轻量、浏览器原生支持 EventSource。

Q: StreamingResponse 的原理？
A: ASGI 流式响应。接受 Python 生成器，每次 yield 一段数据就通过 HTTP 分块传输编码(chunked transfer encoding)立即发回，不断开连接。

---

### 阶段 1：RAG 知识库

**原理要点：**
- RAG（Retrieval-Augmented Generation）：先检索再生成，解决幻觉+知识过时+私域数据
- 流程：文档 → 切分(chunk) → embedding → 存向量库 → 提问 → embedding → 检索 top-k → 拼 prompt → LLM 生成
- Chunk 策略：固定大小 + overlap，避免切碎关键信息
- Embedding：文本→向量，相似句在向量空间距离近，余弦相似度衡量
- System prompt 策略："仅基于资料回答，不知道说不知道"——最简单的防幻觉手段
- 本地 embedding（all-MiniLM-L6-v2） vs API embedding（OpenAI）：免费离线 vs 质量更高

**面试 Q&A：**

Q: RAG 解决了什么问题？
A: LLM 三大缺陷：1) 幻觉（编造答案）2) 知识过时（训练数据有截止日期）3) 不懂私有数据。RAG 给模型"外挂知识库"，让它基于真实资料回答。

Q: 为什么用向量检索，不用关键词（BM25/ES）？
A: 向量检索捕捉语义相似——"KD 效力过哪些球队"和"杜兰特职业生涯"语义相近但关键词不匹配。生产环境可两者结合（混合检索）。

Q: 为什么 system prompt 里加"仅基于资料回答，不知道说不知道"？
A: 不加的话，模型会用训练数据里的知识回答（可能与文档冲突）。加了这个指令后，模型更倾向遵守约束，没有的资料不乱说。这是防幻觉最简单有效的手段。

Q: Chunk 怎么分？overlap 有什么用？
A: 按固定 token/字符数切分（500-1000），加 10-20% overlap。overlap 避免关键句被切分边界"腰斩"。生产用 RecursiveCharacterTextSplitter 按段落/句子/字符逐级降级切。

Q: 本地 embedding vs API embedding 怎么选？
A: 本地（免费离线、隐私好、质量够用 80% 场景）vs API（质量更高、跨语言更好、但花钱+依赖网络）。中小厂先上本地，量大了再加 API 兜底。

---

### 阶段 2：Tool Calling

**原理要点：**
- Tool Calling（原 Function Calling）：模型主动决定要不要调工具、调哪个、参数是什么
- ReAct 循环：模型思考 → 决定调工具或回答 → 若调工具则执行并回灌 → 重复
- Tool Schema：JSON Schema 格式（name, description, parameters），description 决定模型选工具的准确率
- `tool_choice`："auto"（模型决定）、"required"（强制调用）、"none"（不调用）
- 模型不执行函数只请求调用，真正执行在服务端——这是安全边界
- 需要限制 eval 的 __builtins__，防止任意代码执行
- 可设置 max_steps 防止死循环

**面试 Q&A：**

Q: Tool Calling 和普通 API 调用有什么区别？
A: 核心区别在"决策权"——Tool Calling 是模型主动决定调什么、怎么调；普通 API 调用是开发者硬编码调哪个。

Q: ReAct 循环怎么防止死循环？
A: 1) max_steps 上限（我们设 5 步）2) 监控工具结果有效性——同一工具连续调两次且参数一样说明在转圈 3) 记录调用次数，超限中断。

Q: tool schema 的 description 有多重要？
A: 极其重要。模型通过 description 理解"这个工具什么时候用"。写得好不好直接决定 agent 正确率。生产环境需要反复迭代测试。

Q: 怎么保证工具调用的安全性？
A: 三层：1) 模型只请求调用，不执行（安全边界）2) 服务端校验参数合法性 3) 限制执行环境（如 eval 禁用 __builtins__）。

Q: 为什么叫 Tool Calling 不叫 Function Calling？
A: OpenAI 在 2024 年改名，因为除了函数还支持 web_search、code_interpreter 等内置工具。统一叫"工具"更通用。

---

### 阶段 3：RAG + Tool Calling 融合

**原理要点：**
- 架构设计：RAG（静态知识） + Tool Calling（动态能力） → 完整 AI Agent
- 先检索知识库 → 构建 system prompt → 进入 ReAct 循环 → 工具调用 → 生成回答
- 上传/问答分离架构：建索引是离线批量操作，问答是在线高频操作
- 全局 Collection 单例：启动时加载，上传后刷新，问答时直接用

**面试 Q&A：**

Q: RAG 和 Tool Calling 一起用时，怎么避免冲突？
A: 明确分工——RAG 提供静态知识（文档资料），Tool Calling 提供动态能力（实时信息、计算）。系统 prompt 里说明"优先用知识库，必要时调工具"，让模型自主判断。

Q: 为什么上传和问答要分开？
A: 建索引是批量操作（读文件、切分、embedding、存库），耗时长；问答是轻量高频操作（检索+生成），要求低延迟。分开更合理，也可以用消息队列做异步建索引。

Q: collection 为什么要用全局单例？
A: 避免每次请求都重新打开 Chroma 数据库（开销大）。启动时加载一次，上传后更新引用，问答时直接从内存读取。注意线程安全——FastAPI 的请求是异步的，但 Chroma 操作是同步的，需要确保同一时间只有一个请求在修改 collection。

Q: 怎么设计一个"好"的 Agent 架构？
A: 分层设计：1) API 层（FastAPI 端点，处理输入输出）2) 推理层（ReAct 循环，模型决策）3) 工具层（RAG 检索 / 外部工具调用）。每层职责单一，可独立测试和替换。

---

## 五、通用面试题（不限阶段）

**Q：为什么选 DeepSeek 而不是 OpenAI？**
A：① 便宜（Flash 模型 1 元/百万 tokens，约为 GPT-4o 的 1/20）② 中文表现好 ③ 长上下文 1M tokens ④ 国内直接访问、无需梯子。面试官问这个考察"技术选型有成本意识"。

**Q：为什么用 FastAPI 而不是 Flask？**
A：① 原生异步支持（async/await）② 自动生成 OpenAPI 文档 ③ 性能高（基于 Starlette）④ Pydantic 做数据校验。对于需要流式输出、文件上传的 AI 服务，FastAPI 比 Flask 更合适。

**Q：API key 怎么管理的？为什么放 .env 而不是硬编码？**
A：放 .env，用 python-dotenv 加载，.gitignore 排除。硬编码会泄漏到版本控制，不安全。生产环境用密钥管理服务（如云厂商的 Secret Manager）。

**Q：怎么保证服务稳定性？**
A：① 健康检查端点（/health）② 请求超时设置 ③ LLM 调用异常处理 ④ 工具执行异常降级（工具失败返回友好错误，不影响主流程）。

**Q：这个项目还有什么改进空间？**
A：① 异步建索引（上传后后台任务，不阻塞）② 多用户隔离 ③ 混合检索（向量+关键词 BM25）④ Docker 化部署 ⑤ CI/CD 自动化。面试官问这个考察"有没有思考和自驱力"。

---

## 六、面试回答技巧

### 怎么介绍项目（1 分钟版）

> "我做了一个 AI Agent 服务，基于 FastAPI + Chroma 向量库 + DeepSeek 模型。核心能力是 RAG 知识库问答和 Tool Calling。用户上传文档后，系统自动切分、embedding、存向量库；提问时先检索相关资料，再让模型基于资料回答。同时还支持工具调用——模型可以自主决定查天气、算数学、搜网页。全部输出都是流式的，带一个 Web 前端页面。完整实现了 ReAct 推理循环。"

### 怎么介绍项目（3 分钟版）

在 1 分钟版基础上加上：
- 踩坑 1：chroma_db 的 .env 路径问题——不同 CWD 下 load_dotenv 找不到文件，最后用 Path(__file__) 显式指定路径解决。
- 踩坑 2：embedding 模型第一次启动需要下载 80MB 的 onnx 模型，我把这个缓存到本地，第二次就秒启动了。
- 踩坑 3：tool calling 的安全问题——eval 需要限制 __builtins__，防止恶意代码执行。

### 常见"陷阱"问题

**Q：你这个项目是跟着教程做的吧？**
A：核心架构是我自己设计的，技术选型也是基于对中小厂 AI agent 岗位需求的判断。过程中遇到了文件路径、embedding 模型下载、搜索 API 兼容性等问题，都是我一个个排查解决的。

**Q：你对 AI agent 的未来怎么看？**
A：短期趋势是 RAG + Tool Calling 成为标配（解决幻觉和行动力）；中期是多 Agent 协作（LangGraph 编排）；长期是 Agent 从"工具使用者"变成"自主工作者"。我现在的项目覆盖了短期和中期的核心能力。

---

## 七、简历项目描述（可直接拷贝）

**项目名称：** AI Agent 智能服务

**技术栈：** FastAPI / Chroma / DeepSeek / OpenAI SDK / BeautifulSoup

**项目描述：**
- 设计并实现了一个完整的 AI Agent HTTP 服务，支持 RAG 知识库问答与 Tool Calling 工具调用
- 基于 FastAPI 构建三个核心端点（健康检查、文档上传、流式问答），支持 .md/.txt 文档上传与自动索引
- 使用 Chroma 向量数据库 + all-MiniLM-L6-v2 本地 embedding 实现 RAG 检索，解决 LLM 幻觉与知识时效问题
- 实现 ReAct（Reasoning + Acting）推理循环，模型可自主调用天气查询、数学计算、网页搜索等外部工具
- 前端基于纯 HTML/CSS/JS 构建暗色主题交互界面，支持文件拖拽上传与流式对话
- 全部 API 响应采用 SSE 流式输出，提供逐 token 实时生成体验

---

## 八、关键词清单（面试时适当穿插）

- RAG（Retrieval-Augmented Generation）
- Embedding / 向量检索 / 余弦相似度
- Chunk 策略 / overlap
- Tool Calling / Function Calling
- ReAct 循环
- SSE / StreamingResponse
- Context Window / Token
- Chroma / all-MiniLM-L6-v2
- 混合检索
- 幻觉（Hallucination）
- 安全沙箱（eval 沙箱）
