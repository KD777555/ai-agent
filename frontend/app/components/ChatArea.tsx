"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Copy, Check, ChevronDown, Pencil, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface Message { role: "user" | "assistant"; content: string; time?: string; }

interface ChatAreaProps {
  messages: Message[];
  onSend: (text: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  onRetry?: () => void;
  onEditMessage?: (index: number) => void;
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between px-4 py-1.5 rounded-t-lg text-xs" style={{ background: "var(--color-surface-hover)", borderBottom: "1px solid var(--color-border)" }}>
        <span className="text-[var(--color-text-muted)]">{language || "code"}</span>
        <button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 text-[var(--color-text-dim)] hover:text-[var(--foreground)] transition-colors">
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}{copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none !border-t-0"><code>{code}</code></pre>
    </div>
  );
}

const markdownComponents: Components = {
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">{children}</a>,
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    if (match || code.includes("\n")) return <CodeBlock language={match?.[1]} code={code} />;
    return <code className={className} {...props}>{children}</code>;
  },
};

export default function ChatArea({ messages, onSend, isLoading, onStop, onRetry, onEditMessage }: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // 追踪消息长度变化：只在新增消息时自动滚底，更新（流式）时不滚动
  const prevLenRef = useRef(messages.length);
  const scrollToBottom = useCallback((force = false) => {
    if (force || !showScrollBtn) bottomRef.current?.scrollIntoView({ behavior: force ? "smooth" : "auto" });
  }, [showScrollBtn]);
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      prevLenRef.current = messages.length;
      scrollToBottom(true);
    }
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => { const el = scrollRef.current; if (el) setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100); }, []);

  const handleSend = () => { const t = input.trim(); if (!t || isLoading) return; onSend(t); setInput(""); if (inputRef.current) inputRef.current.style.height = "auto"; };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--background)]">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 px-6 py-6 relative">
        {showScrollBtn && (
          <button onClick={() => scrollToBottom(true)}
            className="sticky bottom-2 z-10 mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur border transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "var(--accent-gradient)", color: "#fff", borderColor: "transparent", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
            <ChevronDown className="w-3.5 h-3.5" /> 回到底部
          </button>
        )}

        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center max-w-sm mx-auto mt-20 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: "var(--accent-gradient)", boxShadow: "0 8px 32px var(--accent-glow)" }}>
                <Bot className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">在下方输入问题，AI 将基于知识库回答</p>
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
                <kbd className="px-2 py-1 bg-surface border border-[var(--color-border)] rounded text-[11px]">/</kbd><span>聚焦</span>
                <span className="opacity-30 mx-1">·</span>
                <kbd className="px-2 py-1 bg-surface border border-[var(--color-border)] rounded text-[11px]">Enter</kbd><span>发送</span>
                <span className="opacity-30 mx-1">·</span>
                <kbd className="px-2 py-1 bg-surface border border-[var(--color-border)] rounded text-[11px]">Esc</kbd><span>停止</span>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : ""}`} style={{ animationDelay: `${i * 0.02}s` }}>
              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${msg.role === "user" ? "text-white" : "bg-surface border border-[var(--color-border)] text-[var(--color-text-dim)]"}`}
                style={msg.role === "user" ? { background: "var(--accent-gradient)" } : {}}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className="group max-w-[75%] min-w-0">
                <div className={`flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1 px-1 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <span>{msg.role === "user" ? "你" : "AI Agent"}</span>
                  {msg.time && <span className="opacity-50">{msg.time}</span>}
                  {msg.role === "user" && i === messages.length - 2 && !isLoading && onEditMessage && (
                    <button onClick={() => onEditMessage(i)} className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--color-accent)]">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className={`relative px-4 py-3 text-sm leading-relaxed break-words ${msg.role === "user" ? "text-white rounded-2xl rounded-tr-md" : "bg-surface border border-[var(--color-border)] rounded-2xl rounded-tl-md"}`}
                  style={msg.role === "user" ? { background: "var(--accent-gradient)" } : {}}>
                  {msg.role === "user" ? msg.content : (
                    <div className="prose prose-invert prose-sm max-w-none [&_code]:bg-[var(--color-surface-hover)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-[var(--color-surface-hover)] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-[var(--color-border)] [&_table]:w-full [&_th]:text-left [&_th]:p-2 [&_th]:border [&_th]:border-[var(--color-border)] [&_td]:p-2 [&_td]:border [&_td]:border-[var(--color-border)] [&_ul]:pl-4 [&_ol]:pl-4 [&_li>p]:m-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content || ""}</ReactMarkdown>
                      {isLoading && i === messages.length - 1 && (
                        <span className="inline-block w-[2px] h-[14px] ml-0.5 align-text-bottom animate-pulse" style={{ background: "var(--color-accent)" }} />
                      )}
                    </div>
                  )}
                </div>
                {msg.role === "assistant" && msg.content && (
                  <div className="flex items-center gap-2 mt-1 ml-1">
                    <button onClick={async () => { await navigator.clipboard.writeText(msg.content); setCopiedId(i); setTimeout(() => setCopiedId(null), 2000); }}
                      className={`flex items-center gap-1 text-xs transition-all duration-200 opacity-0 group-hover:opacity-100 ${copiedId === i ? "text-green-400" : "text-[var(--color-text-muted)] hover:text-[var(--foreground)]"}`}>
                      {copiedId === i ? <><Check className="w-3 h-3" /> 已复制</> : <><Copy className="w-3 h-3" /> 复制</>}
                    </button>
                    {(msg.content.startsWith("请求失败") || msg.content.startsWith("网络错误")) && onRetry && (
                      <button onClick={onRetry} className="flex items-center gap-1 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> 重试
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.content !== "" && (
            <div className="flex gap-3 animate-fade-in">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-surface border border-[var(--color-border)] flex items-center justify-center"><Bot className="w-4 h-4 text-[var(--color-text-dim)]" /></div>
              <div className="bg-surface border border-[var(--color-border)] rounded-2xl rounded-tl-md px-5 py-4">
                <div className="flex gap-1.5">{[0,1,2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" style={{ animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t border-[var(--color-border)] px-6 py-3 bg-surface/80 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
          <div className="flex gap-3 items-end">
            <textarea ref={inputRef} value={input}
              onChange={(e) => { setInput(e.target.value); if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"; } }}
              onKeyDown={handleKeyDown} rows={1} disabled={isLoading}
              placeholder={isLoading ? "AI 正在生成…" : "输入问题…"}
              className="flex-1 bg-[var(--background)] text-[var(--foreground)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm outline-none resize-none font-inherit leading-relaxed max-h-[120px] transition-all duration-200 focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-[var(--color-text-muted)] disabled:opacity-60" />

            <div className="flex gap-2">
              {isLoading && onStop && (
                <button onClick={onStop}
                  className="w-[44px] h-[44px] flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl transition-all duration-200 hover:bg-red-500/20 active:scale-95"
                  title="停止生成 (Esc)">
                  <Square className="w-[16px] h-[16px]" />
                </button>
              )}
              <button onClick={handleSend} disabled={!input.trim() || isLoading}
                className="w-[44px] h-[44px] flex items-center justify-center text-white rounded-xl transition-all duration-200 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                style={{ background: "var(--accent-gradient)", boxShadow: "0 4px 12px var(--accent-glow)" }}>
                {isLoading ? <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin 0.6s linear infinite" }} />
                  : <Send className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)] px-1">
            <span><kbd className="px-1 py-0.5 bg-surface border border-[var(--color-border)] rounded text-[10px]">Enter</kbd> 发送</span>
            <span><kbd className="px-1 py-0.5 bg-surface border border-[var(--color-border)] rounded text-[10px]">Shift+Enter</kbd> 换行</span>
            <span><kbd className="px-1 py-0.5 bg-surface border border-[var(--color-border)] rounded text-[10px]">Esc</kbd> 停止</span>
            {isLoading && <span className="ml-auto text-[var(--color-accent)] animate-pulse">● 生成中…</span>}
          </div>
        </div>
      </div>
    </div>
  );
}