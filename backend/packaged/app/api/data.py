from fastapi import APIRouter
from app.manager.ollama import OllamaManager

router = APIRouter()


@router.get("/")
async def read_data():
    return {"message": "Hello from the Data Endpoint myan"}


@router.get("/chat/{model_name}/{message}")
async def chat(model_name: str, message: str):
    om = OllamaManager()
    response = om.chat(model_name, message)
    return {"response": response}


@router.get("/list-models")
async def list_models():
    om = OllamaManager()
    models = om.list_models()
    return {"models": models}
