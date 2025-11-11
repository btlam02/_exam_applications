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
    """
    from assessment.models import Rule, TestResponse, QuestionTag

    ctx = {
        "topic_boost": {},        # {topic_id: weight}
        "difficulty_range": None, # {"b_min","b_max","lte_position"}
        "block_question_ids": set(),
    }

    # --- Mastery theo topic: tỷ lệ đúng 20 câu gần nhất của student ---
    latest = (
        TestResponse.objects
        .filter(session__student_id=student_id, session__subject_id=subject_id)
        .select_related("question")
        .order_by("-answered_at")[:200]
    )

    # Map question_id -> correctness
    q_correct = {r.question_id: (1 if r.is_correct else 0) for r in latest}

    # Map topic_id -> list of y
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
        arr = arr[:20]
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
            if topic_id is None:
                continue
            threshold = float(cond.get("threshold", 0.5))
            weight = float(act.get("weight", 1.2))
            mastered = topic_mastery.get(topic_id, None)
            # Nếu chưa có dữ liệu, có thể xem là dưới ngưỡng để ưu tiên luyện
            if mastered is None or mastered < threshold:
                prev = ctx["topic_boost"].get(topic_id, 1.0)
                ctx["topic_boost"][topic_id] = max(weight, prev)

        # 2) giới hạn độ khó b trong giai đoạn đầu phiên
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
            recent_qids = (
                TestResponse.objects
                .filter(answered_at__gte=since, session__subject_id=subject_id)
                .values_list("question_id", flat=True)
            )
            ctx["block_question_ids"].update(recent_qids)

        # 4) block theo một topic cụ thể
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
    """Lấy theta cho câu hỏi bằng trung bình theta trên các topic của câu; fallback avg_theta."""
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
):
    """
    Chọn câu tối đa Fisher info + áp ràng buộc:
      - block_question_ids
      - difficulty_range (b_min, b_max, lte_position)
      - topic_boost
    Nếu tie gần nhau, ngẫu nhiên nhẹ để đa dạng.
    """
    from assessment.models import Question
    from assessment.services.irt import fisher_info

    # Lấy các câu hỏi ứng viên
    qs = (
        Question.objects
        .filter(subject_id=subject_id)
        .exclude(id__in=used_q_ids)
        .select_related("irt")
    )

    # Ràng buộc từ rule context
    block_ids = set(rule_ctx.get("block_question_ids", []))
    topic_boost = rule_ctx.get("topic_boost", {})
    dr = rule_ctx.get("difficulty_range")  # {"b_min","b_max","lte_position"}

    # Quyết định áp range b hay không
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

    # Chuẩn bị topic map để không N+1
    qids = list(qs.values_list("id", flat=True))
    q_topics = _build_question_topics_map(qids)

    best: list = []
    best_score = -1.0

    for q in qs:
        if q.id in block_ids:
            continue

        irt = getattr(q, "irt", None)
        a = getattr(irt, "a", None)
        b = getattr(irt, "b", None)
        c = getattr(irt, "c", None)

        # Range độ khó theo b (nếu có)
        if apply_b_range and (b is not None):
            if (b_min is not None and b < b_min) or (b_max is not None and b > b_max):
                continue

        # Lấy theta "phù hợp" với câu dựa trên topic của câu
        theta_q = _theta_for_question(q.id, q_topics, ability_vector, avg_theta)

        # Thông tin Fisher
        info = fisher_info(theta_q, a, b, c) if (a is not None and b is not None and c is not None) else 0.0
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

    if not best:
        return None

    return random.choice(best)
