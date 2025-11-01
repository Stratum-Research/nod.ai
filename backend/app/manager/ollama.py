import ollama


class OllamaManager:
    def __init__(self):
        self.client = ollama.Client()  # or just use ollama directly

    def list_models(self):
        models = ollama.list()  # Direct function call
        return models

    def delete_model(self, model_name: str):
        ollama.delete(model=model_name)  # Direct function call

    def chat(self, model_name: str, message: str):
        response = ollama.chat(
            model=model_name, messages=[{"role": "user", "content": message}]
        )
        return response["message"]["content"]
