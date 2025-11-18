# # assessment/views.py
# from django.utils import timezone
# from rest_framework import status, viewsets
# from rest_framework.decorators import action
# from rest_framework.response import Response
# from django.db import transaction
# from django.shortcuts import get_object_or_404
# from django.db.models import Avg, Q

# from assessment.models import (
#     Subject, Question, QuestionOption, QuestionIRT,
#     TestSession, TestItem, TestResponse,
#     StudentAbilityProfile, Topic, QuestionTag
# )

# from .serializers import (
#     SubjectSerializer, QuestionWriteSerializer, QuestionDetailSerializer,
#     QuestionIRTSerializer, StartCatSerializer, AnswerCatSerializer,
#     GenerateFixedTestSerializer, TopicSerializer,   # cần có TopicSerializer trong serializers.py
# )

# from assessment.services.irt import update_theta_newton
# from assessment.services.rules import evaluate_rules, select_next_item


# # === CRUD ===
# class SubjectViewSet(viewsets.ModelViewSet):
#     queryset = Subject.objects.all()
#     serializer_class = SubjectSerializer


# class TopicViewSet(viewsets.ReadOnlyModelViewSet):
#     """
#     /api/topics/
#     - GET /api/topics/                -> tất cả topic
#     - GET /api/topics/?subject_id=1   -> topic thuộc môn 1
#     """
#     queryset = Topic.objects.select_related("subject").all()
#     serializer_class = TopicSerializer

#     def get_queryset(self):
#         qs = super().get_queryset()
#         subject_id = self.request.query_params.get("subject_id")
#         if subject_id:
#             qs = qs.filter(subject_id=subject_id)
#         return qs


# class QuestionViewSet(viewsets.ModelViewSet):
#     queryset = Question.objects.all().select_related("subject").prefetch_related("options")

#     def get_serializer_class(self):
#         if self.action in ['create', 'update', 'partial_update']:
#             return QuestionWriteSerializer
#         return QuestionDetailSerializer

#     @action(detail=True, methods=["put"])
#     def irt(self, request, pk=None):
#         q = self.get_object()
#         ser = QuestionIRTSerializer(data=request.data)
#         ser.is_valid(raise_exception=True)
#         irt, _ = QuestionIRT.objects.update_or_create(question=q, defaults=ser.validated_data)
#         return Response(QuestionIRTSerializer(irt).data)


# # === CAT ===
# class CATViewSet(viewsets.ViewSet):

#     def _get_student_abilities(self, student_id, subject_id):
#         """
#         Lấy vector năng lực theo topic:
#           ability_vector = {topic_id: theta}
#           avg_theta      = trung bình, dùng fallback nếu câu không gắn topic.
#         """
#         profiles = StudentAbilityProfile.objects.filter(
#             student_id=student_id,
#             topic__subject_id=subject_id
#         )
#         ability_vector = {p.topic_id: p.theta for p in profiles}
#         avg_theta = profiles.aggregate(Avg('theta'))['theta__avg'] or 0.0
#         return ability_vector, avg_theta

#     @action(detail=False, methods=["post"], url_path='start')
#     @transaction.atomic
#     def start_session(self, request):
#         """
#         Bắt đầu 1 phiên CAT.
#         - Nếu client gửi kèm topic_id -> lock đề vào đúng topic đó.
#         - Nếu không -> để None, hệ thống tự chọn câu hỏi theo toàn bộ subject.
#         """
#         ser = StartCatSerializer(data=request.data)
#         ser.is_valid(raise_exception=True)
#         data = ser.validated_data

#         student_id = data["student_id"]
#         subject_id = data["subject_id"]
#         target_items = data["target_items"]
#         topic_id = data.get("topic_id")  # có thể None
        
