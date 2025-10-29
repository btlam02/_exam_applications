from rest_framework import serializers
from assessment.models import Subject, Question, QuestionOption, QuestionIRT, TestSession, TestItem, TestResponse, StudentAbility

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name"]

class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = ["id", "label", "content", "is_correct"]

class QuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, write_only=True)
    class Meta:
        model = Question
        fields = ["id", "subject", "stem", "difficulty_tag", "options"]

    def create(self, validated):
        opts = validated.pop("options", [])
        q = Question.objects.create(**validated)
        for o in opts:
            QuestionOption.objects.create(question=q, **o)
        return q

class QuestionIRTSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionIRT
        fields = ["a", "b", "c"]

class StartCatSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    subject_id = serializers.IntegerField()
    target_items = serializers.IntegerField()

class AnswerCatSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    question_id = serializers.IntegerField()
    option_id = serializers.IntegerField()
    latency_ms = serializers.IntegerField(required=False)
