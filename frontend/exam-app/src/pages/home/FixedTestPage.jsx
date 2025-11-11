// src/pages/FixedTestPage.jsx
import React, { useState } from "react";
import { generateFixedTest, submitFixedTest } from "../../api/assessment";
import QuestionDisplay from "../../components/QuestionDisplay";

function Spinner() {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600" aria-live="polite">
      <svg
        className="h-5 w-5 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
      <span>Đang tạo đề, vui lòng chờ…</span>
    </div>
  );
}

export default function FixedTestPage() {
  const [settings, setSettings] = useState({
    subject_id: 2,
    num_questions: 5,
    difficulty_tag: "medium",
  });

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});        // { [questionId]: optionId }
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);         // { total, correct, score_10, detail: [...] }

  // ---------------- handlers ----------------
  const handleChange = (key) => (e) => {
    const value =
      key === "difficulty_tag" ? e.target.value : parseInt(e.target.value || 0, 10);
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setError(null);
    try {
      const response = await generateFixedTest(settings);
      setQuestions(response.data?.questions || []);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
      setError("Lỗi khi tạo đề: " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId, optionId) => {
    if (submitted) return; // khoá chọn sau khi đã nộp
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const allAnswered =
    questions.length > 0 && questions.every((q) => !!answers[q.id]);

  const handleSubmit = async () => {
    try {
      setError(null);
      const payload = {
        answers: questions.map((q) => ({
          question_id: q.id,
          option_id: answers[q.id] ?? null,
        })),
      };
      const res = await submitFixedTest(payload);
      setResult(res.data); // { total, correct, score_10, detail }
      setSubmitted(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
      setError("Gửi bài thất bại: " + msg);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setError(null);
  };

  // ---------------- render ----------------
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sinh Đề Cố Định
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Chọn môn, số câu hỏi và độ khó để tạo đề nhanh cho học sinh.
          </p>
        </div>

        {(questions.length > 0 || submitted || result) && (
          <button
            onClick={handleReset}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="Làm lại"
          >
            Làm lại
          </button>
        )}
      </div>

      {/* Controls Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col">
            <label
              className="mb-1 text-sm font-medium text-slate-700"
              htmlFor="subject_id"
            >
              Subject ID
            </label>
            <input
              id="subject_id"
              type="number"
              min={1}
              value={settings.subject_id}
              onChange={handleChange("subject_id")}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="VD: 2"
            />
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 text-sm font-medium text-slate-700"
              htmlFor="num_questions"
            >
              Số câu
            </label>
            <input
              id="num_questions"
              type="number"
              min={1}
              value={settings.num_questions}
              onChange={handleChange("num_questions")}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="VD: 5"
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label
              className="mb-1 text-sm font-medium text-slate-700"
              htmlFor="difficulty_tag"
            >
              Độ khó
            </label>
            <select
              id="difficulty_tag"
              value={settings.difficulty_tag}
              onChange={handleChange("difficulty_tag")}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            * Bạn có thể thay input bằng Dropdown gọi API{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">/subjects</code>.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Đang tạo…
              </div>
            ) : (
              "Tạo Đề"
            )}
          </button>
        </div>

        {isLoading && (
          <div className="mt-4">
            <Spinner />
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}
      </div>

      {/* Questions List */}
      {questions?.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Đề thi của bạn
          </h2>
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div
                key={q.id ?? `q-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-700">
                    Câu {index + 1}:
                  </div>
                  {answers[q.id] && (
                    <span className="text-xs text-slate-500">Đã chọn</span>
                  )}
                </div>

                {/* Cho phép chọn đáp án (khoá khi submitted) */}
                <QuestionDisplay
                  question={q}
                  selectedOptionId={answers[q.id]}
                  onAnswerSelect={(optionId) =>
                    handleAnswerSelect(q.id, optionId)
                  }
                  disabled={submitted}
                />
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="text-sm text-slate-600">
              {Object.keys(answers).length}/{questions.length} câu đã chọn
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitted}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitted ? "Đã nộp" : "Nộp bài"}
              </button>
            </div>
          </div>

          {/* Kết quả sau khi nộp */}
          {submitted && result && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-emerald-700">
                Kết quả: <b>{result.correct}/{result.total}</b> câu đúng — Điểm:{" "}
                <b>{result.score_10}</b>
              </div>

              {/* Chi tiết từng câu (tuỳ chọn) */}
              {Array.isArray(result.detail) && result.detail.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-slate-700 mb-2">
                    Chi tiết từng câu:
                  </div>
                  <ul className="space-y-2">
                    {result.detail.map((d, i) => (
                      <li
                        key={d.question_id ?? `detail-${i}`}
                        className="text-sm text-slate-600"
                      >
                        Câu {i + 1}:{" "}
                        {d.is_correct ? (
                          <span className="text-emerald-700 font-medium">
                            Đúng
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            Sai
                          </span>
                        )}{" "}
                        <span className="opacity-60">
                          (Đã chọn ID {d.selected_option_id}, đúng là ID{" "}
                          {d.correct_option_id ?? "?"})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!questions || questions.length === 0) && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-600">
            Chưa có đề nào. Hãy cấu hình và nhấn{" "}
            <span className="font-medium text-slate-900">Tạo Đề</span>.
          </p>
        </div>
      )}
    </div>
  );
}
