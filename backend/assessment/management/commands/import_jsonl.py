
import json
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

# --------------
# Helper utils
# --------------
def as_list(x):
    if x is None:
        return []
    if isinstance(x, (list, tuple, set)):
        return list(x)
    return [x]

def pick_first(d: Dict[str, Any], keys: Iterable[str], default=None):
    for k in keys:
        if isinstance(d, dict) and k in d and d[k] not in (None, "", []):
            return d[k]
    return default

def clean_text(x: Any) -> Optional[str]:
    if x is None:
        return None
    s = str(x).strip()
    return s if s else None

def option_text_from_obj(opt: Any) -> str:
    """Normalize option object to string content."""
    if isinstance(opt, dict):
        for k in ["text", "content", "option", "value", "label", "answer"]:
            if k in opt and opt[k] not in (None, ""):
                return str(opt[k])
        if opt:
            return str(next(iter(opt.values())))
        return ""
    return str(opt)

def guess_correct_index(rec: Dict[str, Any], options: List[str]) -> Optional[List[int]]:
    """Return list of indices that are correct (can be multi), if detectable."""
    n = len(options)

    # Per-option boolean flags
    if "options" in rec and isinstance(rec["options"], list):
        idxs = []
        for i, o in enumerate(rec["options"]):
            if isinstance(o, dict):
                for k in ["is_correct", "correct", "answer", "truth"]:
                    if k in o and isinstance(o[k], (bool, int)):
                        if bool(o[k]):
                            idxs.append(i)
        if idxs:
            return sorted(set(idxs))

    # Global answer fields
    ans = pick_first(rec, ["answer", "answers", "correct", "correct_answer", "label"], None)
    if ans is None:
        ans = pick_first(rec, ["solution", "target"], None)

    ans_list = as_list(ans)
    if not ans_list:
        return None

    def letter_to_idx(a: str):
        a = a.strip()
        m = re.fullmatch(r"([A-Z])", a, flags=re.I)
        if m:
            ch = m.group(1).upper()
            return ord(ch) - ord("A")
        m = re.search(r"([A-D])\b", a, flags=re.I)
        if m:
            ch = m.group(1).upper()
            return ord(ch) - ord("A")
        return None

    idxs: List[int] = []
    for a in ans_list:
        if isinstance(a, int) and 0 <= a < n:
            idxs.append(a); continue
        if isinstance(a, int) and 1 <= a <= n:
            idxs.append(a - 1); continue
        li = letter_to_idx(str(a))
        if li is not None and 0 <= li < n:
            idxs.append(li); continue
        if isinstance(a, str):
            a_clean = a.strip().lower()
            for i, opt in enumerate(options):
                if a_clean == str(opt).strip().lower():
                    idxs.append(i)
                    break
    idxs = sorted(set([i for i in idxs if 0 <= i < n]))
    return idxs or None

