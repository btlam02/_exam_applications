# assessment/services/question_pipeline.py
from typing import List, Dict, Any, Optional

from django.db import transaction

from ..models import (
    Subject,
    Topic,
    Question,
    QuestionOption,
    QuestionIRT,
    CandidateQuestion,
)


from ..services.llm_generation import generate_candidates_from_llm
from ..services.llm_evaluation import (
    build_deepseek_eval_prompt,
    call_deepseek_for_eval,
    compute_overall_score,
    should_auto_accept,
)


def _compute_question_difficulty_score(q: Question) -> float:
    """
    Chuẩn hóa độ khó câu hỏi về khoảng [0,1] để đưa cho LLM làm ví dụ.

    Ưu tiên:
    1) Nếu có IRT.b (thường trong [-3, 3]) -> map tuyến tính sang [0,1]
    2) Nếu có difficulty_tag (easy/medium/hard) -> map sơ bộ
    3) Nếu không có gì -> 0.5
    """
    # 1) Dựa trên IRT nếu có
    if hasattr(q, "irt") and q.irt is not None and q.irt.b is not None:
        b = float(q.irt.b)
        # map từ [-3, 3] -> [0, 1]
        b_clamped = max(-3.0, min(3.0, b))
        return (b_clamped + 3.0) / 6.0

    # 2) Dựa trên difficulty_tag
    if q.difficulty_tag:
        tag_map = {
            "easy": 0.25,
            "medium": 0.5,
            "hard": 0.75,
        }
        return tag_map.get(q.difficulty_tag.lower(), 0.5)

    # 3) Mặc định
    return 0.5


def get_seed_questions(subject_id: int, topic_id: Optional[int], k: int = 5) -> List[Dict[str, Any]]:
    """
    Lấy k câu hỏi mẫu (seed) từ DB cho cùng môn + (nếu có) cùng topic.

    Trả về list dict:
    [
      {
        "stem": "...",
        "options": [{label, content, is_correct}],
        "difficulty_score": float in [0,1],
      },
      ...
    ]
    """
    qs = Question.objects.filter(subject_id=subject_id)

    # 🔧 QUAN TRỌNG: dùng related_name="tags" trên QuestionTag
    # KHÔNG dùng 'tag__topic_id' hay 'questiontag__topic_id'
    if topic_id is not None:
        qs = qs.filter(tags__topic_id=topic_id)

    # Prefetch để tránh N+1 query
    qs = (
        qs.prefetch_related("options", "irt", "stats", "tags")
          .order_by("?")[:k]
    )

    items: List[Dict[str, Any]] = []
    for q in qs:
        opts = [
            {
                "label": o.label,
                "content": o.content,
                "is_correct": o.is_correct,
            }
            for o in q.options.all().order_by("label")
        ]

        diff_score = _compute_question_difficulty_score(q)

        items.append(
            {
                "stem": q.stem,
                "options": opts,
                "difficulty_score": diff_score,
            }
        )

    return items


