import { Link } from "react-router";
import { useEffect, useRef, useState } from "react";
import { X, Plus, Settings } from "lucide-react";

type SidebarProps = {
  onNewChat: () => void;
  chats?: { id: number; title: string }[];
  currentChatId?: number | null;
  onSelectChat?: (id: number) => void;
  visible: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
};

export default function Sidebar({ onNewChat, chats = [], currentChatId, onSelectChat, visible, onClose, width, onWidthChange }: SidebarProps) {
  const [animatingIn, setAnimatingIn] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      // Start enter animation on next frame
      rafIdRef.current = requestAnimationFrame(() => setAnimatingIn(true));
    } else {
      setAnimatingIn(false);
    }
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [visible]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const isShown = visible && animatingIn;

  return (
    <aside
      style={{ width: isShown ? `${width}px` : '0px' }}
      className={`relative h-full border-r bg-white flex flex-col ${isResizing ? '' : 'transition-all duration-300 ease-out'} overflow-hidden ${isShown ? '' : 'border-r-0'}`}
    >
      <div className="px-3 py-3 flex items-center justify-between" style={{ minWidth: `${width}px` }}>
        <div className="font-medium">Chats</div>
        <button className="p-2 rounded-md hover:bg-gray-100" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="px-3 pb-2 space-y-1" style={{ minWidth: `${width}px` }}>
        <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2" onClick={onNewChat}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>
      <div className="p-2 space-y-1 overflow-auto flex-1" style={{ minWidth: `${width}px` }}>
        {chats.map((c) => (
          <button
            key={c.id}
            className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 prose prose-sm ${currentChatId === c.id ? 'bg-gray-100' : ''}`}
            onClick={() => onSelectChat && onSelectChat(c.id)}
          >
            {c.title}
          </button>
        ))}
      </div>
      <div className="mt-auto p-3 border-t" style={{ minWidth: `${width}px` }}>
        <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:underline">
          <Settings size={16} /> Settings
        </Link>
      </div>

      {/* Resize handle */}
      {isShown && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
          onMouseDown={() => setIsResizing(true)}
        />
      )}
    </aside>
  );
}