#         topic_obj = None
#         # Nếu có topic_id thì kiểm tra topic thuộc đúng môn
#         if topic_id is not None:
#             topic_obj = get_object_or_404(Topic, id=topic_id, subject_id=subject_id)
#             # get_object_or_404(Topic, id=topic_id, subject_id=subject_id)

        
#         # Tạo session (nếu sau này bạn thêm field topic vào TestSession thì set luôn ở đây)
#         session = TestSession.objects.create(
#             student_id=student_id,
#             subject_id=subject_id,
#             topic=topic_obj,
#             target_items=target_items,
#             mode="CAT",
#             status="ONGOING",
#         )

#         # Lấy năng lực hiện tại (nếu có)
#         ability_vector, avg_theta = self._get_student_abilities(student_id, subject_id)

#         # Context rule chung (mastery, cooldown, v.v.)
#         rule_ctx = evaluate_rules(
#             student_id=student_id,
#             subject_id=subject_id,
#             ability_vector=ability_vector,
#         )

#         # Nếu có topic được chọn -> truyền vào select_next_item
#         # topic_ids_arg = [topic_id] if topic_id is not None else None
#         topic_ids = [topic_obj.id] if topic_obj is not None else None


#         next_q = select_next_item(
#             ability_vector=ability_vector,
#             avg_theta=avg_theta,
#             subject_id=session.subject_id,
#             used_q_ids=set(),
#             rule_ctx=rule_ctx,
#             position_in_session=1,
#             topic_ids=topic_ids,  # lock theo topic nếu có
#         )

#         if next_q is None:
#             return Response(
#                 {"error": "Không tìm thấy câu hỏi nào cho môn học này."},
#                 status=status.HTTP_404_NOT_FOUND
#             )

#         TestItem.objects.create(session=session, question=next_q, position=1)
#         q_serializer = QuestionDetailSerializer(next_q)

#         return Response({
#             "session_id": str(session.id),
#             "ability_vector": ability_vector,
#             "next_question": q_serializer.data,
#             "stop": False,
#             "current_position": 1,
#             "target_items": session.target_items,
#         }, status=status.HTTP_201_CREATED)

#     # @action(detail=False, methods=["post"], url_path='answer')
#     # @transaction.atomic
#     # def post_answer(self, request):
#         """
#         Nhận đáp án 1 câu,
#         - Cập nhật năng lực IRT theo các topic của câu hỏi
#         - Quyết định dừng/tiếp tục
#         - Nếu tiếp tục: chọn câu tiếp theo (giữ nguyên topic nếu phiên đó có topic).
#         """
#         ser = AnswerCatSerializer(data=request.data)
#         ser.is_valid(raise_exception=True)
#         d = ser.validated_data

#         session = get_object_or_404(
#             TestSession.objects.select_for_update(),
#             id=d["session_id"], status="ONGOING"
#         )
#         q = get_object_or_404(Question.objects.select_related('irt'), id=d["question_id"])
#         opt = get_object_or_404(QuestionOption, id=d["option_id"], question=q)

#         is_correct = bool(opt.is_correct)
#         TestResponse.objects.create(
#             session=session, question=q, option=opt,
#             is_correct=is_correct, latency_ms=d.get("latency_ms")
#         )

#         # Các topic của câu hỏi (an toàn theo id)
#         question_topics = Topic.objects.filter(questiontag__question_id=q.id).distinct()

#         total_se = 0.0
#         for topic in question_topics:
#             profile, _ = StudentAbilityProfile.objects.get_or_create(
#                 student=session.student,
#                 topic=topic,
#                 defaults={'theta': 0.0, 'se': 1.0}
#             )
#             theta_prior = profile.theta
#             try:
#                 irt = q.irt  # có thể không tồn tại
#                 resp_simple = [{"a": irt.a, "b": irt.b, "c": irt.c, "y": 1 if is_correct else 0}]
#                 new_theta, new_se = update_theta_newton(theta_prior, resp_simple)
#             except QuestionIRT.DoesNotExist:
#                 new_theta, new_se = theta_prior, profile.se

#             profile.theta = new_theta
#             profile.se = new_se
#             profile.save(update_fields=["theta", "se", "updated_at"])
#             total_se += new_se

