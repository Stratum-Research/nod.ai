# from transformers import AutoTokenizer, AutoModelForCausalLM
# import torch


# def chat(model_id: str, message: str, max_new_tokens: int = 200):
#     tokenizer = AutoTokenizer.from_pretrained(model_id)
#     model = AutoModelForCausalLM.from_pretrained(
#         model_id,
#         device_map="auto",
#         dtype=torch.float16,
#     )

#     # 1️⃣ Create the conversation
#     messages = [{"role": "user", "content": message}]

#     # 2️⃣ Build the text prompt (not tokenized yet)
#     prompt_text = tokenizer.apply_chat_template(
#         messages, add_generation_prompt=True, tokenize=False
#     )

#     # 3️⃣ Tokenize manually → gives a dict with input_ids & attention_mask
#     inputs = tokenizer(prompt_text, return_tensors="pt").to(model.device)

#     # 4️⃣ Generate
#     outputs = model.generate(
#         **inputs,
#         max_new_tokens=max_new_tokens,
#         temperature=0.7,
#         top_p=0.9,
#         do_sample=True,
#     )

#     # 5️⃣ Decode only new tokens (skip the input prompt)
#     new_tokens = outputs[0][inputs.input_ids.shape[1] :]
#     reply = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
#     return reply


# if __name__ == "__main__":
#     print("🤖", chat("Qwen/Qwen2.5-1.5B-Instruct", "Who are you?"))

from vllm import LLM, SamplingParams


def main():
    prompt = "How does the mitochondria induce apoptosis?"

    sampling_params = SamplingParams(temperature=0.8, top_p=0.95)
    llm = LLM(model="Qwen/Qwen3-0.6B", max_model_len=4096, disable_log_stats=True)
    responses = llm.generate([prompt], sampling_params)

    for response in responses:
        print(response.outputs[0].text)


if __name__ == "__main__":
    main()