# --------------
# Command
# --------------
class Command(BaseCommand):
    help = "Import questions (and related objects) from a JSONL file into the DB."

    def add_arguments(self, parser):
        parser.add_argument("--path", required=True, help="Path to .jsonl file")
        parser.add_argument("--app-label", default="assessment", help="App label containing models (default: assessment)")
        parser.add_argument("--default-subject", default="General", help="Default subject name if missing")
        parser.add_argument("--skip-duplicates", action="store_true", help="Skip creating a Question if a question with same subject & stem exists")
        parser.add_argument("--max-records", type=int, default=None, help="Optional limit of records to import")
        parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to DB")

    def handle(self, *args, **opts):
        path = opts["path"]
        app_label = opts["app_label"]
        default_subject = opts["default_subject"]
        skip_duplicates = opts["skip_duplicates"]
        max_records = opts["max_records"]
        dry = opts["dry_run"]

        # Resolve models
        def get_model(name):
            try:
                return apps.get_model(app_label, name)
            except LookupError:
                raise CommandError(f"Model {app_label}.{name} not found. Check your app label or model names.")

        Subject = get_model("Subject")
        Topic = get_model("Topic")
        Question = get_model("Question")
        QuestionOption = get_model("QuestionOption")
        # Optional/if-present models
        QuestionTag = None
        for name in ["QuestionTag", "QuestionTopic"]:
            try:
                QuestionTag = get_model(name)
                break
            except CommandError:
                continue
        LearningOutcome = None
        for name in ["LearningOutcome", "LO"]:
            try:
                LearningOutcome = get_model(name); break
            except CommandError:
                pass
        QuestionIRT = None
        for name in ["QuestionIRT", "ItemIRT"]:
            try:
                QuestionIRT = get_model(name); break
            except CommandError:
                pass
        QuestionStats = None
        for name in ["QuestionStats", "ItemStats"]:
            try:
                QuestionStats = get_model(name); break
            except CommandError:
                pass

        # Simple caches
        subj_cache: Dict[str, Any] = {}
        topic_cache: Dict[Tuple[int, str], Any] = {}

        LABELS = [chr(ord('A') + i) for i in range(26)]

        def get_subject(name: Optional[str]):
            nm = clean_text(name) or default_subject
            if nm in subj_cache:
                return subj_cache[nm]
            obj, created = Subject.objects.get_or_create(name=nm)
            if created:
                # Count is tallied at the end to avoid threading issues; for clarity, we don't use it here.
                pass
            subj_cache[nm] = obj
            return obj

        def get_topic(subject_id: int, name: str):
            key = (subject_id, name)
            if key in topic_cache:
                return topic_cache[key]
            obj, _ = Topic.objects.get_or_create(subject_id=subject_id, name=name)
            topic_cache[key] = obj
            return obj

        created_counts = {
            "subjects": 0, "topics": 0, "questions": 0, "options": 0, "tags": 0, "los": 0, "irt": 0, "stats": 0,
            "skipped_duplicates": 0,
        }
        seen_questions = set()

        # Open and iterate JSONL
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        if max_records is not None:
            lines = lines[:max_records]

        @transaction.atomic
        def import_batch(batch_records):
            for rec in batch_records:
                # SUBJECT
                subj_name = pick_first(rec, ["subject", "category", "domain", "course", "grade", "chapter"], None)
                subject = get_subject(subj_name)

                # TOPICS
                topic_fields = as_list(pick_first(rec, ["topic", "topics", "tags", "tag"], None)) or ["General"]
                topics = []
                for t in topic_fields:
                    t_clean = clean_text(t) or "General"
                    topics.append(get_topic(subject.id, t_clean))

                # QUESTION stem
                stem = clean_text(pick_first(rec, ["question", "prompt", "stem", "text", "instruction"], None))
                if not stem:
                    continue

                # Optional dedupe by (subject, stem)
                if skip_duplicates:
                    key = (subject.id, stem)
                    if key in seen_questions:
                        created_counts["skipped_duplicates"] += 1
                        continue
                    if Question.objects.filter(subject_id=subject.id, stem=stem).exists():
                        created_counts["skipped_duplicates"] += 1
                        continue
                    seen_questions.add(key)

                # Meta
                difficulty_tag = pick_first(rec, ["difficulty", "level", "difficulty_tag", "difficulty_label"], None)

                time_avg = pick_first(rec, ["avg_time_sec", "time_avg_sec", "time_sec", "time_limit_sec", "time", "estimated_read_time_s"], None)
                if isinstance(time_avg, str):
                    m = re.search(r"(\d+)", time_avg)
                    time_avg = float(m.group(1)) if m else None
                elif isinstance(time_avg, (int, float)):
                    time_avg = float(time_avg)
                else:
                    time_avg = None

                raw_options = pick_first(rec, ["options", "choices", "answers_list", "alternatives"], None)
                item_type = "MCQ" if raw_options else "FREE"

                # Create Question
                q = Question.objects.create(
                    subject_id=subject.id,
                    stem=stem,
                    item_type=item_type,
                    difficulty_tag=difficulty_tag,
                    time_avg_sec=time_avg,
                )
                created_counts["questions"] += 1

                # OPTIONS
                if raw_options:
                    option_texts = [option_text_from_obj(o) for o in as_list(raw_options)]
                    correct_idxs = guess_correct_index(rec, option_texts) or []
                    for i, txt in enumerate(option_texts):
                        QuestionOption.objects.create(
                            question_id=q.id,
                            label=(chr(ord("A")+i) if i < 26 else f"Option{i+1}"),
                            content=txt,
                            is_correct=(i in correct_idxs),
                        )
                        created_counts["options"] += 1

                # TAGS (Question <-> Topic / LO)
                if QuestionTag is not None:
                    for t in topics:
                        QuestionTag.objects.create(
                            question_id=q.id,
                            topic_id=t.id,
                            lo_id=None,
                        )
                        created_counts["tags"] += 1

                # Learning Outcomes (optional)
                lo_objs = as_list(pick_first(rec, ["learning_outcomes", "learningOutcome", "learning_outcome", "LOs", "LO", "lo", "outcomes"], None))
                if lo_objs and apps.is_installed(app_label):
                    if apps.is_installed(app_label) and 'LearningOutcome' in [m.__name__ for m in apps.get_app_config(app_label).get_models()]:
                        # Resolve model again here to avoid missing import in some projects
                        LearningOutcomeModel = apps.get_model(app_label, "LearningOutcome")
                        first_topic = topics[0] if topics else None
                        for lo in lo_objs:
                            if isinstance(lo, dict):
                                lo_code = clean_text(pick_first(lo, ["code", "id", "lo_code"], None))
                                lo_desc = clean_text(pick_first(lo, ["description", "desc", "text", "name"], None))
                            else:
                                lo_code = None
                                lo_desc = clean_text(lo)
                            if first_topic is not None:
                                lo_obj, created = LearningOutcomeModel.objects.get_or_create(
                                    topic_id=first_topic.id,
                                    code=lo_code,
                                    defaults={"description": lo_desc},
                                )
                                if created:
                                    created_counts["los"] += 1
                                if QuestionTag is not None:
                                    tag = QuestionTag.objects.filter(question_id=q.id, topic_id=first_topic.id).first()
                                    if tag and tag.lo_id is None:
                                        tag.lo_id = lo_obj.id
                                        tag.save(update_fields=["lo_id"])
                # IRT
                # nếu không có "irt"/"IRT"/"irt_params" thì dùng luôn rec
                irt = pick_first(rec, ["irt", "IRT", "irt_params"], rec)

                if isinstance(irt, dict):
                    for model_name in ["QuestionIRT", "ItemIRT"]:
                        try:
                            IRTModel = apps.get_model(app_label, model_name)

                            # lúc này irt là:
                            # - dict con: rec["irt"] nếu có
                            # - hoặc chính rec (chứa irt_a, irt_b, irt_c) nếu không có field "irt"
                            a = pick_first(irt, ["a", "irt_a", "alpha", "discrimination"], None)
                            b = pick_first(irt, ["b", "irt_b", "beta", "difficulty"], None)
                            c = pick_first(irt, ["c", "irt_c", "gamma", "guessing"], None)

                            if any(v is not None for v in [a, b, c]):
                                IRTModel.objects.create(question_id=q.id, a=a, b=b, c=c)
                                created_counts["irt"] += 1
                                break
                        except LookupError:
                            continue


                # Stats
                stats = pick_first(rec, ["stats", "statistics", "metrics"], {})
                if isinstance(stats, dict):
                    for model_name in ["QuestionStats", "ItemStats"]:
                        try:
                            StatsModel = apps.get_model(app_label, model_name)
                            p_value = pick_first(stats, ["p_value", "p", "correct_rate", "accuracy"], None)
                            exposure = pick_first(stats, ["exposure_rate", "exposure"], None)
                            stats_time = pick_first(stats, ["time_avg_sec", "avg_time_sec"], None)
                            if stats_time is None:
                                stats_time = time_avg
                            if any(v is not None for v in [p_value, stats_time, exposure]):
                                StatsModel.objects.create(
                                    question_id=q.id,
                                    p_value=p_value,
                                    time_avg_sec=stats_time,
                                    exposure_rate=exposure,
                                )
                                created_counts["stats"] += 1
                                break
                        except LookupError:
                            continue

        # Parse lines in memory
        batch = []
        for raw in lines:
            raw = raw.strip()
            if not raw:
                continue
            try:
                rec = json.loads(raw)
            except Exception:
                try:
                    relaxed = raw.replace("'", '"')
                    rec = json.loads(relaxed)
                except Exception:
                    continue
            batch.append(rec)

        if dry:
            self.stdout.write(self.style.WARNING(f"[DRY-RUN] Parsed {len(batch)} records from {path}. No DB changes."))
            return

        import_batch(batch)
        # Report
        self.stdout.write(self.style.SUCCESS("Import completed."))
        for k, v in created_counts.items():
            self.stdout.write(f"  {k}: {v}")
