# users/urls.py
from django.urls import path
from .views import (
    UserRegisterView, UserLoginView, UserLogoutView,
    UserListView, UserDetailView,CurrentUserView
)


urlpatterns = [
    path('register/', UserRegisterView.as_view()),
    path('login/', UserLoginView.as_view()),
    path('logout/', UserLogoutView.as_view()),
    path('', UserListView.as_view()),
    path('<int:pk>/', UserDetailView.as_view()),
    path('me/', CurrentUserView.as_view(), name='current-user'),

]
