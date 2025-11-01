import { useEffect, useRef, useState } from "react";
import { ChatMessage, fetchOpenRouterModels, streamChat, listChats, getChatMessages } from "../../lib/api";
import Sidebar from "./components/Sidebar";
import Messages from "./components/Messages";
import Composer from "./components/Composer";
import Welcome from "./components/Welcome";
import { PanelLeft } from "lucide-react";


type Model = { id: string; name?: string; downloaded?: boolean; provider?: string; size_gb?: number };

export default function ChatPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [chatList, setChatList] = useState<{ id: number; title: string }[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288); // 288px = w-72
  const [assistantReasoning, setAssistantReasoning] = useState<Record<number, string>>({});
  const [contentStarted, setContentStarted] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    fetchOpenRouterModels()
      .then((data) => {
        const raw = data?.data || data?.models || [];
        const onlyFree = raw.filter((m: any) => {
          const pricing = m?.pricing || {};
          const values = Object.values(pricing).map((v: any) => Number(v)).filter((v) => !Number.isNaN(v));
          // treat as free if no numeric pricing is provided or all numeric prices are 0
          return values.length === 0 || values.every((v) => v === 0);
        });
        const list: Model[] = onlyFree.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          downloaded: m.downloaded,
          provider: m.provider,
          size_gb: m.size_gb,
        }));
        console.log("Fetched models:", list);
        setModels(list);
        if (list.length && !model) setModel(list[0].id);
      })
      .catch((err) => {
        console.error("Error fetching models:", err);
        // no-op; let UI show empty
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    listChats().then((r) => setChatList(r.chats || [])).catch(() => { });
  }, []);

  const send = async () => {
    if (!input.trim() || !model) return;

    // Check if OpenSource model needs download
    const selectedModel = models.find((m) => m.id === model);
    if (selectedModel?.provider === "opensource" && selectedModel?.downloaded === false) {
      alert("Please download this model first before using it. Click the Download button.");
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setCurrentReasoning("");
    setContentStarted(false);
    setInput("");
    setLoading(true);
    const assistantIndex = messages.length + 1;

    // Create abort controller for this stream
    const controller = new AbortController();
    setAbortController(controller);

    try {
      await streamChat(model, [...messages, userMsg], {
        onContent: (chunk) => {
          if (!contentStarted) setContentStarted(true);
          setMessages((prev) => {
            const copy = [...prev];
            const existing = copy[assistantIndex];
            copy[assistantIndex] = {
              role: "assistant",
              content: (existing?.content || "") + chunk,
            };
            return copy;
          });
        },
        onReasoning: (chunk) => setCurrentReasoning((r) => r + chunk),
        onMeta: (id: number) => {
          setChatId(id);
          listChats().then((r) => setChatList(r.chats || [])).catch(() => { });
        },
      }, chatId || undefined, controller.signal);
    } catch (error) {
      // If aborted, that's expected - don't show error
      if (error instanceof Error && error.message === "Stream aborted") {
        // Just stop gracefully
      } else {
        console.error("Stream error:", error);
      }
    } finally {
      setLoading(false);
      setAbortController(null);
      if (currentReasoning) {
        setAssistantReasoning((prev) => ({ ...prev, [assistantIndex]: currentReasoning }));
        setCurrentReasoning("");
      }
    }
  };

  const stopStreaming = () => {
    if (abortController && loading) {
      abortController.abort();
      setLoading(false);
      // Don't set abortController to null yet - let the stream cleanup handle it
    }
  };

  const showWelcome = messages.length === 0;
  const onNewChat = () => {
    setMessages([]);
    setCurrentReasoning("");
    setInput("");
    setChatId(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="h-screen w-screen flex bg-white overflow-hidden">
      {/* Sidebar - slides in from left */}
      <Sidebar
        visible={showSidebar}
        onClose={() => setShowSidebar(false)}
        onNewChat={onNewChat}
        chats={chatList}
        currentChatId={chatId}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        onSelectChat={async (id) => {
          setChatId(id);
          const r = await getChatMessages(id);
          const msgs = (r.messages || []).map((m: any) => ({ role: m.role, content: m.content } as ChatMessage));
          setMessages(msgs);
          setCurrentReasoning("");
          setInput("");
        }}
      />

      {/* Main */}
      <div className={`flex-1 flex flex-col relative min-w-0`}>
        <button className="absolute left-3 top-3 p-2 rounded-md hover:bg-gray-100 z-10" onClick={() => setShowSidebar((v) => !v)} title="Toggle sidebar">
          <PanelLeft size={18} />
        </button>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {showWelcome ? (
            <Welcome input={input} setInput={setInput} sending={loading} onSend={send} onStop={stopStreaming} inputRef={inputRef} models={models} model={model} setModel={setModel} setModels={setModels} />
          ) : (
            <div className="px-4 py-6">
              <Messages messages={messages} loading={loading} reasoning={contentStarted ? "" : currentReasoning} bottomRef={bottomRef} reasoningByIndex={assistantReasoning} />
            </div>
          )}
        </main>

        {/* Bottom composer (when in conversation) */}
        {!showWelcome && (
          <footer className="px-4 py-3 bg-white/70">
            <Composer input={input} setInput={setInput} sending={loading} onSend={send} onStop={stopStreaming} models={models} model={model} setModel={setModel} setModels={setModels} />
          </footer>
        )}
      </div>

    </div>
  );
}


