# assessment/services/rules.py
from __future__ import annotations
from collections import defaultdict
from datetime import timedelta
from typing import Dict, Any, Set, Iterable, Optional
import random

from django.db.models import Q
from django.utils import timezone


def evaluate_rules(
    student_id: int,
    subject_id: int,
    ability_vector: Optional[Dict[int, float]] = None,
) -> dict:
    """
    Gom các luật đang bật -> context cho selector.

    Output:
      {
        "topic_boost": {topic_id: weight, ...},
        "difficulty_range": {"b_min": float|None, "b_max": float|None, "lte_position": int|None},
        "block_question_ids": [int, ...]
      }

    Mục tiêu:
    - Cho phép cấu hình luật "sư phạm" mà không phải đổi code.
    - Dùng mastery (tỉ lệ đúng) + theta (IRT) để điều chỉnh phân phối câu hỏi.
    - Giảm lặp lại câu (exposure cooldown).
    """
    from assessment.models import Rule, TestResponse, QuestionTag

    ctx = {
        "topic_boost": {},        # {topic_id: weight}
        "difficulty_range": None, # {"b_min","b_max","lte_position"}
        "block_question_ids": set(),
    }

    # -------- 1) Tính mastery theo topic (tỉ lệ đúng các câu gần đây) --------
    latest = (
        TestResponse.objects
        .filter(session__student_id=student_id, session__subject_id=subject_id)
        .select_related("question")
        .order_by("-answered_at")[:200]
    )

    # Map question_id -> correctness (lần trả lời gần nhất trong 200 câu)
    q_correct = {r.question_id: (1 if r.is_correct else 0) for r in latest}

    # Map topic_id -> list[y]
    topic_history: Dict[int, list[int]] = defaultdict(list)
    if q_correct:
        rel = (
            QuestionTag.objects
            .filter(question_id__in=q_correct.keys())
            .values_list("question_id", "topic_id")
        )
        for qid, tid in rel:
            topic_history[tid].append(q_correct[qid])

    topic_mastery: Dict[int, float] = {}
    for tid, arr in topic_history.items():
        # Có thể cắt về 20 gần nhất nếu muốn:
        # arr = arr[:20]
        if arr:
            topic_mastery[tid] = sum(arr) / float(len(arr))

    ability_vector = ability_vector or {}

    # -------- 2) Duyệt Rule (hiện tại là global, không filter theo subject) --------
    rules = Rule.objects.filter(is_active=True)

    for r in rules:
        cond: Dict[str, Any] = r.condition_json or {}
        act: Dict[str, Any]  = r.action_json or {}
        ctype = cond.get("type")
        atype = act.get("type")

        # == Rule 1: mastery thấp -> boost topic ==
        # {
        #   "condition_json": {"type": "topic_mastery_below", "topic_id": 1, "threshold": 0.6},
        #   "action_json":    {"type": "boost_topic_probability", "weight": 1.5}
        # }
        if ctype == "topic_mastery_below" and atype == "boost_topic_probability":
            topic_id = cond.get("topic_id")
            if topic_id is None:
                continue
            threshold = float(cond.get("threshold", 0.5))
            weight = float(act.get("weight", 1.2))
            mastered = topic_mastery.get(topic_id, None)
            # Nếu chưa có dữ liệu, có thể xem là dưới ngưỡng để ưu tiên luyện
            if mastered is None or mastered < threshold:
                prev = ctx["topic_boost"].get(topic_id, 1.0)
                ctx["topic_boost"][topic_id] = max(weight, prev)

        # == Rule 2: theta thấp theo topic -> boost topic (dùng IRT) ==
        # {
        #   "condition_json": {"type": "topic_theta_below", "topic_id": 1, "threshold": 0.0},
        #   "action_json":    {"type": "boost_topic_probability", "weight": 1.5}
        # }
        if ctype == "topic_theta_below" and atype == "boost_topic_probability":
            topic_id = cond.get("topic_id")
            if topic_id is None:
                continue
            threshold = float(cond.get("threshold", 0.0))
            weight = float(act.get("weight", 1.5))
            theta = ability_vector.get(topic_id, None)
            # Nếu chưa có theta hoặc theta < threshold -> coi là yếu ở topic đó
            if theta is None or theta < threshold:
                prev = ctx["topic_boost"].get(topic_id, 1.0)
                ctx["topic_boost"][topic_id] = max(weight, prev)

        # == Rule 3: giới hạn độ khó b trong giai đoạn đầu phiên ==
        # {
        #   "condition_json": {"type": "session_stage", "lte_position": 5},
        #   "action_json":    {"type": "set_difficulty_range", "b_min": -2.0, "b_max": 0.0}
        # }
        if ctype == "session_stage" and atype == "set_difficulty_range":
            ctx["difficulty_range"] = {
                "b_min": act.get("b_min"),
                "b_max": act.get("b_max"),
                "lte_position": cond.get("lte_position", 5),
            }

        # == Rule 4: cooldown phơi nhiễm (theo student + subject) ==
        # {
        #   "condition_json": {"type": "exposure_cooldown", "days": 7},
        #   "action_json":    {"type": "block_items"}
        # }
        if ctype == "exposure_cooldown" and atype == "block_items":
            days = int(cond.get("days", 7))
            since = timezone.now() - timedelta(days=days)
            recent_qids = (
                TestResponse.objects
                .filter(
                    answered_at__gte=since,
                    session__subject_id=subject_id,
                    session__student_id=student_id,
                )
                .values_list("question_id", flat=True)
            )
            ctx["block_question_ids"].update(recent_qids)

        # == Rule 5: block theo một topic cụ thể ==
        # {
        #   "condition_json": {"type": "block_topic", "topic_id": 1},
        #   "action_json":    {"type": "block_items"}
        # }
        if ctype == "block_topic" and atype == "block_items":
            topic_id = cond.get("topic_id")
            if topic_id is None:
                continue
            qids = (
                QuestionTag.objects
                .filter(topic_id=topic_id)
                .values_list("question_id", flat=True)
            )
            ctx["block_question_ids"].update(qids)

    ctx["block_question_ids"] = list(ctx["block_question_ids"])
    return ctx


