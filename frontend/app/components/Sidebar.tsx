"use client";

import { Upload, FileText, BarChart3, BookOpen, PenLine, ChevronRight, MessageSquare, Database } from "lucide-react";

interface SidebarProps {
  currentMode: "general" | "career";
  jdText: string;
  onJdChange: (text: string) => void;
  onUpload: (file: File) => void;
  onQuickAction: (text: string) => void;
  uploadStatus: { msg: string; type: string } | null;
  stats: { conversations: number; tools: number };
  docCount: number;
  uploadedFileName: string | null;
}

export default function Sidebar({ currentMode, jdText, onJdChange, onUpload, onQuickAction, uploadStatus, stats, docCount, uploadedFileName }: SidebarProps) {
  const isCareer = currentMode === "career";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <aside className="w-[320px] flex-shrink-0 border-r border-[var(--color-border)] p-5 overflow-y-auto bg-surface/80 backdrop-blur flex flex-col gap-4">
      {/* 数据统计 */}
      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl p-3 transition-transform duration-250 hover:scale-105" style={{ background: 'var(--accent-gradient)', opacity: '0.1' }}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] mb-1" style={{ opacity: 1 }}>
            <Database className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />知识库
          </div>
          <div className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>{docCount}</div>
        </div>
        <div className="rounded-xl p-3 transition-transform duration-250 hover:scale-105" style={{ background: 'var(--accent-gradient)', opacity: '0.08' }}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] mb-1">
            <MessageSquare className="w-3.5 h-3.5" />对话数
          </div>
          <div className="text-2xl font-bold tracking-tight">{stats.conversations}</div>
        </div>
      </section>

      {/* 上传区域 */}
      <section>
        <h3 className="section-title">知识库</h3>
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
          onDrop={handleDrop}
          className="border-1.5 border-dashed border-[var(--color-border)] rounded-xl p-6 text-center cursor-pointer transition-all duration-250 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] [&.dragover]:border-[var(--color-accent)] [&.dragover]:bg-[var(--color-accent-bg)] [&.dragover]:scale-[1.01]"
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-2.5 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-dim)]">拖拽文件或点击上传</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">支持 .md .txt .pdf</p>
          <input id="file-input" type="file" accept=".md,.txt,.pdf" className="hidden" onChange={handleFileChange} />
          <label htmlFor="file-input" className="inline-block mt-2.5 px-5 py-2 text-white rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" style={{ background: 'var(--accent-gradient)', boxShadow: '0 4px 12px var(--accent-glow)' }}>
            选择文件
          </label>
        </div>
        {uploadStatus && (
          <div className={`mt-2 text-xs px-3 py-2.5 rounded-lg border flex items-center gap-2 animate-fade-in ${
            uploadStatus.type === "success"
              ? "text-green-400 bg-green-400/8 border-green-400/15"
              : uploadStatus.type === "error"
              ? "text-red-400 bg-red-400/8 border-red-400/15"
              : "text-[var(--color-text-dim)] border-[var(--color-border)] bg-[var(--color-surface-hover)]"
          }`}>
            {uploadStatus.type === "success" ? (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : uploadStatus.type === "error" ? (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            ) : (
              <span className="w-4 h-4 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full flex-shrink-0" style={{ animation: "spin 0.6s linear infinite" }} />
            )}
            <span className="truncate">{uploadStatus.msg}</span>
          </div>
        )}
        {uploadedFileName && !uploadStatus && (
          <div className="mt-2 text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-dim)] flex items-center gap-2 animate-fade-in">
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{uploadedFileName}</span>
          </div>
        )}
      </section>

      {/* 求职助手专属 */}
      {isCareer && (
        <>
          <section className="animate-fade-in">
            <h3 className="section-title">岗位描述</h3>
            <label className="text-xs text-[var(--color-text-dim)] block mb-1.5">粘贴目标岗位 JD，求职模式会自动参考</label>
            <textarea
              value={jdText}
              onChange={(e) => onJdChange(e.target.value)}
              placeholder="在此粘贴岗位 JD…"
              className="w-full bg-[#0f0f11] text-[var(--foreground)] border border-[var(--color-border)] rounded-lg p-3 text-sm resize-y outline-none font-inherit leading-relaxed min-h-[110px] transition-colors duration-200 focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
            />
          </section>

          <section className="animate-fade-in" style={{ animationDelay: "0.05s" }}>
            <h3 className="section-title">快捷操作</h3>
            <div className="flex flex-col gap-1.5">
              {[
                { icon: BarChart3, text: "分析匹配度", action: "分析我的简历和这个岗位的匹配度，指出优势和不足" },
                { icon: BookOpen, text: "模拟面试", action: "根据我的简历和这个 JD，模拟一场技术面试" },
                { icon: PenLine, text: "优化简历", action: "我的简历哪里需要改进？给出具体的修改建议" },
              ].map(({ icon: Icon, text, action }) => (
                <button
                  key={text}
                  onClick={() => onQuickAction(action)}
                  className="flex items-center gap-2 py-2 px-3.5 rounded-lg text-sm text-left transition-all duration-200 bg-[#0f0f11] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] hover:translate-x-0.5 active:translate-x-0 group"
                >
                  <Icon className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                  <span className="flex-1">{text}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <h3 className="section-title">提示</h3>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          {isCareer
            ? "上传简历(PDF) → 粘贴 JD → 点击快捷操作，或直接输入问题"
            : "上传文档后 AI 将基于知识库回答问题"}
        </p>
      </section>
    </aside>
  );
}
