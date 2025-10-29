# assessment/services/rules.py
from __future__ import annotations
from collections import defaultdict
from datetime import timedelta
import random

from django.db.models import Q, F, Count, Avg
from django.utils import timezone

def evaluate_rules(student_id: int, subject_id: int) -> dict:
    """
    Gom các luật đang bật -> context cho selector.
    Output:
      {
        "topic_boost": {topic_id: weight, ...},
        "difficulty_range": {"b_min": float|None, "b_max": float|None, "lte_position": int|None},
        "block_question_ids": [int, ...]
      }
    """
    from assessment.models import Rule, TestResponse, QuestionTag

    ctx = {
        "topic_boost": {},
        "difficulty_range": None,
        "block_question_ids": set(),
    }

    # --- Mastery theo topic: tỷ lệ đúng 20 câu gần nhất của student ---
    # Nếu chưa có log thì dict rỗng -> không kích hoạt điều kiện "mastery_below".
    latest = (TestResponse.objects
              .filter(session__student_id=student_id, session__subject_id=subject_id)
              .select_related("question")
              .order_by("-answered_at")
              [:200])  # lấy rộng một chút rồi gom theo topic

    # Map question_id -> correctness
    q_correct = {r.question_id: (1 if r.is_correct else 0) for r in latest}

    # Map topic_id -> list of y
    topic_history = defaultdict(list)
    if q_correct:
        # Lấy mapping question -> topics
        from assessment.models import QuestionTag
        rel = (QuestionTag.objects
               .filter(question_id__in=q_correct.keys())
               .values_list("question_id", "topic_id"))
        for qid, tid in rel:
            topic_history[tid].append(q_correct[qid])

    topic_mastery = {}
    for tid, arr in topic_history.items():
        arr = arr[:20]  # chỉ tính 20 câu gần nhất trên topic
        if arr:
            topic_mastery[tid] = sum(arr) / float(len(arr))

    # --- Duyệt Rule ---
    for r in Rule.objects.filter(is_active=True):
        cond = r.condition_json or {}
        act  = r.action_json or {}
        ctype = cond.get("type")
        atype = act.get("type")

        # 1) mastery thấp -> boost topic
        if ctype == "topic_mastery_below" and atype == "boost_topic_probability":
            topic_id = cond.get("topic_id")
            threshold = float(cond.get("threshold", 0.5))
            weight = float(act.get("weight", 1.2))
            mastered = topic_mastery.get(topic_id, None)
            # Nếu chưa có dữ liệu, có thể coi như dưới ngưỡng để ưu tiên luyện, hoặc bỏ qua:
            if mastered is None or mastered < threshold:
                ctx["topic_boost"][topic_id] = max(weight, ctx["topic_boost"].get(topic_id, 1.0))

        # 2) giới hạn độ khó b trong giai đoạn đầu phiên (selector sẽ tự kiểm tra position nếu truyền vào)
        if ctype == "session_stage" and atype == "set_difficulty_range":
            ctx["difficulty_range"] = {
                "b_min": act.get("b_min"),
                "b_max": act.get("b_max"),
                "lte_position": cond.get("lte_position", 5),
            }

        # 3) cooldown phơi nhiễm (ví dụ 7 ngày gần nhất)
        if ctype == "exposure_cooldown" and atype == "block_items":
            days = int(cond.get("days", 7))
            since = timezone.now() - timedelta(days=days)
            recent_qids = (TestResponse.objects
                           .filter(answered_at__gte=since,
                                   session__subject_id=subject_id)
                           .values_list("question_id", flat=True))
            ctx["block_question_ids"].update(recent_qids)

        # 4) block theo một topic cụ thể
        if ctype == "block_topic" and atype == "block_items":
            topic_id = cond.get("topic_id")
            qids = (QuestionTag.objects
                    .filter(topic_id=topic_id)
                    .values_list("question_id", flat=True))
            ctx["block_question_ids"].update(qids)

    ctx["block_question_ids"] = list(ctx["block_question_ids"])
    return ctx


def select_next_item(theta: float,
                     subject_id: int,
                     used_question_ids: set[int],
                     rule_ctx: dict,
                     *,
                     position_in_session: int | None = None):
    """
    Chọn câu tối đa Fisher info + áp ràng buộc:
      - block_question_ids
      - difficulty_range (b_min, b_max, lte_position)
      - topic_boost
    Nếu tie gần nhau, ngẫu nhiên nhẹ để đa dạng.
    """
    from assessment.models import Question
    from assessment.services.irt import fisher_info

    qs = (Question.objects
          .filter(subject_id=subject_id)
          .exclude(id__in=used_question_ids)
          .select_related("irt")
          .prefetch_related("tags"))  # tránh N+1

    block_ids = set(rule_ctx.get("block_question_ids", []))
    topic_boost = rule_ctx.get("topic_boost", {})
    dr = rule_ctx.get("difficulty_range")  # {"b_min","b_max","lte_position"}

    # Nếu có lte_position, chỉ áp range khi vị trí hiện tại thỏa điều kiện
    apply_b_range = False
    b_min = b_max = None
    if dr:
        lte_pos = dr.get("lte_position")
        if lte_pos is None:
            apply_b_range = True
        elif position_in_session is None:
            # Không biết vị trí -> thận trọng: áp dụng range
            apply_b_range = True
        else:
            apply_b_range = (position_in_session <= int(lte_pos))
        b_min = dr.get("b_min"); b_max = dr.get("b_max")

    best = []
    best_score = -1.0

    for q in qs:
        if q.id in block_ids:
            continue

        irt = getattr(q, "irt", None)
        a = getattr(irt, "a", None); b = getattr(irt, "b", None); c = getattr(irt, "c", None)

        # Range độ khó dựa trên b (nếu có)
        if apply_b_range and (b is not None):
            if (b_min is not None and b < b_min) or (b_max is not None and b > b_max):
                continue

        # Tính thông tin Fisher (an toàn khi a/b/c None)
        info = fisher_info(theta, a, b, c) if a is not None and b is not None and c is not None else 0.0
        if info <= 0.0:
            continue

        # Boost theo topic
        boost = 1.0
        for topic_id in q.tags.all().values_list("topic_id", flat=True):
            boost *= topic_boost.get(topic_id, 1.0)

        score = info * boost

        if score > best_score + 1e-9:
            best_score = score
            best = [q]
        elif abs(score - best_score) <= 1e-9:  # tie
            best.append(q)

    if not best:
        return None  # để caller fallback (ví dụ nới range hoặc chọn random)

    # Tie-break: random nhẹ trong top bằng điểm
    return random.choice(best)
