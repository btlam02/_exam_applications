from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubjectViewSet, QuestionViewSet, CATViewSet

router = DefaultRouter()
router.register(r"subjects", SubjectViewSet, basename="subject")
router.register(r"questions", QuestionViewSet, basename="question")
router.register(r"cat", CATViewSet, basename="cat")

urlpatterns = [path("", include(router.urls))]
