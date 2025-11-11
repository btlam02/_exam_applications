# assessment/serializers.py
from rest_framework import serializers
from .models import (
    Subject, Question, QuestionOption, QuestionIRT, 
    StudentAbilityProfile, Topic
)
from django.db import transaction

# === CÁC SERIALIZER CHI TIẾT ===

class QuestionOptionSerializer(serializers.ModelSerializer):
    """
    Serializer cho LỰA CHỌN CÂU HỎI (dùng để ĐỌC).
    *** THAY ĐỔI: Đã XÓA 'is_correct' để chống gian lận.
    """
    class Meta:
        model = QuestionOption
        fields = ["id", "label", "content"] # Tuyệt đối không trả 'is_correct'

class QuestionDetailSerializer(serializers.ModelSerializer):
    """
    Serializer cho CÂU HỎI (dùng để ĐỌC).
    *** THAY ĐỔI: Trả về đầy đủ 'options' để ReactJS không cần gọi API lần 2.
    """
    options = QuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ["id", "subject", "stem", "item_type", "options"]

class StudentAbilityProfileSerializer(serializers.ModelSerializer):
    """
    *** THÊM MỚI: Dùng để xem chi tiết năng lực của sinh viên (cho admin/debug).
    """
    topic_name = serializers.CharField(source="topic.name", read_only=True)
    
    class Meta:
        model = StudentAbilityProfile
        fields = ["topic", "topic_name", "theta", "se", "updated_at"]

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name"]

class QuestionIRTSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionIRT
        fields = ["a", "b", "c"]

# === CÁC SERIALIZER ĐỂ GHI (Write/Create) ===

class QuestionOptionWriteSerializer(serializers.ModelSerializer):
    """
    *** THÊM MỚI: Serializer để TẠO lựa chọn (nhận 'is_correct' từ admin).
    """
    class Meta:
        model = QuestionOption
        fields = ["label", "content", "is_correct"] # Có is_correct khi tạo

class QuestionWriteSerializer(serializers.ModelSerializer):
    """
    *** ĐỔI TÊN: Đây là QuestionSerializer cũ của bạn, đổi tên để rõ ràng.
    Dùng để TẠO/CẬP NHẬT câu hỏi và các lựa chọn của nó.
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
            # Xóa các option cũ và tạo lại (cách đơn giản)
            instance.options.all().delete()
            for o in opts:
                QuestionOption.objects.create(question=instance, **o)
        return instance


# === CÁC SERIALIZER CHO API (Input) ===

class StartCatSerializer(serializers.Serializer):
    student_id = serializers.IntegerField() # Giả sử là User.id
    subject_id = serializers.IntegerField()
    target_items = serializers.IntegerField(default=10, min_value=3)

class AnswerCatSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()
    latency_ms = serializers.IntegerField(required=False)

class GenerateFixedTestSerializer(serializers.Serializer):
    """
    *** THÊM MỚI: Serializer cho Yêu cầu DEMO.
    """
    subject_id = serializers.IntegerField()
    num_questions = serializers.IntegerField(default=10, min_value=1)
    difficulty_tag = serializers.ChoiceField(
        choices=["easy", "medium", "hard"], 
        required=False
    )