def _build_question_topics_map(question_ids: Iterable[int]) -> Dict[int, Set[int]]:
    """Trả về mapping {question_id: {topic_id,...}}."""
    from assessment.models import QuestionTag
    mapping: Dict[int, Set[int]] = defaultdict(set)
    rel = (
        QuestionTag.objects
        .filter(question_id__in=question_ids)
        .values_list("question_id", "topic_id")
    )
    for qid, tid in rel:
        mapping[qid].add(tid)
    return mapping


def _theta_for_question(
    qid: int,
    q_topics: Dict[int, Set[int]],
    ability_vector: Dict[int, float],
    avg_theta: float,
) -> float:
    """
    Lấy theta cho câu hỏi = trung bình theta trên các topic của câu.
    Nếu không có topic hoặc không có theta nào -> fallback avg_theta.
    """
    tids = q_topics.get(qid, None)
    if not tids:
        return avg_theta
    vals = [ability_vector[tid] for tid in tids if tid in ability_vector]
    return sum(vals) / len(vals) if vals else avg_theta


def select_next_item(
    ability_vector: Dict[int, float],
    avg_theta: float,
    subject_id: int,
    used_q_ids: Set[int],
    rule_ctx: dict,
    *,
    position_in_session: Optional[int] = None,
    topic_ids: Optional[Iterable[int]] = None,   # 👈 THÊM THAM SỐ NÀY
):
    """
    Chọn câu tối đa Fisher info + áp ràng buộc:
      - block_question_ids
      - difficulty_range (b_min, b_max, lte_position)
      - topic_boost
      - topic_ids: nếu không None -> chỉ chọn câu thuộc các topic này

    Nếu tie gần nhau, ngẫu nhiên nhẹ để đa dạng.
    Nếu không tìm được câu IRT hợp lệ, fallback chọn random.

    Mục tiêu:
    - Tối đa hóa thông tin IRT (ước lượng năng lực chính xác hơn).
    - Tập trung vào topic yếu (mastery thấp / theta thấp).
    - Giữ độ khó phù hợp giai đoạn làm bài.
    - Tránh lặp câu quá nhiều / kẹt không có câu.
    """
    from assessment.models import Question
    from assessment.services.irt import fisher_info

    ability_vector = ability_vector or {}
    block_ids = set(rule_ctx.get("block_question_ids", []))
    topic_boost = rule_ctx.get("topic_boost", {})
    dr = rule_ctx.get("difficulty_range")  # {"b_min","b_max","lte_position"}

    # Chuẩn hoá topic_ids -> set[int] (nếu có)
    topic_ids_set = set(int(tid) for tid in topic_ids) if topic_ids is not None else None

    # -------- 1) Quyết định có áp range b hay không --------
    apply_b_range = False
    b_min = b_max = None
    if dr:
        lte_pos = dr.get("lte_position")
        if lte_pos is None:
            apply_b_range = True
        elif position_in_session is None:
            apply_b_range = True
        else:
            apply_b_range = (position_in_session <= int(lte_pos))
        b_min = dr.get("b_min")
        b_max = dr.get("b_max")

    # -------- 2) Lấy candidate từ DB (thô) --------
    qs = (
        Question.objects
        .filter(subject_id=subject_id)
        .exclude(id__in=used_q_ids)
        .exclude(id__in=block_ids)
        .select_related("irt")
    )

    # Lọc theo độ khó (IRT b) nếu cần
    if apply_b_range:
        diff_filter = Q()
        if b_min is not None:
            diff_filter &= Q(irt__b__gte=b_min)
        if b_max is not None:
            diff_filter &= Q(irt__b__lte=b_max)
        if diff_filter:
            qs = qs.filter(diff_filter)

    qids = list(qs.values_list("id", flat=True))
    if not qids:
        # Không còn câu nào sau khi filter -> fallback random (áp topic_ids nếu có)
        fallback_qs = (
            Question.objects
            .filter(subject_id=subject_id)
            .exclude(id__in=used_q_ids)
            .exclude(id__in=block_ids)
        )
        if topic_ids_set is not None:
            fallback_qs = fallback_qs.filter(questiontag__topic_id__in=topic_ids_set).distinct()
        return fallback_qs.order_by("?").first()

    # Chuẩn bị topic map để không N+1
    q_topics = _build_question_topics_map(qids)

    # -------- 3) Chấm điểm Fisher info * topic_boost (kèm lọc topic_ids nếu có) --------
    best: list = []
    best_score = -1.0

    for q in qs:
        # Nếu có filter theo topic_ids thì bỏ những câu không thuộc các topic đó
        if topic_ids_set is not None:
            tids_of_q = q_topics.get(q.id, set())
            if not (tids_of_q & topic_ids_set):
                continue

        irt = getattr(q, "irt", None)
        a = getattr(irt, "a", None)
        b = getattr(irt, "b", None)
        c = getattr(irt, "c", None)

        # Chỉ xét những câu có đủ tham số IRT
        if a is None or b is None or c is None:
            continue

        # Lấy theta "phù hợp" với câu dựa trên topic của câu
        theta_q = _theta_for_question(q.id, q_topics, ability_vector, avg_theta)

        # Thông tin Fisher (IRT)
        info = fisher_info(theta_q, a, b, c)
        if info <= 0.0:
            continue

        # Boost theo topic (nhân tất cả boost của các topic câu)
        boost = 1.0
        for tid in q_topics.get(q.id, []):
            boost *= topic_boost.get(tid, 1.0)

        score = info * boost

        if score > best_score + 1e-9:
            best_score = score
            best = [q]
        elif abs(score - best_score) <= 1e-9:  # tie
            best.append(q)

    # -------- 4) Fallback khi không có câu IRT hợp lệ --------
    if not best:
        fallback_qs = (
            Question.objects
            .filter(subject_id=subject_id)
            .exclude(id__in=used_q_ids)
            .exclude(id__in=block_ids)
        )
        if apply_b_range:
            diff_filter = Q()
            if b_min is not None:
                diff_filter &= Q(irt__b__gte=b_min)
            if b_max is not None:
                diff_filter &= Q(irt__b__lte=b_max)
            if diff_filter:
                fallback_qs = fallback_qs.filter(diff_filter)

        if topic_ids_set is not None:
            fallback_qs = fallback_qs.filter(questiontag__topic_id__in=topic_ids_set).distinct()

        return fallback_qs.order_by("?").first()

    # -------- 5) Ngẫu nhiên nhẹ giữa các câu có score tốt nhất --------
    return random.choice(best)
