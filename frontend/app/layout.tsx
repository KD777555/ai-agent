import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Agent - 智能对话助手",
  description: "基于 FastAPI + Chroma + DeepSeek 构建的 AI Agent 服务，支持 RAG 知识库问答与 Tool Calling 工具调用",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
