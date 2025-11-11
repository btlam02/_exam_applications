# assessment/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubjectViewSet, QuestionViewSet, CATViewSet, FixedTestViewSet

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"questions", QuestionViewSet, basename="question")

# *** THAY ĐỔI: 'basename' là không cần thiết cho ViewSet
# và thêm ViewSet mới
router.register(r"cat", CATViewSet, basename="cat")
router.register(r"fixed-test", FixedTestViewSet, basename="fixed-test")

urlpatterns = [path("", include(router.urls))]