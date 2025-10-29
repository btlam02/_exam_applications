# users/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User
from .serializers import UserSerializer, UserLoginSerializer
from .permissions import IsAdminRole, IsOwnerOrAdmin


class UserRegisterView(APIView):
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Đăng ký thành công!'}, status=status.HTTP_201_CREATED)
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class UserLoginView(APIView): 
    def post(self, request): 
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = authenticate(
                request,
                username=serializer.validated_data['email'],
                password=serializer.validated_data['password'],
            )
            if user:
                refresh = TokenObtainPairSerializer.get_token(user)
                return Response({
                    'email': user.email,
                    'role': user.role,
                    'refresh_token': str(refresh),
                    'access_token': str(refresh.access_token),
                    'access_expires': int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                    'refresh_expires': int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
                }, status=status.HTTP_200_OK)
        return Response({'error_message': 'Thông tin xác thực không hợp lệ'}, status=status.HTTP_401_UNAUTHORIZED)


class UserLogoutView(APIView): 
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Đã đăng xuất'}, status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response({'error_message': 'Token không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)


# Admin: Xem và thêm danh sách tất cả người dùng
class UserListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Tạo tài khoản thành công!'}, status=status.HTTP_201_CREATED)
        return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# Xem/Sửa/Xoá tài khoản (chính chủ hoặc admin)
class UserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self, pk):
        return get_object_or_404(User, pk=pk)

    def get(self, request, pk):
        user = self.get_object(pk)
        if request.user.role == 'admin' or request.user == user:
            serializer = UserSerializer(user)
            return Response(serializer.data)
        return Response({'detail': 'Không có quyền truy cập'}, status=status.HTTP_403_FORBIDDEN)

    def put(self, request, pk):
        user = self.get_object(pk)
        if request.user.role == 'admin' or request.user == user:
            serializer = UserSerializer(user, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Không có quyền chỉnh sửa'}, status=status.HTTP_403_FORBIDDEN)

    def delete(self, request, pk):
        user = self.get_object(pk)
        if request.user.role == 'admin':
            user.delete()
            return Response({'message': 'Đã xoá người dùng'}, status=status.HTTP_204_NO_CONTENT)
        return Response({'detail': 'Chỉ admin có quyền xoá'}, status=status.HTTP_403_FORBIDDEN)



class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)