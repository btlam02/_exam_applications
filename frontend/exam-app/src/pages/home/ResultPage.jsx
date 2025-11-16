// src/pages/ResultsPage.jsx
import React from 'react';
import { useLocation, Link } from 'react-router-dom';

function ResultsPage() {
  const location = useLocation();
  const results = location.state?.results;

  if (!results) {
    return (
      <div>
        <h2>Không có dữ liệu kết quả</h2>
        <Link to="/">Quay về trang chủ</Link>
      </div>
    );
  }
  
  // Chuyển đổi ability_vector (object) thành một mảng để map
  const abilities = Object.entries(results.ability_vector || {});

  return (
    <div>
      <h2>Hoàn Thành Bài Kiểm Tra!</h2>
      <p>Bài test của bạn đã kết thúc.</p>
      
      <h3>Ước lượng Năng lực (Theta)</h3>
      <p>Đây là ước lượng năng lực (theta) cuối cùng của bạn theo từng chủ đề:</p>
      
      {abilities.length > 0 ? (
        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
          {abilities.map(([topicId, theta]) => (
            <li key={topicId} style={{ background: '#f4f4f4', margin: '5px 0', padding: '10px' }}>
              <strong>Chủ đề (ID: {topicId}):</strong> {theta.toFixed(4)}
            </li>
          ))}
        </ul>
      ) : (
        <p>Không có dữ liệu năng lực.</p>
      )}

      <pre style={{ background: '#eee', padding: '10px', overflowX: 'auto' }}>
        {JSON.stringify(results, null, 2)}
      </pre>
      
      <Link to="/">Làm bài test khác</Link>
    </div>
  );
}

export default ResultsPage;