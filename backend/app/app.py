from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config.config import ALLOWED_ORIGINS
from app.api import models, opensource, chats
from app.db.sqlite import init_db
from app.providers.opensource import get_opensource_provider

app = FastAPI()

# Add CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()

    # Initialize OpenSource provider
    try:
        get_opensource_provider()
        print("✅ OpenSource provider ready")
    except Exception as e:
        print(f"⚠️  OpenSource provider not ready: {e}")


app.include_router(chats.router)
app.include_router(models.router)  # New unified models endpoint
app.include_router(opensource.router)  # OpenSource model management
