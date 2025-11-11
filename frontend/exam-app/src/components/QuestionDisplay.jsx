// src/components/QuestionDisplay.jsx
import React from 'react';

function QuestionDisplay({ question, onAnswerSelect, selectedOptionId, disabled = false }) {
  if (!question) return null;

  // Hàm style cũ đã được loại bỏ
  
  return (
    <div>
      {/* Thêm style cho câu hỏi */}
      <h3 className="text-xl font-semibold mb-4">{question.stem}</h3>
      
      <div>
        {question.options.map((option) => (
          <div
            key={option.id}
            /* Đây là phần chuyển đổi chính:
              - p-2.5 (10px)
              - border, rounded-md (border-radius: 5px)
              - my-1 (margin: 5px 0)
              - Logic động cho: cursor, background, border color
            */
            className={`
              p-2.5 border rounded-md my-1
              ${disabled 
                ? 'cursor-not-allowed bg-gray-100' // Style khi bị vô hiệu hóa
                : 'cursor-pointer hover:bg-gray-50' // Style khi hover
              }
              ${selectedOptionId === option.id 
                ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-500' // Style khi được chọn
                : 'bg-white border-gray-300' // Style mặc định
              }
            `}
            onClick={() => !disabled && onAnswerSelect(option.id)}
          >
            <strong className="font-bold mr-2">{option.label}:</strong> 
            {option.content}
          </div>
        ))}
      </div>
    </div>
  );
}
export default QuestionDisplay;