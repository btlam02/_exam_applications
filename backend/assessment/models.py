import uuid
from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

# === 1) Phân cấp tri thức ===
class Subject(models.Model):
    name = models.CharField(max_length=120, unique=True)

    def __str__(self): return self.name

class Topic(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="topics")
    name = models.CharField(max_length=160)

    class Meta:
        unique_together = ("subject", "name")

    def __str__(self): return f"{self.subject}:{self.name}"

class LearningOutcome(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="los")
    code = models.CharField(max_length=64, null=True, blank=True)
    description = models.TextField()

    def __str__(self): return self.code or f"LO@{self.topic_id}"

# === 2) Câu hỏi & đáp án ===
class Question(models.Model):
    ITEM_TYPES = (("MCQ", "Multiple Choice Single Correct"),)
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="questions")
    stem = models.TextField()
    item_type = models.CharField(max_length=16, choices=ITEM_TYPES, default="MCQ")
    difficulty_tag = models.CharField(max_length=16, null=True, blank=True)  # easy/medium/hard (demo)
    time_avg_sec = models.PositiveIntegerField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

class QuestionOption(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    label = models.CharField(max_length=4)   # A/B/C/D
    content = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        unique_together = ("question", "label")

class QuestionTag(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="tags")
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT)
    lo = models.ForeignKey(LearningOutcome, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        unique_together = ("question", "topic", "lo")

# === 3) Tham số IRT & thống kê ===
class QuestionIRT(models.Model):
    question = models.OneToOneField(Question, on_delete=models.CASCADE, primary_key=True, related_name="irt")
    a = models.FloatField(null=True, blank=True)  # discrimination
    b = models.FloatField(null=True, blank=True)  # difficulty
    c = models.FloatField(null=True, blank=True)  # guessing

class QuestionStats(models.Model):
    question = models.OneToOneField(Question, on_delete=models.CASCADE, primary_key=True, related_name="stats")
    p_value = models.FloatField(null=True, blank=True)          # tỷ lệ đúng lịch sử
    time_avg_sec = models.PositiveIntegerField(null=True, blank=True)
    exposure_rate = models.FloatField(null=True, blank=True)

# === 4) Người học & năng lực ===
class StudentAbility(models.Model):
    student = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="ability")
    theta = models.FloatField(default=0.0)
    se = models.FloatField(default=1.0)
    updated_at = models.DateTimeField(auto_now=True)

# === 5) Phiên kiểm tra (CAT & Fixed) ===
class TestSession(models.Model):
    MODE_CHOICES = (("CAT", "CAT"), ("FIXED", "FIXED"))
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    mode = models.CharField(max_length=8, choices=MODE_CHOICES)
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT)
    target_items = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=16, default="ONGOING")  # ONGOING/FINISHED
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

class TestItem(models.Model):
    session = models.ForeignKey(TestSession, on_delete=models.CASCADE, related_name="items")
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    position = models.PositiveIntegerField()
    served_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("session", "question")

class TestResponse(models.Model):
    session = models.ForeignKey(TestSession, on_delete=models.CASCADE, related_name="responses")
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    option = models.ForeignKey(QuestionOption, on_delete=models.PROTECT)
    is_correct = models.BooleanField()
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    answered_at = models.DateTimeField(auto_now_add=True)

# === 6) Luật suy luận đơn giản (JSON) ===
class Rule(models.Model):
    name = models.CharField(max_length=160)
    condition_json = models.JSONField(default=dict)  # {"type":"topic_mastery_below","topic_id":10,"threshold":0.4}
    action_json = models.JSONField(default=dict)     # {"type":"boost_topic_probability","topic_id":10,"weight":1.5}
    is_active = models.BooleanField(default=True)
