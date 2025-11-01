import { ChatMessage } from "../../../lib/api";
import { RefObject } from "react";
import GradientBot from "./GradientBot";
import Markdown from "./Markdown";

type MessagesProps = {
  messages: ChatMessage[];
  loading: boolean;
  reasoning: string;
  bottomRef: RefObject<HTMLDivElement>;
  reasoningByIndex?: Record<number, string>;
};

export default function Messages({ messages, loading, reasoning, bottomRef, reasoningByIndex = {} }: MessagesProps) {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {messages.filter(Boolean).map((m, idx) => (
        <div key={idx}>
          {m?.role === "user" ? (
            <div className="text-right">
              <span className="inline-block max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100/90">
                {m?.content}
              </span>
            </div>
          ) : (
            <div className="text-left">
              <div className="flex items-start gap-3">
                <GradientBot size={28} isStreaming={loading} />
                <div className="prose prose-zinc max-w-none break-words min-w-0 flex-1">
                  <Markdown content={m?.content || ""} />
                  {reasoningByIndex[idx] && (
                    <details className="mt-2 text-sm text-gray-500">
                      <summary className="cursor-pointer select-none">Show reasoning</summary>
                      <div className="mt-1 whitespace-pre-wrap">{reasoningByIndex[idx]}</div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      {loading && reasoning && (
        <div className="text-left text-sm text-gray-500">{reasoning}</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}


