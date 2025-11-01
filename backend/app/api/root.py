from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def read_root():
    return {"message": "Hello World", "status": "ok"}

@router.get("/health")
async def health_check():
    """Health check endpoint - no auth required for diagnostics"""
    return {"status": "ok", "message": "Backend is running"}
