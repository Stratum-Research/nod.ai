import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownProps = { content: string };

function CodeBlock({ inline, children }: any) {
  if (inline) {
    return <code className="px-1 py-0.5 rounded bg-gray-100">{children}</code>;
  }
  const text = String(children).replace(/\n$/, "");
  const copy = () => navigator.clipboard?.writeText(text).catch(() => { });
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-[#0b1020] text-white p-4 overflow-auto">
        <code>{text}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-xs rounded border px-2 py-1 bg-white/90 hidden group-hover:block"
        title="Copy"
      >
        Copy
      </button>
    </div>
  );
}

export default function Markdown({ content }: MarkdownProps) {
  return (
    <div className="prose prose-zinc max-w-none prose-pre:m-0 prose-pre:bg-transparent break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock as any,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


