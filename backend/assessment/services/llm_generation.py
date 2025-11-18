# assessment/services/llm_generation.py
import json
from typing import List, Dict, Any

from django.conf import settings
import google.generativeai as genai


# Cấu hình Gemini 1 lần ở mức module
if not getattr(settings, "GEMINI_API_KEY", None):
    raise RuntimeError("GEMINI_API_KEY chưa được cấu hình trong settings.")

genai.configure(api_key=settings.GEMINI_API_KEY)

# Nên chọn model rẻ để thử trước, ví dụ: "gemini-1.5-flash"
GEMINI_MODEL_NAME = "gemini-2.5-flash"


def build_gemini_prompt(seed_items, subject_name: str, topic_name: str,
                        target_difficulty: str, num_questions: int) -> str:
    """
    seed_items: list[{stem, options: [{label, content, is_correct}], difficulty_score}]
    """
    examples_str = ""
    for i, item in enumerate(seed_items, 1):
        opts_str = "\n".join(
            f"{o['label']}. {o['content']}" for o in item["options"]
        )
        diff = item.get("difficulty_score", "N/A")
        examples_str += f"""
Ví dụ {i}:
Câu hỏi: {item['stem']}
Lựa chọn:
{opts_str}
Độ khó (0-1): {diff}
""".strip() + "\n\n"

    prompt = f"""
Bạn là hệ thống sinh câu hỏi trắc nghiệm.

Môn: {subject_name}
Chủ đề: {topic_name}
Độ khó mong muốn: {target_difficulty} (Easy/Medium/Hard)

Dưới đây là một số ví dụ câu hỏi đã có:

{examples_str}

Hãy sinh ra {num_questions} câu hỏi MỚI (không trùng lặp nội dung, không đảo chữ đơn giản),
cùng chủ đề, cùng môn, với độ khó tương đương {target_difficulty}.

Yêu cầu mỗi câu:
- 4 lựa chọn A/B/C/D, đúng 1 đáp án.
- Ghi rõ đáp án đúng.
- Viết lời giải thích ngắn
- Gán độ khó (0-1) và nhãn Easy/Medium/Hard.
- Ước lượng IRT: a (0.5-2.0), b (-3 đến 3), c (0-0.25).

Trả về JSON với cấu trúc:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answer": "B",
      "explanation": "...",
      "difficulty_label": "Medium",
      "difficulty_score": 0.6,
      "irt": {{"a": 1.2, "b": 0.4, "c": 0.25}}
    }}
  ]
}}
Chỉ trả JSON thuần, không giải thích thêm.
""".strip()
    return prompt


def _extract_json_from_text(text: str) -> Dict[str, Any]:
    """
    Gemini đôi khi trả thêm chữ linh tinh, code block...
    Hàm này cố gắng bóc phần JSON.
    """
    text = text.strip()
    # Nếu model trả trong ```json ... ``` thì cắt ra
    if text.startswith("```"):
        text = text.strip("`")
        # xoá dòng 'json' nếu có
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except Exception:
        # fallback: cố tìm đoạn {...}
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            snippet = text[start:end+1]
            return json.loads(snippet)
        raise


def call_gemini_for_questions(prompt: str) -> Dict[str, Any]:
    """
    Gọi Gemini thật để sinh câu hỏi.
    """
    model = genai.GenerativeModel(GEMINI_MODEL_NAME)

    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.6,
            "top_p": 0.9,
            "top_k": 40,
            "max_output_tokens": 2048,
        },
    )

    # Lấy text đầu tiên
    if not response.candidates:
        return {"questions": []}

    text = response.candidates[0].content.parts[0].text
    data = _extract_json_from_text(text)

    # Đảm bảo structure có "questions"
    if "questions" not in data or not isinstance(data["questions"], list):
        data["questions"] = []
    return data


def generate_candidates_from_llm(seed_items, subject_name: str,
                                 topic_name: str, target_difficulty: str,
                                 num_questions: int) -> List[Dict[str, Any]]:
    """
    Hàm gọi Gemini để sinh câu hỏi mới.
    Trả về list dict {question, options, answer, difficulty_score, ...}
    """
    prompt = build_gemini_prompt(
        seed_items, subject_name, topic_name,
        target_difficulty, num_questions
    )
    data = call_gemini_for_questions(prompt)
    qs = data.get("questions", [])
    if not isinstance(qs, list):
        return []
    return qs
