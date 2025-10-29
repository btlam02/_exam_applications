from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from assessment.models import Subject, Question, QuestionOption, QuestionIRT, TestSession, TestItem, TestResponse, StudentAbility
from .serializers import *
from assessment.services.irt import update_theta_newton
from assessment.services.rules import evaluate_rules, select_next_item
from assessment.services.irt import p_3pl
from django.db import transaction

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer

class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all().select_related("subject")
    serializer_class = QuestionSerializer

    @action(detail=True, methods=["put"])
    def irt(self, request, pk=None):
        q = self.get_object()
        ser = QuestionIRTSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        irt, _ = QuestionIRT.objects.update_or_create(question=q, defaults=ser.validated_data)
        return Response(QuestionIRTSerializer(irt).data)

class CATViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["post"])
    def start(self, request):
        ser = StartCatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        session = TestSession.objects.create(
            student_id=data["student_id"], subject_id=data["subject_id"],
            target_items=data["target_items"], mode="CAT"
        )
        # lấy theta hiện tại (hoặc default)
        ability, _ = StudentAbility.objects.get_or_create(student_id=data["student_id"])

        rule_ctx = evaluate_rules(data["student_id"], data["subject_id"])
        # chọn câu đầu (không đếm used)
        from assessment.services.irt import fisher_info
        from assessment.services.rules import evaluate_rules
        next_q = select_next_question(session, ability.theta, rule_ctx)
        TestItem.objects.create(session=session, question=next_q, position=1)

        return Response({"session_id": str(session.id), "theta": ability.theta, "se": ability.se,
                         "next_question_id": next_q.id})

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def answer(self, request):
        ser = AnswerCatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        session = TestSession.objects.select_for_update().get(id=d["session_id"])
        q = Question.objects.get(id=d["question_id"])
        opt = QuestionOption.objects.get(id=d["option_id"], question=q)

        is_correct = bool(opt.is_correct)
        TestResponse.objects.create(
            session=session, question=q, option=opt,
            is_correct=is_correct, latency_ms=d.get("latency_ms")
        )

        # chuẩn bị responses cho update theta
        # lấy toàn bộ log của phiên
        logs = (TestResponse.objects
                .filter(session=session)
                .select_related("question__irt", "question"))
        resp = []
        for r in logs:
            irt = getattr(r.question, "irt", None)
            a = getattr(irt, "a", None); b = getattr(irt, "b", None); c = getattr(irt, "c", None)
            resp.append({"a": a, "b": b, "c": c, "y": 1 if r.is_correct else 0})

        ability, _ = StudentAbility.objects.get_or_create(student=session.student)
        theta, se = update_theta_newton(ability.theta, resp)
        ability.theta, ability.se = theta, se
        ability.save(update_fields=["theta", "se", "updated_at"])

        # dừng hay chưa
        used_ids = set(session.items.values_list("question_id", flat=True))
        stop = (se < 0.30) or (len(used_ids) >= session.target_items)

        next_q_id = None
        if not stop:
            rule_ctx = evaluate_rules(session.student_id, session.subject_id)
            next_q = select_next_question(session, theta, rule_ctx)
            TestItem.objects.create(session=session, question=next_q, position=len(used_ids) + 1)
            next_q_id = next_q.id
        else:
            session.status = "FINISHED"
            session.finished_at = timezone.now()
            session.save(update_fields=["status", "finished_at"])

        return Response({
            "is_correct": is_correct,
            "theta": theta, "se": se,
            "next_question_id": next_q_id,
            "stop": stop
        })

def select_next_question(session, theta, rule_ctx):
    used = set(session.items.values_list("question_id", flat=True))
    from assessment.services.irt import fisher_info
    from assessment.models import Question
    # tái dùng hàm đã phác thảo ở trên (rút gọn tại đây)
    from assessment.services.rules import evaluate_rules
    # copy logic từ phần select_next_item() ở trên (đã có)
    from assessment.services.irt import p_3pl  # nếu muốn tính thêm điều kiện
    return select_next_item(theta, session.subject_id, used, rule_ctx)
