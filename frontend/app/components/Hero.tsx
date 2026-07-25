"use client";

import { Sparkles, Database, Wrench, Briefcase, ArrowRight } from "lucide-react";

interface HeroProps {
  currentMode: "general" | "career";
  onSample: (text: string) => void;
}

const generalSamples = [
  { icon: Database, title: "查询文档", desc: "基于知识库回答你的问题" },
  { icon: Wrench, title: "调工具", desc: "查天气、算数学、搜网页" },
  { icon: Sparkles, title: "普通对话", desc: "不传文档也能直接问" },
];

const careerSamples = [
  { icon: Briefcase, title: "上传简历", desc: "上传你的 PDF 简历" },
  { icon: ArrowRight, title: "粘贴 JD", desc: "把目标岗位描述贴进侧边栏" },
  { icon: Sparkles, title: "一键分析", desc: "匹配度/模拟面试/优化建议" },
];

export default function Hero({ currentMode, onSample }: HeroProps) {
  const isCareer = currentMode === "career";
  const samples = isCareer ? careerSamples : generalSamples;
  const title = isCareer ? "智能求职助手" : "智能对话助手";
  const subtitle = isCareer
    ? "上传简历 · 粘贴 JD · 一键模拟面试与简历优化"
    : "基于知识库的问答 · 工具调用 · 流式生成";

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center">
        {/* Logo 大图标 */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 shadow-2xl" style={{ background: 'var(--accent-gradient)', boxShadow: '0 8px 32px var(--accent-glow)' }}>
          <Sparkles className="w-8 h-8 text-white" />
        </div>

        {/* 主标题 */}
        <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          {title}
        </h1>
        <p className="text-lg text-[var(--color-text-dim)] mb-12">{subtitle}</p>

        {/* 特色卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {samples.map(({ icon: Icon, title, desc }, i) => (
            <button
              key={i}
              onClick={() => onSample(desc.includes("粘贴") ? "分析我的简历和这个岗位的匹配度" : "帮我看一下我的知识库里有哪些文档")}
              className="group p-5 bg-surface/60 backdrop-blur border border-[var(--color-border)] rounded-xl text-left transition-all duration-250 hover:border-[var(--color-accent)] hover:bg-surface-hover hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--color-accent)]/8 active:translate-y-0"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-bg)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div className="font-medium text-sm mb-1">{title}</div>
              <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">{desc}</div>
            </button>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
          <kbd className="px-2 py-1 bg-surface border border-[var(--color-border)] rounded text-xs">Enter</kbd>
          <span>发送</span>
          <span className="mx-3 opacity-30">·</span>
          <kbd className="px-2 py-1 bg-surface border border-[var(--color-border)] rounded text-xs">Shift + Enter</kbd>
          <span>换行</span>
        </div>
      </div>
    </div>
  );
}