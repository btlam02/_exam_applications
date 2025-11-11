# assessment/views.py
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Avg, Q

from assessment.models import (
    Subject, Question, QuestionOption, QuestionIRT,
    TestSession, TestItem, TestResponse,
    StudentAbilityProfile, Topic, QuestionTag
)

from .serializers import (
    SubjectSerializer, QuestionWriteSerializer, QuestionDetailSerializer,
    QuestionIRTSerializer, StartCatSerializer, AnswerCatSerializer,
    GenerateFixedTestSerializer
)

from assessment.services.irt import update_theta_newton
from assessment.services.rules import evaluate_rules, select_next_item


# === CRUD ===
class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all().select_related("subject").prefetch_related("options")

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return QuestionWriteSerializer
        return QuestionDetailSerializer

    @action(detail=True, methods=["put"])
    def irt(self, request, pk=None):
        q = self.get_object()
        ser = QuestionIRTSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        irt, _ = QuestionIRT.objects.update_or_create(question=q, defaults=ser.validated_data)
        return Response(QuestionIRTSerializer(irt).data)


# === CAT ===
class CATViewSet(viewsets.ViewSet):

    def _get_student_abilities(self, student_id, subject_id):
        profiles = StudentAbilityProfile.objects.filter(
            student_id=student_id,
            topic__subject_id=subject_id
        )
        ability_vector = {p.topic_id: p.theta for p in profiles}
        avg_theta = profiles.aggregate(Avg('theta'))['theta__avg'] or 0.0
        return ability_vector, avg_theta

    @action(detail=False, methods=["post"], url_path='start')
    @transaction.atomic
    def start_session(self, request):
        ser = StartCatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        session = TestSession.objects.create(
            student_id=data["student_id"], subject_id=data["subject_id"],
            target_items=data["target_items"], mode="CAT", status="ONGOING"
        )

        ability_vector, avg_theta = self._get_student_abilities(
            data["student_id"], data["subject_id"]
        )

        # ✅ truyền đúng subject_id
        rule_ctx = evaluate_rules(
            student_id=data["student_id"],
            subject_id=data["subject_id"],
        )

        next_q = select_next_item(
            ability_vector=ability_vector,
            avg_theta=avg_theta,
            subject_id=session.subject_id,
            used_q_ids=set(),
            rule_ctx=rule_ctx,
            position_in_session=1,
        )

        if next_q is None:
            return Response(
                {"error": "Không tìm thấy câu hỏi nào cho môn học này."},
                status=status.HTTP_404_NOT_FOUND
            )

        TestItem.objects.create(session=session, question=next_q, position=1)
        q_serializer = QuestionDetailSerializer(next_q)

        return Response({
            "session_id": str(session.id),
            "ability_vector": ability_vector,
            "next_question": q_serializer.data,
            "stop": False,
            "current_position": 1,
            "target_items": session.target_items
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path='answer')
    @transaction.atomic
    def post_answer(self, request):
        ser = AnswerCatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        session = get_object_or_404(
            TestSession.objects.select_for_update(),
            id=d["session_id"], status="ONGOING"
        )
        q = get_object_or_404(Question.objects.select_related('irt'), id=d["question_id"])
        opt = get_object_or_404(QuestionOption, id=d["option_id"], question=q)

        is_correct = bool(opt.is_correct)
        TestResponse.objects.create(
            session=session, question=q, option=opt,
            is_correct=is_correct, latency_ms=d.get("latency_ms")
        )

        # Các topic của câu hỏi (an toàn theo id)
        question_topics = Topic.objects.filter(questiontag__question_id=q.id)

        total_se = 0.0
        for topic in question_topics:
            profile, _ = StudentAbilityProfile.objects.get_or_create(
                student=session.student,
                topic=topic,
                defaults={'theta': 0.0, 'se': 1.0}
            )
            theta_prior = profile.theta
            try:
                irt = q.irt  # có thể không tồn tại
                resp_simple = [{"a": irt.a, "b": irt.b, "c": irt.c, "y": 1 if is_correct else 0}]
                new_theta, new_se = update_theta_newton(theta_prior, resp_simple)
            except QuestionIRT.DoesNotExist:
                new_theta, new_se = theta_prior, profile.se

            profile.theta = new_theta
            profile.se = new_se
            profile.save(update_fields=["theta", "se", "updated_at"])
            total_se += new_se

        full_ability_vector, avg_theta = self._get_student_abilities(
            session.student_id, session.subject_id
        )

        item_count = session.items.count()
        avg_se = total_se / (question_topics.count() or 1)
        stop = (avg_se < 0.3) or (item_count >= session.target_items)

        next_q_data = None
        if not stop:
            # ✅ truyền đúng subject_id (KHÔNG truyền dict thay subject_id)
            rule_ctx = evaluate_rules(
                student_id=session.student_id,
                subject_id=session.subject_id,
            )
            used_ids = set(session.items.values_list("question_id", flat=True))

            next_q = select_next_item(
                ability_vector=full_ability_vector,
                avg_theta=avg_theta,
                subject_id=session.subject_id,
                used_q_ids=used_ids,
                rule_ctx=rule_ctx,
                position_in_session=item_count + 1,  # câu sắp hỏi
            )

            if next_q:
                TestItem.objects.create(session=session, question=next_q, position=item_count + 1)
                next_q_data = QuestionDetailSerializer(next_q).data
            else:
                stop = True

        if stop:
            session.status = "FINISHED"
            session.finished_at = timezone.now()
            session.save(update_fields=["status", "finished_at"])

        return Response({
            "is_correct": is_correct,
            "ability_vector": full_ability_vector,
            "next_question": next_q_data,
            "stop": stop,
            "current_position": item_count,
            "target_items": session.target_items,   # thêm cho UI
        })


# === Fixed test (demo) ===
class FixedTestViewSet(viewsets.ViewSet):

    @action(detail=False, methods=["post"], url_path='generate')
    def generate_fixed_test(self, request):
        ser = GenerateFixedTestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        query = Q(subject_id=d['subject_id'])
        if 'difficulty_tag' in d:
            query &= Q(difficulty_tag=d['difficulty_tag'])

        questions = Question.objects.filter(query).order_by('?')[:d['num_questions']]
        q_serializer = QuestionDetailSerializer(questions, many=True)
        return Response({"questions": q_serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path='submit')
    def submit_fixed_test(self, request):
        answers = request.data.get("answers", [])
        if not isinstance(answers, list) or not answers:
            return Response({"detail": "answers trống/không hợp lệ"}, status=400)

        q_ids = [a.get("question_id") for a in answers if a.get("question_id")]
        opt_by_q = {a["question_id"]: a.get("option_id") for a in answers if a.get("question_id")}
        qs = Question.objects.filter(id__in=q_ids).prefetch_related("options")

        correct = 0
        total = len(q_ids)
        detail = []

        for q in qs:
            selected_id = opt_by_q.get(q.id)
            correct_opt = next((o for o in q.options.all() if o.is_correct), None)
            is_correct = bool(correct_opt and selected_id == correct_opt.id)
            if is_correct:
                correct += 1
            detail.append({
                "question_id": q.id,
                "selected_option_id": selected_id,
                "correct_option_id": correct_opt.id if correct_opt else None,
                "is_correct": is_correct
            })

        score = round(10.0 * correct / total, 2) if total else 0.0
        return Response({
            "total": total,
            "correct": correct,
            "score_10": score,
            "detail": detail
        })
