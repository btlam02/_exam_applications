// src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div>
      <h1>Hệ thống Sinh đề & Chấm điểm</h1>
      <p>Chọn một hình thức kiểm tra:</p>
      <ul>
        <li><Link to="/test/cat">Làm bài Test Thích Ứng (CAT)</Link></li>
        <li><Link to="/test/fixed">Làm bài Test Demo (Cố định)</Link></li>
      </ul>
      <p><em>(Lưu ý: API Admin (CRUD Câu hỏi) nên được quản lý qua Django Admin hoặc một trang Admin riêng biệt.)</em></p>
    </div>
  );
}
export default HomePage;