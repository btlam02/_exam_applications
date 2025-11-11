// src/pages/AdaptiveTestPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/assessment"; // dùng trực tiếp như bạn đang có
import QuestionDisplay from "../../components/QuestionDisplay";

function Spinner({ text = "Đang tải..." }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600" aria-live="polite">
      <svg
        className="h-5 w-5 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export default function AdaptiveTestPage() {
  // --- cấu hình tạm thời (có thể đưa vào context khi đã login) ---
  const DEFAULT_STUDENT_ID = 1;
  const DEFAULT_SUBJECT_ID = 2;
  const DEFAULT_TARGET_ITEMS = 10;

  const navigate = useNavigate();

  // --- state chính ---
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);

  const [testStats, setTestStats] = useState({ position: 0, target: 0 });
  const [abilityVector, setAbilityVector] = useState(null); // để xem năng lực trả về nếu backend có trả

  const [isLoading, setIsLoading] = useState(true);   // khi start
  const [isSubmitting, setIsSubmitting] = useState(false); // khi nộp đáp án
  const [error, setError] = useState(null);

  // --- đo latency mỗi câu ---
  const startTimeRef = useRef(null);
  useEffect(() => {
    // set mốc thời gian khi có câu hỏi mới
    if (currentQuestion?.id) startTimeRef.current = performance.now();
  }, [currentQuestion?.id]);

  // --- bắt đầu bài test ---
  useEffect(() => {
    startTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTest = async () => {
    setIsLoading(true);
    setError(null);
    setSelectedOptionId(null);
    setAbilityVector(null);
    try {
      const res = await apiClient.post("/cat/start/", {
        student_id: DEFAULT_STUDENT_ID,
        subject_id: DEFAULT_SUBJECT_ID,
        target_items: DEFAULT_TARGET_ITEMS,
      });
      const data = res.data;
      setSessionId(data.session_id);
      setCurrentQuestion(data.next_question);
      setTestStats({ position: data.current_position, target: data.target_items });
      setAbilityVector(data.ability_vector ?? null);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
      setError("Lỗi không thể bắt đầu bài test: " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (selectedOptionId === null) return;

    setIsSubmitting(true);
    setError(null);

    const latency_ms =
      startTimeRef.current != null ? Math.round(performance.now() - startTimeRef.current) : null;

    try {
      const res = await apiClient.post("/cat/answer/", {
        session_id: sessionId,
        question_id: currentQuestion.id,
        option_id: selectedOptionId,
        latency_ms,
      });

      const data = res.data;

      if (data.stop) {
        // điều hướng sang trang kết quả, truyền state nếu cần hiển thị thêm
        navigate("/results", { state: { results: data, session_id: sessionId } });
      } else {
        // chuyển câu kế tiếp
        setCurrentQuestion(data.next_question);
        setTestStats({ position: data.current_position, target: data.target_items });
        setAbilityVector(data.ability_vector ?? null);
        setSelectedOptionId(null);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
      setError("Lỗi khi nộp câu trả lời: " + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuit = () => {
    // có thể gọi API kết thúc session nếu backend hỗ trợ, tạm thời quay về trang chủ/kết quả
    navigate("/");
  };

  // --- render ---
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Spinner text="Đang chuẩn bị bài test..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <button
          onClick={startTest}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">Không tìm thấy câu hỏi.</p>
          <button
            onClick={startTest}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Bắt đầu lại
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.min(
    100,
    Math.round((Math.max(testStats.position - 1, 0) / Math.max(testStats.target, 1)) * 100)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Bài Kiểm Tra Thích Ứng (CAT)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Câu hỏi {testStats.position} / {testStats.target}
          </p>
        </div>
        <button
          onClick={handleQuit}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Thoát
        </button>
      </div>

      {/* Thẻ câu hỏi */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Tiến độ</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-slate-900 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-2 text-sm font-medium text-slate-700">Câu {testStats.position}:</div>
        <QuestionDisplay
          question={currentQuestion}
          selectedOptionId={selectedOptionId}
          onAnswerSelect={setSelectedOptionId}
          disabled={isSubmitting}
        />

        {/* ability (nếu backend trả về) */}
        {abilityVector && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-600 mb-1">Tóm tắt năng lực (server trả):</div>
            <pre className="whitespace-pre-wrap break-words text-xs text-slate-600">
              {JSON.stringify(abilityVector, null, 2)}
            </pre>
          </div>
        )}

        {/* Error trong thẻ */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="text-sm text-slate-600">
          Đã chọn: {selectedOptionId ? "1 đáp án" : "Chưa chọn"} | Câu {testStats.position} / {testStats.target}
        </div>
        <button
          onClick={handleSubmitAnswer}
          disabled={selectedOptionId === null || isSubmitting}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Đang nộp…" : "Nộp & Tiếp tục"}
        </button>
      </div>
    </div>
  );
}
