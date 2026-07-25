"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import Hero from "./components/Hero";
import { Menu, X, Trash2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  time?: string;
}

function getStorageKey(mode: string) { return `agent_msgs_${mode}`; }

export default function Home() {
  const [currentMode, setCurrentMode] = useState<"general" | "career">("general");
  const [kbLoaded, setKbLoaded] = useState(false);
  const [kbStatus, setKbStatus] = useState("⚪ 连接中…");
  const [docCount, setDocCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [jdText, setJdText] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{ msg: string; type: string } | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [stats, setStats] = useState({ conversations: 0, tools: 3 });
  const [viewReady, setViewReady] = useState(true);
  const [fadeKey, setFadeKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const msgRef = useRef(messages);
  msgRef.current = messages;
  const startedRef = useRef(hasStarted);
  startedRef.current = hasStarted;

  useEffect(() => { setPageLoaded(true); }, []);

  // 页面标题通知
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") setUnreadCount(0);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const base = "AI Agent";
    if (unreadCount > 0) { document.title = `(${unreadCount}) ${base}`; }
    else { document.title = base; }
  }, [unreadCount]);

  // 全局快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      }
      if (e.key === "Escape" && isLoading) {
        abortRef.current?.abort();
        setIsLoading(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLoading]);

  // 健康检查
  const checkHealth = useCallback(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => {
        setKbLoaded(d.kb_loaded && d.doc_count > 0);
        setDocCount(d.doc_count);
        setKbStatus(d.kb_loaded && d.doc_count > 0 ? `🟢 ${d.doc_count} 个块` : "⚪ 知识库未加载");
      })
      .catch(() => setKbStatus("🔴 未连接"))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => { checkHealth(); const i = setInterval(checkHealth, 30000); return () => clearInterval(i); }, [checkHealth]);

  // localStorage 持久化
  useEffect(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(currentMode));
      if (saved) { const p = JSON.parse(saved); setMessages(p); if (p.length > 0) setHasStarted(true); }
    } catch {}
  }, [currentMode]);

  useEffect(() => {
    if (hasStarted) try { localStorage.setItem(getStorageKey(currentMode), JSON.stringify(messages)); } catch {}
  }, [messages, currentMode, hasStarted]);

  // 会话数统计
  useEffect(() => {
    const userCount = messages.filter(m => m.role === "user").length;
    if (userCount > 0) setStats(s => ({ ...s, conversations: userCount }));
  }, [messages]);

  // 新消息未读通知
  useEffect(() => {
    if (document.visibilityState !== "visible" && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content) {
      setUnreadCount(c => c + 1);
    }
  }, [messages]);

  const handleModeChange = (mode: "general" | "career") => {
    setViewReady(false);
    setTimeout(() => {
      setCurrentMode(mode);
      setHasStarted(false);
      setFadeKey(k => k + 1);
      setViewReady(true);
    }, 200);
  };

  const clearConversation = () => {
    if (messages.length > 0 && !window.confirm("确定清除当前对话？")) return;
    setMessages([]);
    setHasStarted(false);
    localStorage.removeItem(getStorageKey(currentMode));
  };

  const handleUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["md", "txt", "pdf"].includes(ext || "")) { setUploadStatus({ msg: "仅支持 .md .txt .pdf", type: "error" }); return; }
    setUploadedFileName(file.name);
    setUploadStatus({ msg: `上传中 ${file.name}…`, type: "" });
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus({ msg: `✅ ${data.filename}（${data.chunks} 块）`, type: "success" });
        setKbLoaded(true);
        setDocCount(data.chunks);
        setKbStatus(`🟢 ${data.chunks} 个块`);
      } else { setUploadStatus({ msg: data.detail || "上传失败", type: "error" }); }
    } catch { setUploadStatus({ msg: "网络错误", type: "error" }); }
    setTimeout(() => { setUploadStatus(null); setUploadedFileName(null); }, 4000);
  }, []);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!startedRef.current) setHasStarted(true);
    let finalQuery = text;
    if (currentMode === "career" && jdText.trim()) finalQuery = `[岗位JD]\n${jdText}\n\n[问题]\n${text}`;

    const t = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { role: "user", content: text, time: t }]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(`${API}/chat`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery, temperature: 0.3, mode: currentMode }),
      });

      if (!resp.ok) { setMessages(prev => [...prev, { role: "assistant", content: `请求失败: ${resp.status}`, time: t }]); setIsLoading(false); return; }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setMessages(prev => [...prev, { role: "assistant", content: "", time: t }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: fullText }; return n; });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setMessages(prev => [...prev, { role: "assistant", content: "网络错误，请检查服务", time: t }]);
    }
    setIsLoading(false);
  }, [currentMode, jdText]);

  return (
    <div className="h-full flex flex-col relative" data-theme={currentMode}>
      {hasStarted && (
        <button onClick={clearConversation}
          className="fixed bottom-24 right-6 z-30 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-surface border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-red-400 hover:border-red-400/30 transition-all duration-200 hover:-translate-y-0.5 shadow-lg">
          <Trash2 className="w-3.5 h-3.5" /> 清除
        </button>
      )}
      <div className="particles">{[0,1,2,3,4,5,6,7].map(i => <div key={i} className="particle" />)}</div>
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full" style={{ background: 'var(--blob-color)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-30%] right-[5%] w-[700px] h-[700px] rounded-full" style={{ background: 'var(--blob-color)', filter: 'blur(120px)' }} />
      </div>

      <Header kbStatus={kbStatus} kbLoaded={kbLoaded} currentMode={currentMode} onModeChange={handleModeChange} messageCount={Math.ceil(messages.length / 2)} onClear={clearConversation} />

      {initialLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-2xl" style={{ background: "var(--accent-gradient)" }} />
            <div className="w-32 h-3 rounded-full bg-[var(--color-surface)]" />
            <div className="w-48 h-2 rounded-full bg-[var(--color-surface)]" />
          </div>
        </div>
      )}

      <div className={`flex flex-1 overflow-hidden min-h-0 transition-all duration-400 ${pageLoaded && !initialLoading ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute z-20 left-3 top-3 w-8 h-8 flex items-center justify-center rounded-lg bg-surface border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--foreground)] transition-colors lg:hidden">
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className={`${sidebarOpen ? "max-w-[320px] opacity-100" : "max-w-0 opacity-0 overflow-hidden"} transition-all duration-300 ease-in-out lg:max-w-[320px] lg:opacity-100 lg:overflow-visible`}>
          <Sidebar currentMode={currentMode} jdText={jdText} onJdChange={setJdText} onUpload={handleUpload}
            onQuickAction={(t) => handleSend(t)} uploadStatus={uploadStatus} stats={stats} docCount={docCount}
            uploadedFileName={uploadedFileName} />
        </div>

        <div key={fadeKey} className="flex-1 flex flex-col min-w-0 min-h-0 transition-opacity duration-200" style={{ opacity: viewReady ? 1 : 0 }}>
          {!hasStarted && <Hero currentMode={currentMode} onSample={(text) => handleSend(text)} />}
          {hasStarted && (
            <ChatArea messages={messages} onSend={(text) => handleSend(text)} isLoading={isLoading}
              onStop={stopGenerating}
              onRetry={() => { const lu = [...msgRef.current].reverse().find(m => m.role === "user"); if (lu) handleSend(lu.content); }}
              onEditMessage={(idx) => {
                const msg = msgRef.current[idx];
                if (msg?.role === "user") {
                  const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
                  if (textarea) { textarea.value = msg.content; textarea.focus(); textarea.style.height = "auto"; textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"; }
                }
              }} />
          )}
        </div>
      </div>
    </div>
  );
}