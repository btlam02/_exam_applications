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
  const DEFAULT_TARGET_ITEMS = 10;

  const navigate = useNavigate();

  // --- state danh sách môn học ---
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(null);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState(null);

  // --- state danh sách topic theo môn ---
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState(null); // null = tất cả chủ đề
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState(null);

  // --- state chính của CAT ---
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);

  const [testStats, setTestStats] = useState({ position: 0, target: 0 });
  const [abilityVector, setAbilityVector] = useState(null);

  // isLoading: đang gọi /cat/start/ hoặc đang load câu hỏi đầu tiên
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // --- đo latency mỗi câu ---
  const startTimeRef = useRef(null);
  useEffect(() => {
    if (currentQuestion?.id) {
      startTimeRef.current = performance.now();
    }
  }, [currentQuestion?.id]);

  // --- load danh sách môn từ backend ---
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoadingSubjects(true);
      setSubjectsError(null);
      try {
        const res = await apiClient.get("/subjects/");
        const data = res.data || [];
        setSubjects(data);
        if (data.length > 0) {
          setSubjectId(data[0].id); // chọn mặc định môn đầu tiên
        } else {
          setSubjectId(null);
        }
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
        setSubjectsError("Không thể tải danh sách môn học: " + msg);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  // --- mỗi khi đổi môn -> load lại danh sách topic ---
  useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      setTopicId(null);
      return;
    }

    const fetchTopics = async () => {
      setIsLoadingTopics(true);
      setTopicsError(null);
      setTopics([]);
      setTopicId(null); // mặc định: tất cả chủ đề

      try {
        // giả định bạn có endpoint /topics/?subject_id=...
        const res = await apiClient.get("/topics/", {
          params: { subject_id: subjectId },
        });
        const data = res.data || [];
        setTopics(data);
        // mặc định vẫn để topicId = null (tất cả chủ đề)
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
        setTopicsError("Không thể tải danh sách chủ đề: " + msg);
      } finally {
        setIsLoadingTopics(false);
      }
    };

    // chỉ load topics khi CHƯA có session đang chạy
    if (!sessionId) {
      fetchTopics();
    }
  }, [subjectId, sessionId]);

  const startTest = async () => {
    if (!subjectId) {
      setError("Vui lòng chọn môn học trước khi bắt đầu.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedOptionId(null);
    setAbilityVector(null);
    setCurrentQuestion(null);
    setSessionId(null);

    try {
      // build payload
      const payload = {
        student_id: DEFAULT_STUDENT_ID,
        subject_id: subjectId,
        target_items: DEFAULT_TARGET_ITEMS,
      };

      // nếu user chọn 1 topic cụ thể -> gửi topic_id
      // nếu topicId === null -> không gửi, backend tự chọn topic
      if (topicId !== null) {
        payload.topic_id = topicId;
      }

      const res = await apiClient.post("/cat/start/", payload);
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
    if (selectedOptionId === null || !sessionId || !currentQuestion) return;

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

  const progress =
    sessionId && testStats.target > 0
      ? Math.min(
          100,
          Math.round((Math.max(testStats.position - 1, 0) / Math.max(testStats.target, 1)) * 100)
        )
      : 0;

  const noSubjects = !isLoadingSubjects && subjects.length === 0;

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

            {/* chọn môn + chọn chủ đề + nút bắt đầu */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {/* MÔN HỌC */}
              <label className="text-slate-600 dark:text-slate-300">
                Môn học:
                {isLoadingSubjects ? (
                  <span className="ml-2 inline-flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <svg
                      className="mr-1 h-3 w-3 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                    Đang tải danh sách môn...
                  </span>
                ) : noSubjects ? (
                  <span className="ml-2 text-red-600 dark:text-red-400">
                    (Không có môn học nào trong hệ thống)
                  </span>
                ) : (
                  <select
                    className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={subjectId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSubjectId(v ? Number(v) : null);
                    }}
                    disabled={!!sessionId || isLoading || isSubmitting}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.title || `Môn ${s.id}`}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {/* CHỦ ĐỀ */}
              <label className="text-slate-600 dark:text-slate-300">
                Chủ đề:
                {isLoadingTopics && subjectId ? (
                  <span className="ml-2 inline-flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <svg
                      className="mr-1 h-3 w-3 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                    Đang tải chủ đề...
                  </span>
                ) : topics.length === 0 ? (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    (Tất cả chủ đề)
                  </span>
                ) : (
                  <select
                    className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={topicId ?? ""} // "" = tất cả
                    onChange={(e) => {
                      const v = e.target.value;
                      setTopicId(v === "" ? null : Number(v));
                    }}
                    disabled={!!sessionId || isLoading || isSubmitting}
                  >
                    <option value="">
                      Tất cả chủ đề (hệ thống tự chọn)
                    </option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || `Chủ đề ${t.id}`}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {!sessionId && (
                <button
                  onClick={startTest}
                  disabled={
                    isLoading ||
                    isLoadingSubjects ||
                    noSubjects ||
                    subjectId === null ||
                    subjectId === ""
                  }
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Đang chuẩn bị..." : "Bắt đầu test"}
                </button>
              )}

              {sessionId && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Câu hỏi {testStats.position} / {testStats.target}
                </p>
              )}
            </div>

            {/* Thông tin chủ đề đang lock (nếu có) */}
            {sessionId && topicId !== null && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Phiên CAT này đang tập trung vào chủ đề:{" "}
                <span className="font-medium">
                  {topics.find((t) => t.id === topicId)?.name || `Topic ${topicId}`}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleQuit}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Thoát
          </button>
        </header>

        {/* Error load môn */}
        {subjectsError && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {subjectsError}
          </div>
        )}

        {/* Error load chủ đề */}
        {topicsError && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {topicsError}
          </div>
        )}

        {/* Error chung của CAT */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Question Card */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          {/* Progress bar */}
          {sessionId && (
            <div className="mb-5">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Tiến độ</span>
                <span aria-live="polite">
                  {progress}% ({Math.max(testStats.position - 1, 0)}/{testStats.target})
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
          )}

          {/* Nội dung chính: tuỳ theo trạng thái */}
          {!sessionId && !isLoading && !isLoadingSubjects && !noSubjects && (
            <div className="text-sm text-slate-700 dark:text-slate-300">
              Vui lòng chọn môn học (và chủ đề nếu muốn) rồi nhấn{" "}
              <span className="font-semibold">“Bắt đầu test”</span> để hệ thống sinh bài kiểm tra thích ứng.
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-6">
              <Spinner text="Đang chuẩn bị bài test..." />
            </div>
          )}

          {sessionId && !isLoading && !currentQuestion && (
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Không tìm thấy câu hỏi cho phiên làm bài này.
              </p>
              <button
                onClick={startTest}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Bắt đầu lại
              </button>
            </div>
          )}

          {sessionId && !isLoading && currentQuestion && (
            <>
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
            </>
          )}

          {noSubjects && (
            <div className="text-sm text-slate-700 dark:text-slate-300">
              Hiện tại hệ thống chưa có môn học nào. Vui lòng thêm môn ở phía backend (ví dụ tại
              trang quản trị) rồi tải lại trang.
            </div>
          )}
        </section>

        {/* Action bar: chỉ hiện khi đang trong phiên và có câu hỏi */}
        {sessionId && currentQuestion && (
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
                    Đang nộp…
                  </>
                ) : (
                  "Nộp & Tiếp tục"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
