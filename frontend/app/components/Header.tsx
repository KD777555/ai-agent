"use client";

import { Briefcase, MessageSquare, Sparkles, Trash2 } from "lucide-react";

interface HeaderProps {
  kbStatus: string;
  kbLoaded: boolean;
  currentMode: "general" | "career";
  onModeChange: (mode: "general" | "career") => void;
  messageCount?: number;
  onClear?: () => void;
}

export default function Header({ kbStatus, kbLoaded, currentMode, onModeChange, messageCount, onClear }: HeaderProps) {
  return (
    <header className="flex items-center gap-4 px-7 py-3.5 border-b border-[var(--color-border)] bg-surface flex-shrink-0 shadow-[0_1px_8px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
        <Sparkles className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
        AI Agent
      </div>

      <span
        className={`text-xs px-3 py-1 rounded-full border transition-all duration-300 ${
          kbLoaded
            ? "text-green-400 border-green-400/30 bg-green-400/6"
            : kbStatus.includes("连接")
            ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/6"
            : kbStatus.includes("未连接")
            ? "text-red-400 border-red-400/30 bg-red-400/6"
            : "text-[var(--color-text-dim)] border-[var(--color-border)]"
        }`}
      >
        {kbStatus}
      </span>

      <div className="flex gap-0.5 ml-auto bg-[#0f0f11] rounded-lg p-0.5">
        {[
          { mode: "general" as const, label: "通用", icon: MessageSquare },
          { mode: "career" as const, label: "求职助手", icon: Briefcase },
        ].map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              currentMode === mode
                ? "text-white shadow-lg"
                : "text-[var(--color-text-dim)] hover:text-[var(--foreground)] hover:bg-[var(--color-surface-hover)]"
            }`}
            style={currentMode === mode ? { background: "var(--accent-gradient)", boxShadow: "0 4px 12px var(--accent-glow)" } : {}}
          >
            <Icon className="w-4 h-4" />
            {label}
            {currentMode === mode && messageCount !== undefined && messageCount > 0 && (
              <span className="ml-1 text-xs opacity-70">({Math.ceil(messageCount / 2)})</span>
            )}
          </button>
        ))}
      </div>

      {/* 清除按钮（顶栏右侧） */}
      {messageCount && messageCount > 0 && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-[var(--color-text-dim)] hover:text-red-400 hover:bg-red-400/8 transition-all duration-200"
          title="清除对话"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </header>
  );
}