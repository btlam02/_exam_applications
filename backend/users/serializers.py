from rest_framework import serializers
from .models import User
from django.contrib.auth.hashers import make_password

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'full_name', 'role', 'password')
        extra_kwargs = {
        'password': {'write_only': True}
        }

    def validate_password(self, value): 
        return make_password(value)
    
    def create (self, validate_data):
        return super().create(validate_data)

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)




