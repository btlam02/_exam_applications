// src/components/Loader.jsx
import React from 'react';

function Loader({ message = "Đang tải..." }) {
  /*
    Thay thế cho: style={{ padding: '20px', fontSize: '1.2em' }}
    p-5 (20px), text-lg (1.125rem ~ 1.2em)
  */
  return (
    <div className="p-5 text-lg font-medium text-gray-600">
      {message}
    </div>
  );
}
export default Loader;