#         # Lấy lại full ability vector sau khi update
#         full_ability_vector, avg_theta = self._get_student_abilities(
#             session.student_id, session.subject_id
#         )

#         item_count = session.items.count()
#         avg_se = total_se / (question_topics.count() or 1)
#         stop = (avg_se < 0.3) or (item_count >= session.target_items)

#         # 👉 lấy topic_id từ request (frontend giữ nguyên suốt phiên
#         #     khi gửi /cat/answer/)
#         topic_id = d.get("topic_id")
#         topic_ids_arg = [topic_id] if topic_id is not None else None

#         next_q_data = None
#         if not stop:
#             rule_ctx = evaluate_rules(
#                 student_id=session.student_id,
#                 subject_id=session.subject_id,
#                 ability_vector=full_ability_vector,
#             )
#             used_ids = set(session.items.values_list("question_id", flat=True))

#             next_q = select_next_item(
#                 ability_vector=full_ability_vector,
#                 avg_theta=avg_theta,
#                 subject_id=session.subject_id,
#                 used_q_ids=used_ids,
#                 rule_ctx=rule_ctx,
#                 position_in_session=item_count + 1,  # câu sắp hỏi
#                 topic_ids=topic_ids_arg,
#             )

#             if next_q:
#                 TestItem.objects.create(session=session, question=next_q, position=item_count + 1)
#                 next_q_data = QuestionDetailSerializer(next_q).data
#             else:
#                 stop = True

#         if stop:
#             session.status = "FINISHED"
#             session.finished_at = timezone.now()
#             session.save(update_fields=["status", "finished_at"])

#         return Response({
#             "is_correct": is_correct,
#             "ability_vector": full_ability_vector,
#             "next_question": next_q_data,
#             "stop": stop,
#             "current_position": item_count,
#             "target_items": session.target_items,
#         })

# @action(detail=False, methods=["post"], url_path='answer')
# @transaction.atomic
# def post_answer(self, request):
#     ser = AnswerCatSerializer(data=request.data)
#     ser.is_valid(raise_exception=True)
#     d = ser.validated_data

#     session = get_object_or_404(
#         TestSession.objects.select_for_update(),
#         id=d["session_id"], status="ONGOING"
#     )
#     q = get_object_or_404(Question.objects.select_related('irt'), id=d["question_id"])
#     opt = get_object_or_404(QuestionOption, id=d["option_id"], question=q)

#     is_correct = bool(opt.is_correct)
#     TestResponse.objects.create(
#         session=session, question=q, option=opt,
#         is_correct=is_correct, latency_ms=d.get("latency_ms")
#     )

#     # cập nhật ability như bạn đã làm (question_topics, total_se, ...)

#     full_ability_vector, avg_theta = self._get_student_abilities(
#         session.student_id, session.subject_id
#     )

#     item_count = session.items.count()
#     avg_se = total_se / (question_topics.count() or 1)
#     stop = (avg_se < 0.3) or (item_count >= session.target_items)

#     next_q_data = None
#     if not stop:
#         rule_ctx = evaluate_rules(
#             student_id=session.student_id,
#             subject_id=session.subject_id,
#             ability_vector=full_ability_vector,
#         )
#         used_ids = set(session.items.values_list("question_id", flat=True))

#         # 👇 LẤY topic TỪ PHIÊN
#         session_topic_id = getattr(session, "topic_id", None)
#         topic_ids = [session_topic_id] if session_topic_id is not None else None

#         next_q = select_next_item(
#             ability_vector=full_ability_vector,
#             avg_theta=avg_theta,
#             subject_id=session.subject_id,
#             used_q_ids=used_ids,
#             rule_ctx=rule_ctx,
#             position_in_session=item_count + 1,
#             topic_ids=topic_ids,
#         )

#         if next_q:
#             TestItem.objects.create(session=session, question=next_q, position=item_count + 1)
#             next_q_data = QuestionDetailSerializer(next_q).data
#         else:
#             stop = True

