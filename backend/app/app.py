from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config.config import SECRET_KEY, ALLOWED_ORIGINS
from app.api import root, data, openrouter, models, opensource
from app.db.sqlite import init_db
from app.providers.registry import get_registry
from app.providers.openrouter import OpenRouterProvider
from app.providers.opensource import OpenSourceProvider

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
    
    # Initialize providers
    registry = get_registry()
    
    # Register OpenRouter provider (will be instantiated per-request with API key)
    try:
        # Just register the class, actual instances created per-request
        from app.settings import get_setting
        api_key = get_setting("openrouter_key")
        if api_key:
            openrouter_provider = OpenRouterProvider(api_key=api_key)
            registry.register(openrouter_provider)
    except Exception as e:
        print(f"⚠️  OpenRouter provider not registered: {e}")
    
    # Register OpenSource provider
    try:
        opensource_provider = OpenSourceProvider()
        registry.register(opensource_provider)
        print("✅ OpenSource provider registered")
    except Exception as e:
        print(f"⚠️  OpenSource provider not registered: {e}")

@app.middleware("http")
async def verify_secret_header(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    # Allow health check endpoint without auth
    if request.url.path == "/health":
        return await call_next(request)
    if request.headers.get("x-app-secret") != SECRET_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    return await call_next(request)

app.include_router(root.router)
app.include_router(data.router, prefix="/data")
app.include_router(openrouter.router)  # Keep for backward compatibility
app.include_router(models.router)  # New unified models endpoint
app.include_router(opensource.router)  # OpenSource model management
