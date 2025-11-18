# assessment/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SubjectViewSet,
    QuestionViewSet,
    CATViewSet,
    FixedTestViewSet,
    TopicViewSet,
    GenerateQuestionLLMView,
    CandidateQuestionListView,
    CandidateQuestionApproveView,
    CandidateQuestionRejectView,
)

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"questions", QuestionViewSet, basename="question")
router.register(r"topics", TopicViewSet, basename="topic")
router.register(r"cat", CATViewSet, basename="cat")
router.register(r"fixed-test", FixedTestViewSet, basename="fixed-test")

urlpatterns = [
    # 👇 ĐỂ TRƯỚC include(router.urls)
    path(
        "questions/generate-llm/",
        GenerateQuestionLLMView.as_view(),
        name="question-generate-llm",
    ),
    path(
        "questions/candidates/",
        CandidateQuestionListView.as_view(),
        name="candidate-question-list",
    ),
    path(
        "questions/candidates/<int:pk>/approve/",
        CandidateQuestionApproveView.as_view(),
        name="candidate-question-approve",
    ),
    path(
        "questions/candidates/<int:pk>/reject/",
        CandidateQuestionRejectView.as_view(),
        name="candidate-question-reject",
    ),

    path("", include(router.urls)),
]
