# AI Agent · 智能对话助手

> 基于 FastAPI + Chroma + DeepSeek 构建的全链路 AI Agent 服务，支持 RAG 知识库问答与 Tool Calling 工具调用。

**🌐 在线体验：** [ai-agent-1-p8yt.onrender.com](https://ai-agent-1-p8yt.onrender.com)

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 📚 **RAG 知识库** | 上传 .md/.txt/.pdf 文档，AI 基于文档内容回答问题 |
| 🔧 **Tool Calling** | 模型自主调用工具：查天气、算数学、搜索互联网 |
| 💼 **求职助手** | 上传简历 + 粘贴 JD → 分析匹配度、模拟面试、优化简历 |
| ⚡ **流式输出** | SSE 逐 token 实时生成，类 ChatGPT 体验 |
| 🎨 **双主题** | 通用模式（科技蓝）/ 求职助手（紫罗兰） |
| 💾 **对话持久化** | localStorage 自动保存，刷新不丢失 |

## 技术栈

```
后端：FastAPI + Chroma + DeepSeek API + OpenAI SDK + pdfminer
前端：Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + lucide-react
部署：Render（免费托管）
```

## 快速体验

在线打开 https://ai-agent-1-p8yt.onrender.com，无需安装。

**通用模式：**
1. 保持默认「通用」模式
2. 上传文档（支持 .md .txt .pdf）
3. 输入问题，AI 基于文档回答

**求职助手模式：**
1. 切换「求职助手」模式
2. 上传简历 PDF
3. 粘贴目标岗位 JD
4. 点击快捷按钮分析匹配度 / 模拟面试 / 优化简历

## 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/KD777555/ai-agent.git
cd ai-agent

# 2. 配置环境变量
cp step0_basics/.env.example step0_basics/.env
# 编辑 .env，填入你的 API Key

# 3. 启动后端
pip install -r step0_basics/requirements.txt
cd step0_basics
uvicorn app:app --reload

# 4. 启动前端
cd frontend
npm install
npm run dev
```

## 项目结构

```
├── step0_basics/          # FastAPI 后端
│   ├── app.py             # 主服务（RAG + Tool Calling + 流式输出）
│   ├── chat.py            # 终端对话 demo
│   └── static/            # 旧版前端（备用）
├── frontend/              # Next.js 前端
│   └── app/
│       ├── page.tsx       # 主页面
│       └── components/    # 组件（Header/Sidebar/ChatArea/Hero）
├── step1_rag/             # RAG 知识库构建脚本
├── step2_tools/           # Tool Calling 独立 demo
├── interview_prep.md      # 面试准备手册
└── 使用说明.md             # 完整使用说明
```

## 核心架构

```
用户 ──► Next.js 前端 ──► FastAPI 服务
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
               RAG 检索    ReAct 循环  流式输出
              (Chroma)   (Tool Calling) (SSE)
```

## 部署

项目部署在 Render 免费服务：
- 前端：Next.js（自动构建 + 部署）
- 后端：FastAPI（uvicorn）
- 免费实例 15 分钟不活动会休眠，再次访问约需 30s 冷启动
