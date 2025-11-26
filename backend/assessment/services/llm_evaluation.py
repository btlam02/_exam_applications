# assessment/services/llm_evaluation.py
import json
from typing import Dict, Any

from django.conf import settings
from openai import OpenAI


if not getattr(settings, "DEEPSEEK_API_KEY", None):
    raise RuntimeError("DEEPSEEK_API_KEY chưa được cấu hình trong settings.")

deepseek_client = OpenAI(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com",
)


def build_deepseek_eval_prompt(seed_items, candidate: Dict[str, Any]) -> str:
    """
    seed_items: giống ở trên
    candidate: {"question", "options", "answer", ...}
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

    opts_candidate = "\n".join(
        f"{chr(ord('A') + i)}. {opt}" for i, opt in enumerate(candidate["options"])
    )

    prompt = f"""
Bạn là trợ lý đánh giá chất lượng câu hỏi trắc nghiệm.

Các ví dụ câu hỏi trên cùng chủ đề và độ khó đã biết:
{examples_str}

Câu hỏi mới cần đánh giá:
Câu hỏi: {candidate['question']}
Lựa chọn:
{opts_candidate}
Đáp án đúng mà hệ thống sinh là: {candidate['answer']}

Nhiệm vụ của bạn:
1. Kiểm tra câu hỏi có:
   - Rõ ràng, không mơ hồ?
   - Đúng kiến thức?
   - Phù hợp với chủ đề như các ví dụ?
   - Chỉ có 1 đáp án đúng?
2. Đánh giá lại độ khó trong khoảng [0,1] (0 rất dễ, 1 rất khó).
3. Gán nhãn độ khó: Easy / Medium / Hard.
4. Cho điểm các tiêu chí sau (0-1):
   - validity: tính hợp lệ của câu hỏi
   - on_topic: đúng chủ đề
   - clarity: rõ ràng
   - single_correct: mức tin tưởng chỉ có 1 đáp án đúng
   - similarity_to_examples: 0 = hoàn toàn mới, 1 = gần như trùng lặp
5. Đưa ra nhận xét ngắn.

Trả về JSON:
{{
  "difficulty_score_deepseek": 0.7,
  "difficulty_label_deepseek": "Hard",
  "validity": 0.9,
  "on_topic": 0.95,
  "clarity": 0.9,
  "single_correct": 0.85,
  "similarity_to_examples": 0.3,
  "comment": "..."
}}
Chỉ trả JSON.
""".strip()
    return prompt


def _extract_json_from_deepseek(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = text[start:end+1]
        return json.loads(snippet)
    # nếu vẫn fail thì ném lỗi để mình thấy prompt/model đang trả không đúng format
    return json.loads(text)


def call_deepseek_for_eval(prompt: str) -> Dict[str, Any]:
    """
    Gọi DeepSeek thật để đánh giá câu hỏi.
    """
    resp = deepseek_client.chat.completions.create(
        model="deepseek-chat", 
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=512,
        response_format={"type": "json_object"},  # yêu cầu JSON
    )

    content = resp.choices[0].message.content
    data = _extract_json_from_deepseek(content)
    return data


def compute_overall_score(metrics: Dict[str, Any],
                          target_difficulty: str,
                          d_gemini: float | None) -> Dict[str, Any]:
    """
    Tính các chỉ số định lượng:
    - difficulty_alignment: bám sát độ khó target
    - agreement: Gemini vs DeepSeek
    - overall_score: điểm tổng hợp
    """
    v = float(metrics.get("validity", 0.0))
    ot = float(metrics.get("on_topic", 0.0))
    cl = float(metrics.get("clarity", 0.0))
    sc = float(metrics.get("single_correct", 0.0))
    d_deep = float(metrics.get("difficulty_score_deepseek", 0.5))

    # 1) difficulty_alignment
    target_map = {"Easy": 0.2, "Medium": 0.5, "Hard": 0.8}
    target_score = target_map.get(target_difficulty, 0.5)
    d_mean = d_deep
    if d_gemini is not None:
        d_mean = (d_gemini + d_deep) / 2.0

    diff_to_target = abs(d_mean - target_score)
    difficulty_alignment = max(0.0, 1.0 - diff_to_target)   # càng gần target càng tốt

    # 2) agreement giữa Gemini & DeepSeek
    if d_gemini is not None:
        diff_models = abs(d_gemini - d_deep)
        agreement = max(0.0, 1.0 - diff_models)             # chênh lệch càng nhỏ càng tốt
    else:
        agreement = 0.5

    # 3) overall_score
    overall = (
        0.3 * v +
        0.2 * ot +
        0.15 * cl +
        0.15 * sc +
        0.1 * difficulty_alignment +
        0.1 * agreement
    )

    metrics["difficulty_alignment"] = difficulty_alignment
    metrics["agreement"] = agreement
    metrics["overall_score"] = overall
    return metrics


def should_auto_accept(metrics: Dict[str, Any], similarity_threshold: float = 0.7,
                       overall_threshold: float = 0.8) -> bool:
    """
    Luật quyết định có nhận câu hỏi (auto-accept) không.
    """
    v = metrics.get("validity", 0.0)
    ot = metrics.get("on_topic", 0.0)
    cl = metrics.get("clarity", 0.0)
    sc = metrics.get("single_correct", 0.0)
    sim = metrics.get("similarity_to_examples", 1.0)
    overall = metrics.get("overall_score", 0.0)

    if not (v >= 0.8 and ot >= 0.8 and cl >= 0.7 and sc >= 0.8):
        return False
    if sim > similarity_threshold:
        return False
    if overall < overall_threshold:
        return False
    return True
