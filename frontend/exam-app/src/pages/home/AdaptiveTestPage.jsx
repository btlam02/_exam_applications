// src/pages/AdaptiveTestPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/assessment";
import QuestionDisplay from "../../components/QuestionDisplay";

function Spinner({ text = "Đang tải..." }) {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300"
      aria-live="polite"
    >
      <svg
        className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
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
  const [abilityVector, setAbilityVector] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // --- đo latency mỗi câu ---
  const startTimeRef = useRef(null);
  useEffect(() => {
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
        navigate("/results", { state: { results: data, session_id: sessionId } });
      } else {
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

  const handleQuit = () => navigate("/");

  // --- UI states ---
  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-16 dark:from-slate-900 dark:via-slate-950 dark:to-black">
        <div className="mx-auto max-w-3xl text-center">
          <Spinner text="Đang chuẩn bị bài test..." />
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Vui lòng đợi trong giây lát.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-slate-50 px-4 py-16 dark:from-slate-900 dark:via-slate-950 dark:to-black">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-700 shadow-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
          <button
            onClick={startTest}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-16 dark:from-slate-900 dark:via-slate-950 dark:to-black">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm text-slate-700 dark:text-slate-300">Không tìm thấy câu hỏi.</p>
            <button
              onClick={startTest}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Bắt đầu lại
            </button>
          </div>
        </div>
      </main>
    );
  }

  const progress = Math.min(
    100,
    Math.round((Math.max(testStats.position - 1, 0) / Math.max(testStats.target, 1)) * 100)
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-900/40 dark:bg-slate-900/40 dark:text-indigo-300">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
              CAT session
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Bài Kiểm Tra Thích Ứng (CAT)
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Câu hỏi {testStats.position} / {testStats.target}
            </p>
          </div>

          <button
            onClick={handleQuit}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Thoát
          </button>
        </header>

        {/* Question Card */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          {/* Progress bar */}
          <div className="mb-5">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Tiến độ</span>
              <span aria-live="polite">
                {progress}% ({testStats.position - 1}/{testStats.target})
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Câu {testStats.position}:
          </div>
          <QuestionDisplay
            question={currentQuestion}
            selectedOptionId={selectedOptionId}
            onAnswerSelect={setSelectedOptionId}
            disabled={isSubmitting}
          />

          {/* ability (nếu backend trả về) */}
          {abilityVector && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Tóm tắt năng lực (server trả):
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-300">
                {JSON.stringify(abilityVector, null, 2)}
              </pre>
            </div>
          )}

          {/* Error trong th*/}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}
        </section>

        {/* Action bar */}
        <div className="sticky bottom-4 z-10 mt-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Đã chọn: {selectedOptionId ? "1 đáp án" : "Chưa chọn"} | Câu {testStats.position} /{" "}
              {testStats.target}
            </div>
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedOptionId === null || isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Đang nộp…
                </>
              ) : (
                "Nộp & Tiếp tục"
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
