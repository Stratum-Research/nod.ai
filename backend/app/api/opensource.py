"""OpenSource model management endpoints."""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from urllib.parse import unquote
import shutil
from pathlib import Path
from app.providers.registry import get_registry

router = APIRouter(prefix="/opensource", tags=["opensource"])


@router.get("/disk-space")
async def get_disk_space():
    """Get available disk space in GB."""
    try:
        # Get free space from home directory (where models are typically cached)
        cache_dir = Path.home() / ".cache" / "llama-cpp-python"
        cache_dir.parent.mkdir(parents=True, exist_ok=True)
        
        stat = shutil.disk_usage(cache_dir.parent)
        free_gb = stat.free / (1024 ** 3)  # Convert bytes to GB
        total_gb = stat.total / (1024 ** 3)
        
        return {
            "free_gb": round(free_gb, 2),
            "total_gb": round(total_gb, 2),
            "used_gb": round(total_gb - free_gb, 2)
        }
    except Exception as e:
        return {"free_gb": 0, "total_gb": 0, "used_gb": 0, "error": str(e)}


@router.get("/models/{model_id:path}/status")
async def get_model_status(model_id: str):
    """Get download status for an OpenSource model."""
    registry = get_registry()
    provider = registry.get("opensource")
    
    if not provider:
        raise HTTPException(status_code=503, detail="OpenSource provider not available")
    
    # URL decode the model_id (handles encoded slashes like %2F)
    model_id = unquote(model_id)
    
    # Parse model_id (format: opensource:repo_id)
    model_info = provider._get_model_info(model_id)
    
    if not model_info:
        available = [f"opensource:{m['repo_id']}" for m in provider.registry]
        raise HTTPException(
            status_code=404, 
            detail=f"Model not found in registry. Received: {model_id}. Available models: {available}"
        )
    
    is_downloaded = provider.check_model_downloaded(
        model_info["repo_id"],
        model_info["filename"]
    )
    
    return {
        "model_id": model_id,
        "repo_id": model_info["repo_id"],
        "filename": model_info["filename"],
        "downloaded": is_downloaded,
    }


@router.post("/models/{model_id:path}/download")
async def download_model(model_id: str):
    """Download/prepare an OpenSource model."""
    registry = get_registry()
    provider = registry.get("opensource")
    
    if not provider:
        raise HTTPException(status_code=503, detail="OpenSource provider not available")
    
    # URL decode the model_id (handles encoded slashes like %2F)
    model_id = unquote(model_id)
    
    # Parse model_id (format: opensource:repo_id)
    model_info = provider._get_model_info(model_id)
    
    if not model_info:
        available = [f"opensource:{m['repo_id']}" for m in provider.registry]
        raise HTTPException(
            status_code=404, 
            detail=f"Model not found in registry. Received: {model_id}. Available models: {available}"
        )
    
    try:
        result = await provider.download_model(
            model_info["repo_id"],
            model_info["filename"]
        )
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Download failed"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@router.delete("/models/{model_id:path}")
async def delete_model(model_id: str):
    """Delete a downloaded OpenSource model."""
    registry = get_registry()
    provider = registry.get("opensource")
    
    if not provider:
        raise HTTPException(status_code=503, detail="OpenSource provider not available")
    
    # URL decode the model_id (handles encoded slashes like %2F)
    model_id = unquote(model_id)
    
    # Parse model_id (format: opensource:repo_id)
    model_info = provider._get_model_info(model_id)
    
    if not model_info:
        available = [f"opensource:{m['repo_id']}" for m in provider.registry]
        raise HTTPException(
            status_code=404, 
            detail=f"Model not found in registry. Received: {model_id}. Available models: {available}"
        )
    
    try:
        result = await provider.delete_model(
            model_info["repo_id"],
            model_info["filename"]
        )
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Delete failed"))
        if result.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Model not found in cache")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

