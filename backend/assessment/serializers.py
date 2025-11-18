# assessment/serializers.py
from rest_framework import serializers
from django.db import transaction

from .models import (
    Subject, Question, QuestionOption, QuestionIRT,
    StudentAbilityProfile, Topic
)

# === SERIALIZER ĐỌC CHI TIẾT ===

class QuestionOptionSerializer(serializers.ModelSerializer):
    """
    Lựa chọn câu hỏi (READ ONLY).
    Không trả 'is_correct' ra ngoài để tránh lộ đáp án.
    """
    class Meta:
        model = QuestionOption
        fields = ["id", "label", "content"]


class QuestionDetailSerializer(serializers.ModelSerializer):
    """
    Câu hỏi + danh sách options (READ ONLY).
    React dùng trực tiếp, không cần gọi thêm API lấy đáp án.
    """
    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "subject", "stem", "item_type", "options"]


class StudentAbilityProfileSerializer(serializers.ModelSerializer):
    """
    Xem profile năng lực theo topic (cho admin / debug).
    """
    topic_name = serializers.CharField(source="topic.name", read_only=True)

    class Meta:
        model = StudentAbilityProfile
        fields = ["topic", "topic_name", "theta", "se", "updated_at"]


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name"]


class TopicSerializer(serializers.ModelSerializer):
    """
    Dùng cho endpoint /topics/ (nếu bạn tạo).
    Cho phép frontend load danh sách chủ đề theo môn.
    """
    subject_id = serializers.IntegerField(source="subject.id", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = Topic
        fields = ["id", "name", "subject_id", "subject_name"]


class QuestionIRTSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionIRT
        fields = ["a", "b", "c"]


# === SERIALIZER GHI (CREATE/UPDATE) ===

class QuestionOptionWriteSerializer(serializers.ModelSerializer):
    """
    Serializer để TẠO/CẬP NHẬT lựa chọn (có 'is_correct' cho admin).
    """
    class Meta:
        model = QuestionOption
        fields = ["label", "content", "is_correct"]


class QuestionWriteSerializer(serializers.ModelSerializer):
    """
    Tạo/cập nhật câu hỏi + toàn bộ options.
    """
    options = QuestionOptionWriteSerializer(many=True, write_only=True)

    class Meta:
        model = Question
        fields = ["id", "subject", "stem", "item_type", "difficulty_tag", "options"]

    @transaction.atomic
    def create(self, validated_data):
        opts = validated_data.pop("options", [])
        q = Question.objects.create(**validated_data)
        for o in opts:
            QuestionOption.objects.create(question=q, **o)
        return q

    @transaction.atomic
    def update(self, instance, validated_data):
        opts = validated_data.pop("options", [])
        instance = super().update(instance, validated_data)

        if opts:
            # Xóa options cũ và tạo lại (đơn giản, dễ hiểu)
            instance.options.all().delete()
            for o in opts:
                QuestionOption.objects.create(question=instance, **o)
        return instance


# === SERIALIZER INPUT CHO API ===

class StartCatSerializer(serializers.Serializer):
    """
    Input khi BẮT ĐẦU phiên CAT.

    - Nếu có topic_id  -> khoá bài test vào đúng topic đó.
    - Nếu không gửi   -> để None, hệ thống tự chọn topic trong toàn bộ môn.
    """
    student_id = serializers.IntegerField()     # User.id
    subject_id = serializers.IntegerField()
    target_items = serializers.IntegerField(default=10, min_value=3)
    topic_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        subject_id = attrs.get("subject_id")
        topic_id = attrs.get("topic_id", None)

        # Nếu client gửi topic_id thì kiểm tra topic này có thuộc môn không
        if topic_id is not None:
            exists = Topic.objects.filter(id=topic_id, subject_id=subject_id).exists()
            if not exists:
                raise serializers.ValidationError(
                    "Chủ đề (topic) không thuộc môn học đã chọn."
                )
        return attrs


class AnswerCatSerializer(serializers.Serializer):
    """
    Input khi NỘP ĐÁP ÁN cho 1 câu trong phiên CAT.
    """
    session_id = serializers.UUIDField()
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()
    latency_ms = serializers.IntegerField(required=False)
    topic_id = serializers.IntegerField(required=False, allow_null=True)


class GenerateFixedTestSerializer(serializers.Serializer):
    """
    Input cho DEMO sinh đề cố định (fixed test).
    """
    subject_id = serializers.IntegerField()
    num_questions = serializers.IntegerField(default=10, min_value=1)
    difficulty_tag = serializers.ChoiceField(
        choices=["easy", "medium", "hard"],
        required=False
    )