#     if stop:
#         session.status = "FINISHED"
#         session.finished_at = timezone.now()
#         session.save(update_fields=["status", "finished_at"])

#     return Response({
#         "is_correct": is_correct,
#         "ability_vector": full_ability_vector,
#         "next_question": next_q_data,
#         "stop": stop,
#         "current_position": item_count,
#         "target_items": session.target_items,
#     })


# # === Fixed test (demo) ===
# class FixedTestViewSet(viewsets.ViewSet):

#     @action(detail=False, methods=["post"], url_path='generate')
#     def generate_fixed_test(self, request):
#         ser = GenerateFixedTestSerializer(data=request.data)
#         ser.is_valid(raise_exception=True)
#         d = ser.validated_data

#         query = Q(subject_id=d['subject_id'])
#         if 'difficulty_tag' in d:
#             query &= Q(difficulty_tag=d['difficulty_tag'])

#         questions = Question.objects.filter(query).order_by('?')[:d['num_questions']]
#         q_serializer = QuestionDetailSerializer(questions, many=True)
#         return Response({"questions": q_serializer.data}, status=status.HTTP_200_OK)

#     @action(detail=False, methods=["post"], url_path='submit')
#     def submit_fixed_test(self, request):
#         answers = request.data.get("answers", [])
#         if not isinstance(answers, list) or not answers:
#             return Response({"detail": "answers trống/không hợp lệ"}, status=400)

#         q_ids = [a.get("question_id") for a in answers if a.get("question_id")]
#         opt_by_q = {a["question_id"]: a.get("option_id") for a in answers if a.get("question_id")}
#         qs = Question.objects.filter(id__in=q_ids).prefetch_related("options")

#         correct = 0
#         total = len(q_ids)
#         detail = []

#         for q in qs:
#             selected_id = opt_by_q.get(q.id)
#             correct_opt = next((o for o in q.options.all() if o.is_correct), None)
#             is_correct = bool(correct_opt and selected_id == correct_opt.id)
#             if is_correct:
#                 correct += 1
#             detail.append({
#                 "question_id": q.id,
#                 "selected_option_id": selected_id,
#                 "correct_option_id": correct_opt.id if correct_opt else None,
#                 "is_correct": is_correct
#             })

#         score = round(10.0 * correct / total, 2) if total else 0.0
#         return Response({
#             "total": total,
#             "correct": correct,
#             "score_10": score,
#             "detail": detail
#         })



# assessment/views.py
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Avg, Q

from .services.question_pipeline import generate_candidate_questions
from .serializers import GenerateQuestionRequestSerializer

from assessment.models import (
    Subject, Question, QuestionOption, QuestionIRT,
    TestSession, TestItem, TestResponse,
    StudentAbilityProfile, Topic, QuestionTag
)

from .serializers import (
    SubjectSerializer, QuestionWriteSerializer, QuestionDetailSerializer,
    QuestionIRTSerializer, StartCatSerializer, AnswerCatSerializer,
    GenerateFixedTestSerializer, TopicSerializer,
)

from assessment.services.irt import update_theta_newton
from assessment.services.rules import evaluate_rules, select_next_item


# === CRUD cơ bản ===
class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer


class TopicViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/topics/
    - GET /api/topics/                -> tất cả topic
    - GET /api/topics/?subject_id=1   -> topic thuộc môn 1
    """
    queryset = Topic.objects.select_related("subject").all()
    serializer_class = TopicSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        subject_id = self.request.query_params.get("subject_id")
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        return qs


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all().select_related("subject").prefetch_related("options")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return QuestionWriteSerializer
        return QuestionDetailSerializer


    @action(detail=False, methods=["post"], url_path="generate_ai")
    def generate_ai(self, request):
        """
        API sinh câu hỏi bằng Gemini.
        Payload: {
            "subject_name": "Mạng máy tính",
            "topic_name": "Mô hình OSI",
            "difficulty": "medium",
            "count": 5
        }
        """
        # 1. Validate input
        ser = GenerateQuestionRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            # 2. Gọi Service Gemini
            count = generate_questions_with_gemini(
                subject_name=data['subject_name'],
                topic_name=data['topic_name'],
                difficulty=data['difficulty'],
                count=data['count']
            )
            
            return Response({
                "message": f"Thành công! Đã sinh và lưu {count} câu hỏi mới.",
                "params": data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"error": "Lỗi sinh câu hỏi", "detail": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



    @action(detail=True, methods=["put"])
    def irt(self, request, pk=None):
        q = self.get_object()
        ser = QuestionIRTSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        irt, _ = QuestionIRT.objects.update_or_create(question=q, defaults=ser.validated_data)
        return Response(QuestionIRTSerializer(irt).data)


# === CAT ===
class CATViewSet(viewsets.ViewSet):
    """
    ViewSet cho bài kiểm tra thích ứng (CAT).
    """

    def _get_student_abilities(self, student_id, subject_id):
        """
        Lấy vector năng lực theo topic:
          ability_vector = {topic_id: theta}
          avg_theta      = trung bình, dùng fallback nếu câu không gắn topic.
        """
        profiles = StudentAbilityProfile.objects.filter(
            student_id=student_id,
            topic__subject_id=subject_id,
        )
        ability_vector = {p.topic_id: p.theta for p in profiles}
        avg_theta = profiles.aggregate(Avg("theta"))["theta__avg"] or 0.0
        return ability_vector, avg_theta

    @action(detail=False, methods=["post"], url_path="start")
    @transaction.atomic
    def start_session(self, request):
        """
        Bắt đầu 1 phiên CAT.
        - Nếu client gửi kèm topic_id -> lock câu hỏi trong đúng topic đó.
        - Nếu không -> để None, hệ thống chọn câu hỏi trong toàn bộ subject.
        """
        ser = StartCatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        student_id = data["student_id"]
        subject_id = data["subject_id"]
        target_items = data["target_items"]
        topic_id = data.get("topic_id")  # có thể None

        # Nếu có topic_id thì kiểm tra topic thuộc đúng môn
        topic_obj = None
        if topic_id is not None:
            topic_obj = get_object_or_404(Topic, id=topic_id, subject_id=subject_id)

        # Tạo session và lưu luôn topic (nếu có)
        session = TestSession.objects.create(
            student_id=student_id,
            subject_id=subject_id,
            topic=topic_obj,
            target_items=target_items,
            mode="CAT",
            status="ONGOING",
        )

        # Lấy năng lực hiện tại (nếu có)
        ability_vector, avg_theta = self._get_student_abilities(student_id, subject_id)

        # Context rule chung (mastery, cooldown, …)
        rule_ctx = evaluate_rules(
            student_id=student_id,
            subject_id=subject_id,
            ability_vector=ability_vector,
        )

        # Nếu có topic được chọn -> truyền vào select_next_item
        topic_ids = [topic_obj.id] if topic_obj is not None else None

        next_q = select_next_item(
            ability_vector=ability_vector,
            avg_theta=avg_theta,
            subject_id=session.subject_id,
            used_q_ids=set(),
            rule_ctx=rule_ctx,
            position_in_session=1,
            topic_ids=topic_ids,  # lock theo topic nếu có
        )

        if next_q is None:
            return Response(
                {"error": "Không tìm thấy câu hỏi nào cho môn học này."},
                status=status.HTTP_404_NOT_FOUND,
            )

        TestItem.objects.create(session=session, question=next_q, position=1)
        q_serializer = QuestionDetailSerializer(next_q)

        return Response(
            {
                "session_id": str(session.id),
                "ability_vector": ability_vector,
                "next_question": q_serializer.data,
                "stop": False,
                "current_position": 1,
                "target_items": session.target_items,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="answer")
    @transaction.atomic
    def post_answer(self, request):
        """
        Nhận đáp án:
        - Cập nhật năng lực IRT theo các topic của câu hỏi vừa làm
        - Quyết định dừng / tiếp tục
        - Nếu tiếp tục: chọn câu tiếp theo (giữ nguyên topic nếu phiên đó có topic).
        """
        ser = AnswerCatSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        session = get_object_or_404(
            TestSession.objects.select_for_update(),
            id=d["session_id"],
            status="ONGOING",
        )
        q = get_object_or_404(Question.objects.select_related("irt"), id=d["question_id"])
        opt = get_object_or_404(QuestionOption, id=d["option_id"], question=q)

        is_correct = bool(opt.is_correct)

        TestResponse.objects.create(
            session=session,
            question=q,
            option=opt,
            is_correct=is_correct,
            latency_ms=d.get("latency_ms"),
        )

        # Các topic của câu hỏi
        question_topics = Topic.objects.filter(
            questiontag__question_id=q.id
        ).distinct()

        # Cập nhật IRT cho từng topic
        total_se = 0.0
        for topic in question_topics:
            profile, _ = StudentAbilityProfile.objects.get_or_create(
                student=session.student,
                topic=topic,
                defaults={"theta": 0.0, "se": 1.0},
            )
            theta_prior = profile.theta
            try:
                irt = q.irt  # có thể không tồn tại
                resp_simple = [
                    {"a": irt.a, "b": irt.b, "c": irt.c, "y": 1 if is_correct else 0}
                ]
                new_theta, new_se = update_theta_newton(theta_prior, resp_simple)
            except QuestionIRT.DoesNotExist:
                new_theta, new_se = theta_prior, profile.se

            profile.theta = new_theta
            profile.se = new_se
            profile.save(update_fields=["theta", "se", "updated_at"])
            total_se += new_se

        # Lấy lại full ability vector sau khi update
        full_ability_vector, avg_theta = self._get_student_abilities(
            session.student_id,
            session.subject_id,
        )

        item_count = session.items.count()
        avg_se = total_se / (question_topics.count() or 1)
        stop = (avg_se < 0.3) or (item_count >= session.target_items)

        next_q_data = None
        if not stop:
            rule_ctx = evaluate_rules(
                student_id=session.student_id,
                subject_id=session.subject_id,
                ability_vector=full_ability_vector,
            )
            used_ids = set(session.items.values_list("question_id", flat=True))

            # Lấy topic cố định của phiên (nếu có)
            session_topic_id = getattr(session, "topic_id", None)
            topic_ids = [session_topic_id] if session_topic_id is not None else None

            next_q = select_next_item(
                ability_vector=full_ability_vector,
                avg_theta=avg_theta,
                subject_id=session.subject_id,
                used_q_ids=used_ids,
                rule_ctx=rule_ctx,
                position_in_session=item_count + 1,
                topic_ids=topic_ids,
            )

            if next_q:
                TestItem.objects.create(
                    session=session,
                    question=next_q,
                    position=item_count + 1,
                )
                next_q_data = QuestionDetailSerializer(next_q).data
            else:
                stop = True

        if stop:
            session.status = "FINISHED"
            session.finished_at = timezone.now()
            session.save(update_fields=["status", "finished_at"])

        return Response(
            {
                "is_correct": is_correct,
                "ability_vector": full_ability_vector,
                "next_question": next_q_data,
                "stop": stop,
                "current_position": item_count,
                "target_items": session.target_items,
            }
        )


# === Fixed test (demo) ===
class FixedTestViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["post"], url_path="generate")
    def generate_fixed_test(self, request):
        ser = GenerateFixedTestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        query = Q(subject_id=d["subject_id"])
        if "difficulty_tag" in d:
            query &= Q(difficulty_tag=d["difficulty_tag"])

        questions = Question.objects.filter(query).order_by("?")[: d["num_questions"]]
        q_serializer = QuestionDetailSerializer(questions, many=True)
        return Response({"questions": q_serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="submit")
    def submit_fixed_test(self, request):
        answers = request.data.get("answers", [])
        if not isinstance(answers, list) or not answers:
            return Response({"detail": "answers trống/không hợp lệ"}, status=400)

        q_ids = [a.get("question_id") for a in answers if a.get("question_id")]
        opt_by_q = {
            a["question_id"]: a.get("option_id")
            for a in answers
            if a.get("question_id")
        }
        qs = Question.objects.filter(id__in=q_ids).prefetch_related("options")

        correct = 0
        total = len(q_ids)
        detail = []

        for q in qs:
            selected_id = opt_by_q.get(q.id)
            correct_opt = next(
                (o for o in q.options.all() if o.is_correct),
                None,
            )
            is_correct = bool(correct_opt and selected_id == correct_opt.id)
            if is_correct:
                correct += 1
            detail.append(
                {
                    "question_id": q.id,
                    "selected_option_id": selected_id,
                    "correct_option_id": correct_opt.id if correct_opt else None,
                    "is_correct": is_correct,
                }
            )

        score = round(10.0 * correct / total, 2) if total else 0.0
        return Response(
            {
                "total": total,
                "correct": correct,
                "score_10": score,
                "detail": detail,
            }
        )
    


# assessment/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Subject, Topic, CandidateQuestion
from .serializers import CandidateQuestionSerializer
from .services.question_pipeline import generate_candidate_questions, promote_candidate_to_question


class GenerateQuestionLLMView(APIView):
    """
    POST /api/questions/generate-llm/
    {
      "subject_id": 1,
      "topic_id": 2,
      "target_difficulty": "Medium",
      "num_questions": 5
    }
    """

    def post(self, request, *args, **kwargs):
        subject_id = request.data.get("subject_id")
        topic_id = request.data.get("topic_id")
        target_difficulty = request.data.get("target_difficulty", "Medium")
        num_questions = int(request.data.get("num_questions", 5))

        subject = Subject.objects.filter(id=subject_id).first()
        topic = Topic.objects.filter(id=topic_id, subject_id=subject_id).first()
        if not subject or not topic:
            return Response(
                {"detail": "Không tìm thấy môn học hoặc chủ đề."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        candidates = generate_candidate_questions(
            subject=subject,
            topic=topic,
            target_difficulty=target_difficulty,
            num_questions=num_questions,
        )

        ser = CandidateQuestionSerializer(candidates, many=True)
        return Response(
            {"created": len(candidates), "items": ser.data},
            status=status.HTTP_201_CREATED,
        )


class CandidateQuestionListView(APIView):
    """
    GET /api/questions/candidates/?status=pending&subject_id=...
    """

    def get(self, request, *args, **kwargs):
        qs = CandidateQuestion.objects.all().order_by("-created_at")

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        subject_id = request.query_params.get("subject_id")
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        topic_id = request.query_params.get("topic_id")
        if topic_id:
            qs = qs.filter(topic_id=topic_id)

        ser = CandidateQuestionSerializer(qs, many=True)
        return Response(ser.data)


class CandidateQuestionApproveView(APIView):
    """
    POST /api/questions/candidates/<id>/approve/
    """

    def post(self, request, pk, *args, **kwargs):
        cand = CandidateQuestion.objects.filter(id=pk).first()
        if not cand:
            return Response({"detail": "Không tìm thấy candidate."}, status=404)
        if cand.status == "accepted":
            return Response({"detail": "Câu hỏi đã được chấp nhận trước đó."}, status=400)

        q = promote_candidate_to_question(cand)
        return Response({"detail": "Đã chuyển thành câu hỏi chính.", "question_id": q.id})


class CandidateQuestionRejectView(APIView):
    """
    POST /api/questions/candidates/<id>/reject/
    """

    def post(self, request, pk, *args, **kwargs):
        cand = CandidateQuestion.objects.filter(id=pk).first()
        if not cand:
            return Response({"detail": "Không tìm thấy candidate."}, status=404)
        cand.status = "rejected"
        cand.save(update_fields=["status"])
        return Response({"detail": "Đã từ chối câu hỏi."})





