import { RefObject, useState } from "react";
import { ArrowUp, ChevronDown, Download, X, Square, Trash2 } from "lucide-react";
import { downloadModel, deleteModel, getDiskSpace } from "../../../lib/api";


type ComposerProps = {
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  onStop?: () => void;
  inputRef?: RefObject<HTMLInputElement>;
  placeholder?: string;
  models?: { id: string; name?: string; downloaded?: boolean; provider?: string; size_gb?: number }[];
  model?: string;
  setModel?: (id: string) => void;
  setModels?: React.Dispatch<React.SetStateAction<{ id: string; name?: string; downloaded?: boolean; provider?: string; size_gb?: number }[]>>;
  centered?: boolean;
};

export default function Composer({ input, setInput, sending, onSend, onStop, inputRef, placeholder = "Send a message", models, model, setModel, setModels, centered = false }: ComposerProps) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [diskSpace, setDiskSpace] = useState<{ free_gb: number } | null>(null);

  const selectedModel = models?.find((m) => m.id === model);
  const needsDownload = selectedModel?.provider === "opensource" && selectedModel?.downloaded === false;
  const isDownloaded = selectedModel?.provider === "opensource" && selectedModel?.downloaded === true;

  const checkDiskSpace = async () => {
    try {
      const space = await getDiskSpace();
      setDiskSpace(space);
      setShowConfirmDialog(true);
    } catch (error) {
      console.error("Failed to check disk space:", error);
      // Proceed without confirmation if check fails
      handleDownloadConfirm();
    }
  };

  const handleDownload = async () => {
    if (!model || downloading) return;
    await checkDiskSpace();
  };

  const handleDownloadConfirm = async () => {
    if (!model || downloading) return;
    setShowConfirmDialog(false);
    setDownloading(true);

    try {
      await downloadModel(model);
      if (setModels) {
        setModels((prev) =>
          prev.map((m) => (m.id === model ? { ...m, downloaded: true } : m))
        );
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert(`Download failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!model || deleting) return;
    setShowDeleteDialog(false);
    setDeleting(true);

    try {
      await deleteModel(model);
      if (setModels) {
        setModels((prev) =>
          prev.map((m) => (m.id === model ? { ...m, downloaded: false } : m))
        );
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert(`Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={centered ? "min-h-[60vh] flex items-center justify-center" : ""}>{children}</div>
  );

  return (
    <Wrapper>
      <div className="max-w-3xl mx-auto w-full rounded-4xl bg-gray-100/75 px-6 py-6">
        {/* Row 1: Input */}
        <div>
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none placeholder:text-gray-800"
            type="text"
            autoFocus
            onBlur={(e) => {
              // keep focus in composer to avoid losing typing mid-input
              e.target.focus();
            }}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
        </div>

        {/* Row 2: Model dropdown (right) and Send (rightmost) */}

        <div className="mt-2 flex items-center justify-end gap-2 pt-3">
          {models && setModel && (
            <div className="relative inline-flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${selectedModel?.name?.includes("(Local)") ? "bg-orange-500" : "bg-blue-500"
                  }`}
              />
              <div className="relative rounded-full bg-white px-4 py-2">
                <select
                  className="appearance-none bg-transparent pr-5 text-sm focus:outline-none w-36"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              {needsDownload && (
                <>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 relative"
                    title="Download model"
                  >
                    {downloading ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={16} className="text-gray-600" />
                    )}
                  </button>

                  {/* Confirmation Dialog */}
                  {showConfirmDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Download Model</h3>
                          <button
                            onClick={() => setShowConfirmDialog(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        <div className="space-y-3 mb-6">
                          <p className="text-gray-600">
                            You're about to download <strong>{selectedModel?.name}</strong>
                          </p>
                          {selectedModel?.size_gb && (
                            <p className="text-sm text-gray-500">
                              Model size: <strong>{selectedModel.size_gb} GB</strong>
                            </p>
                          )}
                          {diskSpace && (
                            <p className="text-sm text-gray-500">
                              Available space: <strong>{diskSpace.free_gb.toFixed(2)} GB</strong>
                            </p>
                          )}
                          {selectedModel?.size_gb && diskSpace && selectedModel.size_gb > diskSpace.free_gb && (
                            <p className="text-sm text-red-600 font-medium">
                              ⚠️ Not enough disk space available
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => setShowConfirmDialog(false)}
                            className="px-4 py-2 rounded-md border text-sm hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDownloadConfirm}
                            disabled={!!(selectedModel?.size_gb && diskSpace && selectedModel.size_gb > diskSpace.free_gb)}
                            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {isDownloaded && (
                <>
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleting}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 relative"
                    title="Delete model"
                  >
                    {deleting ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} className="text-gray-600" />
                    )}
                  </button>

                  {/* Delete Confirmation Dialog */}
                  {showDeleteDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Delete Model</h3>
                          <button
                            onClick={() => setShowDeleteDialog(false)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        <div className="space-y-3 mb-6">
                          <p className="text-gray-600">
                            Are you sure you want to delete <strong>{selectedModel?.name}</strong>?
                          </p>
                          {selectedModel?.size_gb && (
                            <p className="text-sm text-gray-500">
                              This will free up <strong>{selectedModel.size_gb} GB</strong> of disk space.
                            </p>
                          )}
                          <p className="text-sm text-red-600 font-medium">
                            ⚠️ This action cannot be undone. You'll need to download the model again to use it.
                          </p>
                        </div>
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => setShowDeleteDialog(false)}
                            className="px-4 py-2 rounded-md border text-sm hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <button
            className={`rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-50 ${sending
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            onClick={sending ? onStop : onSend}
            disabled={!sending && (!input.trim() || !model)}
            title={sending ? "Stop" : "Send"}
          >
            {sending ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
    </Wrapper>
  );
}


