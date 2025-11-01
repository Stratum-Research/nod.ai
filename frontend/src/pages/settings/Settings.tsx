import { useEffect, useState } from "react";
import { ChevronLeft, Key, Sparkles, ExternalLink, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { saveOpenRouterKey, getOpenRouterKey } from "../../lib/api";

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if a key exists in backend (returns partial key for security)
    getOpenRouterKey()
      .then(() => {
        // If key exists, we don't show it (for security) but user can update it
        // The input will remain empty, user can enter new key
      })
      .catch((err) => {
        console.error("Failed to check API key:", err);
      });
  }, []);

  const save = async () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      setError("API key is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await saveOpenRouterKey(trimmedKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      // After saving, send user to chat
      setTimeout(() => {
        window.location.hash = "#/chat";
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-50 to-white overflow-y-auto">
      <div className="relative mx-auto max-w-2xl p-8">
        {/* Back Button */}
        <button
          aria-label="Back to Chat"
          className="absolute left-8 top-8 p-2 rounded-lg hover:bg-gray-100/80 transition-colors"
          onClick={() => (window.location.hash = "#/chat")}
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>

        {/* Header Section */}
        <div className="text-center mb-8 pt-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 font-serif">Settings</h1>
          <p className="text-gray-600">Configure your API keys and preferences</p>
        </div>

        {/* Easter Egg Card */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-6 mb-6 border border-amber-200/50">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/20 p-2 flex-shrink-0">
              <Sparkles className="text-amber-600" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">Hey, you found me! 🎉</h3>
              <p className="text-sm text-amber-800/80 leading-relaxed">
                By adding an OpenRouter API key, you can unlock access to a ton of free models on a limited basis!
                Explore hundreds of AI models including GPT-4, Claude, and many others directly through OpenRouter.
              </p>
            </div>
          </div>
        </div>

        {/* API Key Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-blue-100 p-2">
              <Key className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">OpenRouter API Key</h2>
              <p className="text-sm text-gray-500">Connect to hundreds of AI models</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50/50 rounded-xl p-4 mb-6 border border-blue-100">
            <div className="flex items-start gap-3 mb-4">
              <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-2">How to get your API key:</h3>
                <ol className="space-y-2 text-sm text-blue-800/80 list-decimal list-inside">
                  <li>Visit <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1">openrouter.ai <ExternalLink size={14} /></a></li>
                  <li>Sign up or log in to your account</li>
                  <li>Navigate to your <strong>API Keys</strong> section</li>
                  <li>Create a new API key (it starts with <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">sk-or-v1-</code>)</li>
                  <li>Copy and paste it below</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Cloud Models Notice */}
          <div className="bg-amber-50/50 rounded-xl p-4 mb-6 border border-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h3 className="font-medium text-amber-900 mb-1.5">Cloud-Based Models</h3>
                <p className="text-sm text-amber-800/80 leading-relaxed">
                  All queries through OpenRouter are processed on cloud servers operated by their respective providers
                  (OpenAI, Anthropic, Google, etc.). Your requests and data are sent to these external services over
                  encrypted connections. For maximum privacy, consider using local models (marked with
                  <span className="inline-flex items-center gap-1 mx-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span className="font-medium">(Local)</span>
                  </span>
                  ) which run entirely on your device.
                </p>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                placeholder="sk-or-v1-..."
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    save();
                  }
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-200">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {saved && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3 border border-green-200">
                <CheckCircle2 size={16} />
                <span>API key saved successfully!</span>
              </div>
            )}

            {/* Save Button */}
            <button
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium px-6 py-3 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              onClick={save}
              disabled={loading || !key.trim()}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Save API Key</span>
                </>
              )}
            </button>
          </div>

          {/* Security Note */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              🔒 Your API key is stored securely in the local database and only used by the backend for API requests.
              It never leaves your device and is not shared with any third parties.
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">What is OpenRouter?</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            OpenRouter is a unified API that gives you access to hundreds of AI models from different providers
            (Anthropic, OpenAI, Google, Meta, and more) through a single interface. Many models offer free tiers
            with generous limits, making it perfect for experimentation.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            <strong>Important:</strong> All OpenRouter models are cloud-based, meaning your queries are processed
            on remote servers operated by the respective AI providers. Your data is transmitted over encrypted
            connections, but it does leave your device for processing.
          </p>
          <a
            href="https://openrouter.ai/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Learn more <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}