@transaction.atomic
def generate_candidate_questions(
    subject: Subject,
    topic: Topic,
    target_difficulty: str,
    num_questions: int,
) -> List[CandidateQuestion]:
    """
    Pipeline đầy đủ:

    1) Lấy seed questions (cùng subject + topic nếu có)
    2) Gọi Gemini sinh câu hỏi mới
    3) Mỗi câu mới:
        - Gửi sang DeepSeek để đánh giá định tính/định lượng
        - Tính các metric (difficulty_alignment, agreement, overall_score)
        - Lưu vào CandidateQuestion (status: accepted/pending)
    """
    # 1) Seed từ DB
    seed_items = get_seed_questions(subject.id, topic.id, k=5)

    # 2) Gọi Gemini sinh câu hỏi mới
    candidates_raw = generate_candidates_from_llm(
        seed_items=seed_items,
        subject_name=subject.name,
        topic_name=topic.name,
        target_difficulty=target_difficulty,
        num_questions=num_questions,
    )

    result: List[CandidateQuestion] = []

    for cand_raw in candidates_raw:
        stem = cand_raw.get("question")
        options = cand_raw.get("options", [])
        answer = cand_raw.get("answer", "A")

        if not stem or len(options) < 2:
            # Bỏ qua câu lỗi/thiếu data
            continue

        answer = str(answer).strip().upper()

        diff_g = cand_raw.get("difficulty_score")
        diff_label_g = cand_raw.get("difficulty_label")

        # 3) Đánh giá bằng DeepSeek (định tính + định lượng)
        eval_prompt = build_deepseek_eval_prompt(seed_items, cand_raw)
        eval_metrics = call_deepseek_for_eval(eval_prompt)

        # Bổ sung các chỉ số định lượng: difficulty_alignment, agreement, overall_score
        eval_metrics = compute_overall_score(
            eval_metrics,
            target_difficulty=target_difficulty,
            d_gemini=diff_g,
        )

        auto_accept = should_auto_accept(eval_metrics)

        cq = CandidateQuestion.objects.create(
            subject=subject,
            topic=topic,
            stem=stem,
            options_json=options,  # list string ["...", "..."]
            correct_answer=answer,
            target_difficulty=target_difficulty,
            difficulty_score_gemini=diff_g,
            difficulty_label_gemini=diff_label_g,
            difficulty_score_deepseek=eval_metrics.get("difficulty_score_deepseek"),
            difficulty_label_deepseek=eval_metrics.get("difficulty_label_deepseek"),
            validity=eval_metrics.get("validity"),
            on_topic=eval_metrics.get("on_topic"),
            clarity=eval_metrics.get("clarity"),
            single_correct=eval_metrics.get("single_correct"),
            similarity_to_examples=eval_metrics.get("similarity_to_examples"),
            overall_score=eval_metrics.get("overall_score"),
            comment=eval_metrics.get("comment"),
            status="accepted" if auto_accept else "pending",
        )
        result.append(cq)

        # Nếu muốn auto-promote ngay khi auto_accept, có thể gọi promote_candidate_to_question(cq)
        # ở đây (hoặc để admin duyệt thủ công).

    return result


@transaction.atomic
def promote_candidate_to_question(candidate: CandidateQuestion) -> Question:
    """
    Chuyển một CandidateQuestion (đã được duyệt) thành Question + QuestionOption + QuestionIRT.

    - Question: stem, subject, item_type="MCQ", difficulty_tag: lấy từ DeepSeek/Gemini
    - Options: từ options_json, gán A/B/C/D..., xác định đáp án đúng theo correct_answer
    - IRT: tạo bản ghi QuestionIRT với (a, b, c) suy từ difficulty_score của 2 LLM
    """
    # 1) Tạo Question
    difficulty_tag = (
        candidate.difficulty_label_deepseek
        or candidate.difficulty_label_gemini
        or candidate.target_difficulty
    )

    q = Question.objects.create(
        subject=candidate.subject,
        stem=candidate.stem,
        item_type="MCQ",
        difficulty_tag=difficulty_tag,
        # KHÔNG có field difficulty_score trên Question, nên không truyền vào
    )

    # 2) Tạo QuestionOption
    options = candidate.options_json or []
    # correct_answer: "A" -> index 0, "B" -> 1, ...
    try:
        correct_idx = ord(candidate.correct_answer.strip().upper()) - ord("A")
    except Exception:
        correct_idx = 0

    for i, content in enumerate(options):
        QuestionOption.objects.create(
            question=q,
            label=chr(ord("A") + i),
            content=str(content),
            is_correct=(i == correct_idx),
        )

    # 3) Tạo IRT: sử dụng trung bình difficulty_score từ Gemini + DeepSeek
    d_g = candidate.difficulty_score_gemini
    d_d = candidate.difficulty_score_deepseek

    if d_g is None and d_d is None:
        b_score = 0.5
    elif d_g is None:
        b_score = float(d_d)
    elif d_d is None:
        b_score = float(d_g)
    else:
        b_score = (float(d_g) + float(d_d)) / 2.0

    # map [0,1] -> [-1,1] tạm (có thể thay bằng [-3,3] nếu bạn muốn sát IRT hơn)
    b = 2.0 * (b_score - 0.5)
    a = 1.0    # discrimination mặc định
    c = 0.25   # guessing mặc định

    QuestionIRT.objects.create(
        question=q,
        a=a,
        b=b,
        c=c,
    )

    # 4) Cập nhật trạng thái CandidateQuestion
    candidate.status = "accepted"
    candidate.save(update_fields=["status"])

    return q
