"""OpenSource LLM provider using llama-cpp-python."""

from typing import List, Dict, Optional, AsyncGenerator
from pathlib import Path
import json
import asyncio
import os

_IMPORT_ERROR = None
try:
    from llama_cpp import Llama

    HAS_LLAMA_CPP = True
except ImportError as e:
    HAS_LLAMA_CPP = False
    Llama = None
    _IMPORT_ERROR = str(e)
except Exception as e:
    # Catch any other import-related errors
    HAS_LLAMA_CPP = False
    Llama = None
    _IMPORT_ERROR = str(e)


class OpenSourceProvider:
    """Provider for local open-source models via llama-cpp-python."""

    @property
    def name(self) -> str:
        return "opensource"

    def __init__(self, registry_path: Optional[str] = None):
        """Initialize OpenSource provider."""
        if not HAS_LLAMA_CPP:
            error_msg = "llama-cpp-python not installed. Install with: pip install llama-cpp-python"
            if _IMPORT_ERROR:
                error_msg += f" (Error: {_IMPORT_ERROR})"
            raise ImportError(error_msg)

        # Load registry
        if registry_path is None:
            # Default to providers/opensource/registry.json
            registry_path = Path(__file__).parent / "registry.json"

        self.registry_path = Path(registry_path)
        if not self.registry_path.exists():
            raise FileNotFoundError(f"Registry not found: {self.registry_path}")

        with open(self.registry_path, "r") as f:
            self.registry = json.load(f)

        # Cache loaded models
        self._model_cache: Dict[str, Llama] = {}

        # Track download status
        self._download_cache: Dict[str, bool] = {}

    def get_model_info(self, model_id: str) -> Optional[Dict]:
        """Public helper to fetch model info from the registry."""
        # Model ID format: "opensource:repo_id" or just "repo_id"
        actual_id = model_id.replace("opensource:", "", 1)
        for model in self.registry:
            if model["repo_id"] == actual_id:
                return model
        return None

    def check_model_downloaded(self, repo_id: str, filename: str) -> bool:
        """Check if model file is already downloaded locally."""
        cache_key = f"{repo_id}:{filename}"
        if cache_key in self._download_cache:
            return self._download_cache[cache_key]

        # Check HuggingFace cache (where llama-cpp downloads from)
        try:
            from huggingface_hub import hf_hub_download

            # HuggingFace cache is usually ~/.cache/huggingface/hub
            # Try to get the cached file path without downloading
            try:
                # This will return the cached path if exists, or raise if not cached
                cached_path = hf_hub_download(
                    repo_id=repo_id,
                    filename=filename,
                    cache_dir=None,  # Use default cache
                    local_files_only=True,  # Only check local cache, don't download
                )
                from pathlib import Path

                exists = Path(cached_path).exists() if cached_path else False
            except Exception:
                # If local_files_only=True fails, file doesn't exist locally
                exists = False

            self._download_cache[cache_key] = exists
            return exists
        except Exception as e:
            # If check fails, assume not downloaded
            print(
                f"Warning: Could not check download status for {repo_id}/{filename}: {e}"
            )
            return False

    def _load_model(
        self, repo_id: str, filename: str, force_download: bool = False
    ) -> Llama:
        """Load a model (with caching). Downloads automatically if not present."""
        cache_key = f"{repo_id}:{filename}"
        if cache_key in self._model_cache:
            return self._model_cache[cache_key]

        # Llama.from_pretrained will download automatically if not present
        llm = Llama.from_pretrained(
            repo_id=repo_id,
            filename=filename,
            verbose=False,
            download_dir=(
                None
                if not force_download
                else str(Path.home() / ".cache" / "llama-cpp-python")
            ),
        )
        self._model_cache[cache_key] = llm
        self._download_cache[cache_key] = True  # Mark as downloaded after loading
        return llm

    async def download_model(self, repo_id: str, filename: str) -> Dict[str, str]:
        """Download/prepare a model file."""
        loop = asyncio.get_event_loop()

        def download_sync():
            """Download model synchronously."""
            try:
                # This will download if not present
                llm = Llama.from_pretrained(
                    repo_id=repo_id, filename=filename, verbose=True  # Show progress
                )
                return {
                    "status": "downloaded",
                    "repo_id": repo_id,
                    "filename": filename,
                }
            except Exception as e:
                return {"status": "error", "error": str(e)}

        result = await loop.run_in_executor(None, download_sync)
        if result["status"] == "downloaded":
            cache_key = f"{repo_id}:{filename}"
            self._download_cache[cache_key] = True
        return result

    async def delete_model(self, repo_id: str, filename: str) -> Dict[str, str]:
        """Delete a downloaded model file from HuggingFace cache."""
        loop = asyncio.get_event_loop()

        def delete_sync():
            """Delete model synchronously."""
            try:
                from huggingface_hub import hf_hub_download

                cache_key = f"{repo_id}:{filename}"

                # Remove from memory cache if loaded
                if cache_key in self._model_cache:
                    del self._model_cache[cache_key]

                # Try to get the cached file path
                try:
                    cached_path = hf_hub_download(
                        repo_id=repo_id,
                        filename=filename,
                        cache_dir=None,  # Use default cache
                        local_files_only=True,  # Only check local cache, don't download
                    )

                    if cached_path and Path(cached_path).exists():
                        # Delete the cached file
                        os.remove(cached_path)

                        # Also try to clean up any related files in the same directory
                        # HuggingFace may store additional metadata files
                        cache_dir = Path(cached_path).parent
                        try:
                            # Delete lock files, incomplete downloads, etc.
                            for related_file in cache_dir.glob(
                                f"{Path(cached_path).stem}*"
                            ):
                                if related_file != Path(cached_path):
                                    try:
                                        if related_file.is_file():
                                            os.remove(related_file)
                                    except Exception:
                                        pass  # Ignore errors on cleanup files
                        except Exception:
                            pass  # Ignore cleanup errors

                        # Clear download cache
                        if cache_key in self._download_cache:
                            del self._download_cache[cache_key]

                        return {
                            "status": "deleted",
                            "repo_id": repo_id,
                            "filename": filename,
                        }
                    else:
                        return {
                            "status": "not_found",
                            "repo_id": repo_id,
                            "filename": filename,
                        }
                except Exception as e:
                    # File doesn't exist or error finding it
                    # Clear cache entries anyway
                    if cache_key in self._download_cache:
                        del self._download_cache[cache_key]
                    if cache_key in self._model_cache:
                        del self._model_cache[cache_key]

                    # Check if it's a "not found" type error
                    if (
                        "not found" in str(e).lower()
                        or "local_files_only" in str(e).lower()
                    ):
                        return {
                            "status": "not_found",
                            "repo_id": repo_id,
                            "filename": filename,
                        }
                    return {"status": "error", "error": str(e)}
            except Exception as e:
                return {"status": "error", "error": str(e)}

        return await loop.run_in_executor(None, delete_sync)

    async def list_models(self, **kwargs) -> List[Dict]:
        """List available models from registry."""
        models = []
        for model in self.registry:
            # Use friendly name if provided, otherwise derive from repo_id
            repo_id = model["repo_id"]
            # Extract model name (e.g., "Qwen2.5-0.5B-Instruct-GGUF" -> "Qwen 2.5 0.5B Instruct")
            name = model.get("name")
            if not name:
                # Try to create a friendly name from repo_id
                parts = repo_id.split("/")
                if len(parts) == 2:
                    model_part = parts[1]
                    # Replace common patterns
                    name = (
                        model_part.replace("-Instruct-GGUF", " Instruct")
                        .replace("-GGUF", "")
                        .replace("-", " ")
                    )

            # Check download status
            is_downloaded = self.check_model_downloaded(repo_id, model["filename"])

            models.append(
                {
                    "id": f"opensource:{repo_id}",
                    "name": name or repo_id,
                    "object": "model",
                    "provider": "opensource",
                    "repo_id": repo_id,
                    "filename": model["filename"],
                    # Mark as free since it's local
                    "pricing": {},
                    "downloaded": is_downloaded,
                    "size_gb": model.get("size"),  # Include size if available
                }
            )
        return models

    async def stream_chat(
        self, model: str, messages: List[Dict[str, str]], **kwargs
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion from local model."""
        # Get model info
        model_info = self.get_model_info(model)
        if not model_info:
            raise ValueError(f"Model not found in registry: {model}")

        # Load model (will auto-download if not present, but may take time)
        llm = self._load_model(model_info["repo_id"], model_info["filename"])

        # llama-cpp-python's create_chat_completion with stream=True returns a generator
        # It's OpenAI-compatible format: {"choices": [{"delta": {"content": "..."}, "finish_reason": null}]}
        def generate_chunks():
            """Generator function that runs in thread."""
            response = llm.create_chat_completion(
                messages=messages, stream=True, **kwargs
            )
            for chunk in response:
                yield chunk

        # Use queue to bridge sync generator to async
        import queue

        chunk_queue = queue.Queue()
        loop = asyncio.get_event_loop()
        done = False

        def run_inference():
            """Run inference in thread and put chunks in queue."""
            try:
                for chunk in generate_chunks():
                    chunk_queue.put(chunk)
                chunk_queue.put(None)  # Sentinel
            except Exception as e:
                chunk_queue.put(("error", str(e)))

        # Start inference in background
        executor_task = loop.run_in_executor(None, run_inference)

        # Stream chunks as they arrive
        try:
            while not done:
                # Use run_in_executor to wait for queue.get() without blocking event loop
                chunk = await loop.run_in_executor(None, chunk_queue.get)

                if chunk is None:
                    done = True
                    break
                if isinstance(chunk, tuple) and chunk[0] == "error":
                    raise Exception(chunk[1])

                # Parse OpenAI-compatible format: {"choices": [{"delta": {"content": "..."}}]}
                choice = chunk.get("choices", [{}])[0]
                delta = choice.get("delta", {}) or {}
                content = delta.get("content")

                if content:
                    yield json.dumps({"type": "content", "delta": content}) + "\n"

                # Check for finish reason
                if choice.get("finish_reason"):
                    done = True
                    break
        finally:
            # Wait for executor to finish
            await executor_task

    def is_model_available(self, model_id: str) -> bool:
        """Check if model belongs to OpenSource provider."""
        # Check if model_id starts with "opensource:" prefix
        if model_id.startswith("opensource:"):
            return self.get_model_info(model_id) is not None
        # Also check without prefix for convenience
        return self.get_model_info(f"opensource:{model_id}") is not None
