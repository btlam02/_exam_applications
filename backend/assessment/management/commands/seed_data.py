# assessment/management/commands/seed_data.py
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

# Import TẤT CẢ các model của bạn
from assessment.models import (
    Subject, Topic, Question, QuestionOption, 
    QuestionTag, QuestionIRT
)

# Lấy model User (Custom User Model của bạn)
User = get_user_model()

class Command(BaseCommand):
    help = 'Gieo (seed) dữ liệu mẫu cho CSDL để test API'

    @transaction.atomic # Đảm bảo tất cả thành công hoặc không gì cả
    def handle(self, *args, **options):
        self.stdout.write("Bắt đầu gieo dữ liệu...")
        
        # --- 0. XÓA DỮ LIỆU CŨ ---
        self.stdout.write("Xóa dữ liệu cũ...")
        QuestionOption.objects.all().delete()
        QuestionTag.objects.all().delete()
        QuestionIRT.objects.all().delete()
        Question.objects.all().delete()
        Topic.objects.all().delete()
        Subject.objects.all().delete()
        
        # --- THAY ĐỔI LỚN Ở ĐÂY ---
        # Lỗi cũ là do dùng 'username'. Giờ chúng ta dùng 'email'.
        self.stdout.write("Tạo người dùng admin mẫu...")
        admin_user, created = User.objects.get_or_create(
            email='admin@example.com',  # <-- SỬA TỪ 'username' THÀNH 'email'
            defaults={
                'full_name': 'Admin Seeder', # <-- Thêm các trường bắt buộc (nếu có)
                'is_staff': True, 
                'is_superuser': True
            }
        )
        
        if created: # Dùng 'created' (rõ ràng hơn '_')
            admin_user.set_password('password123')
            admin_user.save()
            self.stdout.write("Đã tạo user 'admin@example.com' với pass 'password123'")
        # --- KẾT THÚC THAY ĐỔI ---

        # --- 1. TẠO MÔN HỌC (Subjects) ---
        sub1 = Subject.objects.create(name="Toán Rời Rạc")
        sub2 = Subject.objects.create(name="Cơ sở dữ liệu")

        # --- 2. TẠO CHỦ ĐỀ (Topics) ---
        topic1_1 = Topic.objects.create(subject=sub1, name="Chủ đề 1.1: Lý thuyết Đồ thị")
        topic1_2 = Topic.objects.create(subject=sub1, name="Chủ đề 1.2: Đại số Boolean")
        
        topic2_1 = Topic.objects.create(subject=sub2, name="Chủ đề 2.1: Đại số quan hệ")
        topic2_2 = Topic.objects.create(subject=sub2, name="Chủ đề 2.2: SQL Cơ bản")

        self.stdout.write("Đã tạo Subjects và Topics...")

        # --- 3. TẠO CÂU HỎI (Questions) ---
        
        # Câu 1 (Toán, Đồ thị, Dễ)
        self.create_full_question(
            subject=sub1,
            topic=topic1_1,
            stem="Một đồ thị G = (V, E) được gọi là 'vô hướng' khi nào?",
            difficulty_tag="easy",
            irt_b=-1.5, # (b < 0 là Dễ)
            created_by=admin_user,
            options=[
                ("A", "Các cạnh có thứ tự (u, v) khác (v, u).", False),
                ("B", "Các cạnh không có thứ tự (u, v) giống (v, u).", True),
                ("C", "Đồ thị có chu trình.", False),
                ("D", "Tất cả các đỉnh đều có bậc chẵn.", False),
            ]
        )

        # Câu 2 (Toán, Đồ thị, Trung bình)
        self.create_full_question(
            subject=sub1,
            topic=topic1_1,
            stem="Chu trình Euler tồn tại trong một đồ thị vô hướng liên thông khi nào?",
            difficulty_tag="medium",
            irt_b=0.0, # (b = 0 là TB)
            created_by=admin_user,
            options=[
                ("A", "Tất cả các đỉnh đều có bậc lẻ.", False),
                ("B", "Đồ thị có chính xác 2 đỉnh bậc lẻ.", False),
                ("C", "Tất cả các đỉnh đều có bậc chẵn.", True),
                ("D", "Đồ thị không có chu trình.", False),
            ]
        )

        # Câu 3 (Toán, Boolean, Trung bình)
        self.create_full_question(
            subject=sub1,
            topic=topic1_2,
            stem="Biểu thức nào tương đương với (A + B)' theo luật De Morgan?",
            difficulty_tag="medium",
            irt_b=0.2,
            created_by=admin_user,
            options=[
                ("A", "A' + B'", False),
                ("B", "A' . B'", True),
                ("C", "A . B'", False),
                ("D", "A + B'", False),
            ]
        )

        # Câu 4 (Toán, Boolean, Khó)
        self.create_full_question(
            subject=sub1,
            topic=topic1_2,
            stem="Rút gọn biểu thức (A + B) . (A + B')?",
            difficulty_tag="hard",
            irt_b=1.8, # (b > 0 là Khó)
            created_by=admin_user,
            options=[
                ("A", "A", True),
                ("B", "B", False),
                ("C", "A + B", False),
                ("D", "A . B", False),
            ]
        )

        # Câu 5 (CSDL, SQL, Dễ)
        self.create_full_question(
            subject=sub2,
            topic=topic2_2,
            stem="Lệnh SQL nào dùng để truy vấn dữ liệu từ một bảng?",
            difficulty_tag="easy",
            irt_b=-1.8,
            created_by=admin_user,
            options=[
                ("A", "UPDATE", False),
                ("B", "INSERT", False),
                ("C", "SELECT", True),
                ("D", "DELETE", False),
            ]
        )

        # Câu 6 (CSDL, SQL, Trung bình)
        self.create_full_question(
            subject=sub2,
            topic=topic2_2,
            stem="Mệnh đề nào dùng để lọc các nhóm sau khi đã GROUP BY?",
            difficulty_tag="medium",
            irt_b=0.5,
            created_by=admin_user,
            options=[
                ("A", "WHERE", False),
                ("B", "HAVING", True),
                ("C", "FILTER", False),
                ("D", "AFTER", False),
            ]
        )
        
        self.stdout.write(self.style.SUCCESS("Gieo dữ liệu thành công! Đã tạo 6 câu hỏi mẫu."))

    
    def create_full_question(self, subject, topic, stem, difficulty_tag, irt_b, created_by, options):
        """
        Hàm helper (trợ giúp) để tạo một câu hỏi đầy đủ
        (Question, Options, Tag, IRT)
        """
        
        q = Question.objects.create(
            subject=subject,
            stem=stem,
            difficulty_tag=difficulty_tag,
            created_by=created_by
        )
        
        for label, content, is_correct in options:
            QuestionOption.objects.create(
                question=q,
                label=label,
                content=content,
                is_correct=is_correct
            )
            
        QuestionTag.objects.create(
            question=q,
            topic=topic
        )
        
        QuestionIRT.objects.create(
            question=q,
            a=1.0,
            b=irt_b,
            c=0.25
        )