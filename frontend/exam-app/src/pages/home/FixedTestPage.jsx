// // src/pages/FixedTestPage.jsx
// import React, { useState } from "react";
// import { generateFixedTest, submitFixedTest } from "../../api/assessment";
// import QuestionDisplay from "../../components/QuestionDisplay";

// function Spinner({ text = "Đang tạo đề, vui lòng chờ…" }) {
//   return (
//     <div
//       className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300"
//       aria-live="polite"
//     >
//       <svg
//         className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400"
//         xmlns="http://www.w3.org/2000/svg"
//         fill="none"
//         viewBox="0 0 24 24"
//         aria-hidden
//       >
//         <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//         <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
//       </svg>
//       <span>{text}</span>
//     </div>
//   );
// }

// export default function FixedTestPage() {
//   const [settings, setSettings] = useState({
//     subject_id: 2,
//     num_questions: 5,
//     difficulty_tag: "medium",
//   });

//   const [questions, setQuestions] = useState([]);
//   const [answers, setAnswers] = useState({}); // { [questionId]: optionId }
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const [submitted, setSubmitted] = useState(false);
//   const [result, setResult] = useState(null); // { total, correct, score_10, detail: [...] }

//   // ---------------- handlers ----------------
//   const handleChange = (key) => (e) => {
//     const value = key === "difficulty_tag" ? e.target.value : parseInt(e.target.value || 0, 10);
//     setSettings((s) => ({ ...s, [key]: value }));
//   };

//   const handleGenerate = async () => {
//     setIsLoading(true);
//     setQuestions([]);
//     setAnswers({});
//     setSubmitted(false);
//     setResult(null);
//     setError(null);
//     try {
//       const response = await generateFixedTest(settings);
//       setQuestions(response.data?.questions || []);
//     } catch (err) {
//       const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
//       setError("Lỗi khi tạo đề: " + msg);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleAnswerSelect = (questionId, optionId) => {
//     if (submitted) return; // khoá chọn sau khi đã nộp
//     setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
//   };

//   const allAnswered = questions.length > 0 && questions.every((q) => !!answers[q.id]);
//   const answeredCount = Object.keys(answers).length;

//   const handleSubmit = async () => {
//     try {
//       setError(null);
//       const payload = {
//         answers: questions.map((q) => ({
//           question_id: q.id,
//           option_id: answers[q.id] ?? null,
//         })),
//       };
//       const res = await submitFixedTest(payload);
//       setResult(res.data);
//       setSubmitted(true);
//     } catch (err) {
//       const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
//       setError("Gửi bài thất bại: " + msg);
//     }
//   };

//   const handleReset = () => {
//     setQuestions([]);
//     setAnswers({});
//     setSubmitted(false);
//     setResult(null);
//     setError(null);
//   };

//   const progressPct =
//     questions.length > 0 ? Math.min(100, Math.round((answeredCount / questions.length) * 100)) : 0;

//   // ---------------- render ----------------
//   return (
//     <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-black">
//       <div className="mx-auto max-w-4xl">
//         {/* Header */}
//         <header className="mb-6 flex items-center justify-between">
//           <div>
//             <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-xs text-violet-700 shadow-sm backdrop-blur dark:border-violet-900/40 dark:bg-slate-900/40 dark:text-violet-300">
//               <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
//               Fixed test
//             </div>
//             <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
//               Sinh Đề Cố Định
//             </h1>
//             <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
//               Chọn môn, số câu hỏi và độ khó để tạo đề nhanh cho học sinh.
//             </p>
//           </div>

//           {(questions.length > 0 || submitted || result) && (
//             <button
//               onClick={handleReset}
//               className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900"
//               aria-label="Làm lại"
//             >
//               Làm lại
//             </button>
//           )}
//         </header>

//         {/* Controls Card */}
//         <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
//           <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
//             <div className="flex flex-col">
//               <label className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="subject_id">
//                 Subject ID
//               </label>
//               <input
//                 id="subject_id"
//                 type="number"
//                 min={1}
//                 value={settings.subject_id}
//                 onChange={handleChange("subject_id")}
//                 className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
//                 placeholder="VD: 2"
//               />
//             </div>

//             <div className="flex flex-col">
//               <label className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="num_questions">
//                 Số câu
//               </label>
//               <input
//                 id="num_questions"
//                 type="number"
//                 min={1}
//                 value={settings.num_questions}
//                 onChange={handleChange("num_questions")}
//                 className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
//                 placeholder="VD: 5"
//               />
//             </div>

//             <div className="flex flex-col md:col-span-2">
//               <label className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="difficulty_tag">
//                 Độ khó
//               </label>
//               <select
//                 id="difficulty_tag"
//                 value={settings.difficulty_tag}
//                 onChange={handleChange("difficulty_tag")}
//                 className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
//               >
//                 <option value="easy">Dễ</option>
//                 <option value="medium">Trung bình</option>
//                 <option value="hard">Khó</option>
//               </select>
//             </div>
//           </div>

//           <div className="mt-4 flex items-center justify-between">
//             <p className="text-xs text-slate-500 dark:text-slate-400">
//               * Bạn có thể thay input bằng Dropdown gọi API{" "}
//               <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">/subjects</code>.
//             </p>
//             <button
//               onClick={handleGenerate}
//               disabled={isLoading}
//               className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
//             >
//               {isLoading ? (
//                 <div className="flex items-center gap-2">
//                   <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
//                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
//                   </svg>
//                   Đang tạo…
//                 </div>
//               ) : (
//                 "Tạo Đề"
//               )}
//             </button>
//           </div>

//           {isLoading && (
//             <div className="mt-4">
//               <Spinner />
//             </div>
//           )}

//           {error && (
//             <div
//               className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
//               role="alert"
//             >
//               {error}
//             </div>
//           )}
//         </section>

//         {/* Questions List */}
//         {questions?.length > 0 && (
//           <section className="mt-8">
//             <div className="mb-3 flex items-center justify-between">
//               <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Đề thi của bạn</h2>
//               {/* progress answered */}
//               <div className="w-48">
//                 <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
//                   <span>Tiến độ</span>
//                   <span>
//                     {answeredCount}/{questions.length} ({progressPct}%)
//                   </span>
//                 </div>
//                 <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
//                   <div
//                     className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-300 ease-out"
//                     style={{ width: `${progressPct}%` }}
//                     role="progressbar"
//                     aria-valuenow={progressPct}
//                     aria-valuemin={0}
//                     aria-valuemax={100}
//                   />
//                 </div>
//               </div>
//             </div>

//             <div className="space-y-4">
//               {questions.map((q, index) => (
//                 <article
//                   key={q.id ?? `q-${index}`}
//                   className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/60"
//                 >
//                   <div className="mb-2 flex items-center justify-between">
//                     <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
//                       Câu {index + 1}:
//                     </div>
//                     {answers[q.id] && (
//                       <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
//                         <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
//                         Đã chọn
//                       </span>
//                     )}
//                   </div>

//                   <QuestionDisplay
//                     question={q}
//                     selectedOptionId={answers[q.id]}
//                     onAnswerSelect={(optionId) => handleAnswerSelect(q.id, optionId)}
//                     disabled={submitted}
//                   />
//                 </article>
//               ))}
//             </div>

//             {/* Action bar */}
//             <div className="sticky bottom-4 z-10 mt-6">
//               <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
//                 <div className="text-sm text-slate-600 dark:text-slate-300">
//                   {answeredCount}/{questions.length} câu đã chọn
//                 </div>
//                 <button
//                   onClick={handleSubmit}
//                   disabled={!allAnswered || submitted}
//                   className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
//                 >
//                   {submitted ? "Đã nộp" : "Nộp bài"}
//                 </button>
//               </div>
//             </div>

//             {/* Kết quả sau khi nộp */}
//             {submitted && result && (
//               <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
//                 <div className="text-sm text-emerald-700 dark:text-emerald-300">
//                   Kết quả: <b>{result.correct}/{result.total}</b> câu đúng — Điểm:{" "}
//                   <b>{result.score_10}</b>
//                 </div>

//                 {Array.isArray(result.detail) && result.detail.length > 0 && (
//                   <div className="mt-3">
//                     <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
//                       Chi tiết từng câu:
//                     </div>
//                     <ul className="space-y-2">
//                       {result.detail.map((d, i) => (
//                         <li
//                           key={d.question_id ?? `detail-${i}`}
//                           className="text-sm text-slate-600 dark:text-slate-300"
//                         >
//                           Câu {i + 1}:{" "}
//                           {d.is_correct ? (
//                             <span className="font-medium text-emerald-700 dark:text-emerald-300">Đúng</span>
//                           ) : (
//                             <span className="font-medium text-red-600 dark:text-red-300">Sai</span>
//                           )}{" "}
//                           <span className="opacity-60">
//                             (Đã chọn ID {d.selected_option_id}, đúng là ID {d.correct_option_id ?? "?"})
//                           </span>
//                         </li>
//                       ))}
//                     </ul>
//                   </div>
//                 )}
//               </div>
//             )}
//           </section>
//         )}

//         {/* Empty State */}
//         {!isLoading && !error && (!questions || questions.length === 0) && (
//           <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/40">
//             <p className="text-sm text-slate-600 dark:text-slate-300">
//               Chưa có đề nào. Hãy cấu hình và nhấn{" "}
//               <span className="font-medium text-slate-900 dark:text-white">Tạo Đề</span>.
//             </p>
//           </section>
//         )}
//       </div>
//     </main>
//   );
// }


// src/pages/FixedTestPage.jsx
import React, { useState, useEffect } from "react";
import apiClient, { generateFixedTest, submitFixedTest } from "../../api/assessment";
import QuestionDisplay from "../../components/QuestionDisplay";

function Spinner({ text = "Đang tạo đề, vui lòng chờ…" }) {
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

export default function FixedTestPage() {
  // --- cấu hình sinh đề ---
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficultyTag, setDifficultyTag] = useState("medium");

  // --- danh sách môn học ---
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(null);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState(null);

  // --- danh sách chủ đề theo môn ---
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState(null); // null = tất cả chủ đề
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState(null);

  // --- đề + câu trả lời ---
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionId }

  const [isLoading, setIsLoading] = useState(false); // loading generate đề
  const [error, setError] = useState(null);

  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null); // { total, correct, score_10, detail: [...] }

  // ---------------- load subjects ----------------
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoadingSubjects(true);
      setSubjectsError(null);
      try {
        const res = await apiClient.get("/subjects/");
        const data = res.data || [];
        setSubjects(data);
        if (data.length > 0) {
          setSubjectId(data[0].id);
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

  // ---------------- load topics theo subject ----------------
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
        const res = await apiClient.get("/topics/", {
          params: { subject_id: subjectId },
        });
        const data = res.data || [];
        setTopics(data);
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
        setTopicsError("Không thể tải danh sách chủ đề: " + msg);
      } finally {
        setIsLoadingTopics(false);
      }
    };

    fetchTopics();
  }, [subjectId]);

  // ---------------- handlers ----------------
  const handleGenerate = async () => {
    if (!subjectId) {
      setError("Vui lòng chọn môn học trước khi tạo đề.");
      return;
    }

    setIsLoading(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setError(null);

    try {
      const payload = {
        subject_id: subjectId,
        num_questions: Number.isNaN(Number(numQuestions)) ? 0 : Number(numQuestions),
        difficulty_tag: difficultyTag,
      };
      if (topicId !== null) {
        payload.topic_id = topicId;
      }

      const response = await generateFixedTest(payload);
      setQuestions(response.data?.questions || []);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Không rõ lỗi";
      setError("Lỗi khi tạo đề: " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionId, optionId) => {
    if (submitted) return; // khóa chọn sau khi đã nộp
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

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
      setResult(res.data);
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

  const noSubjects = !isLoadingSubjects && subjects.length === 0;
  const answeredCount = questions.filter((q) => !!answers[q.id]).length;
  const allAnswered = questions.length > 0 && questions.every((q) => !!answers[q.id]);
  const progressPct =
    questions.length > 0 ? Math.min(100, Math.round((answeredCount / questions.length) * 100)) : 0;

  // ---------------- render ----------------
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-xs text-violet-700 shadow-sm backdrop-blur dark:border-violet-900/40 dark:bg-slate-900/40 dark:text-violet-300">
              <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
              Fixed test
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Sinh Đề Cố Định
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Chọn môn, chủ đề, số câu hỏi và độ khó để tạo đề nhanh cho học sinh.
            </p>
          </div>

          {(questions.length > 0 || submitted || result) && (
            <button
              onClick={handleReset}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900"
              aria-label="Làm lại"
            >
              Làm lại
            </button>
          )}
        </header>

        {/* Controls Card */}
        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Môn học */}
            <div className="flex flex-col md:col-span-2">
              <label className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Môn học
              </label>
              {isLoadingSubjects ? (
                <div className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400">
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
                </div>
              ) : noSubjects ? (
                <div className="text-xs text-red-600 dark:text-red-400">
                  (Không có môn học nào trong hệ thống)
                </div>
              ) : (
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
                  value={subjectId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSubjectId(v ? Number(v) : null);
                  }}
                  disabled={isLoading}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.title || `Môn ${s.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Chủ đề */}
            <div className="flex flex-col md:col-span-2">
              <label className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Chủ đề
              </label>
              {isLoadingTopics && subjectId ? (
                <div className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400">
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
                </div>
              ) : topics.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  (Tất cả chủ đề của môn này)
                </div>
              ) : (
                <select
                  className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
                  value={topicId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTopicId(v === "" ? null : Number(v));
                  }}
                  disabled={isLoading}
                >
                  <option value="">Tất cả chủ đề (hệ thống tự chọn)</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `Chủ đề ${t.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Số câu */}
            <div className="flex flex-col">
              <label
                className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="num_questions"
              >
                Số câu
              </label>
              <input
                id="num_questions"
                type="number"
                min={1}
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
                placeholder="VD: 5"
              />
            </div>

            {/* Độ khó */}
            <div className="flex flex-col">
              <label
                className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300"
                htmlFor="difficulty_tag"
              >
                Độ khó
              </label>
              <select
                id="difficulty_tag"
                value={difficultyTag}
                onChange={(e) => setDifficultyTag(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white/90 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:ring-slate-800"
              >
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              * Bạn có thể cấu hình thêm các môn/chủ đề ở backend, UI sẽ tự động lấy từ API{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">/subjects</code> và{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">/topics</code>.
            </p>
            <button
              onClick={handleGenerate}
              disabled={isLoading || noSubjects || !subjectId}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
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

          {subjectsError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {subjectsError}
            </div>
          )}

          {topicsError && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {topicsError}
            </div>
          )}

          {error && (
            <div
              className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}
        </section>

        {/* Questions List */}
        {questions?.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Đề thi của bạn</h2>
              {/* progress answered */}
              <div className="w-48">
                <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Tiến độ</span>
                  <span>
                    {answeredCount}/{questions.length} ({progressPct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-[width] duration-300 ease-out"
                    style={{ width: `${progressPct}%` }}
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {questions.map((q, index) => (
                <article
                  key={q.id ?? `q-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Câu {index + 1}:
                    </div>
                    {answers[q.id] && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Đã chọn
                      </span>
                    )}
                  </div>

                  <QuestionDisplay
                    question={q}
                    selectedOptionId={answers[q.id]}
                    onAnswerSelect={(optionId) => handleAnswerSelect(q.id, optionId)}
                    disabled={submitted}
                  />
                </article>
              ))}
            </div>

            {/* Action bar */}
            <div className="sticky bottom-4 z-10 mt-6">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {answeredCount}/{questions.length} câu đã chọn
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered || submitted}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
                >
                  {submitted ? "Đã nộp" : "Nộp bài"}
                </button>
              </div>
            </div>

            {/* Kết quả sau khi nộp */}
            {submitted && result && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  Kết quả: <b>{result.correct}/{result.total}</b> câu đúng — Điểm:{" "}
                  <b>{result.score_10}</b>
                </div>

                {Array.isArray(result.detail) && result.detail.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Chi tiết từng câu:
                    </div>
                    <ul className="space-y-2">
                      {result.detail.map((d, i) => (
                        <li
                          key={d.question_id ?? `detail-${i}`}
                          className="text-sm text-slate-600 dark:text-slate-300"
                        >
                          Câu {i + 1}:{" "}
                          {d.is_correct ? (
                            <span className="font-medium text-emerald-700 dark:text-emerald-300">
                              Đúng
                            </span>
                          ) : (
                            <span className="font-medium text-red-600 dark:text-red-300">
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
          </section>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!questions || questions.length === 0) && (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/40">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Chưa có đề nào. Hãy chọn môn/chủ đề và nhấn{" "}
              <span className="font-medium text-slate-900 dark:text-white">Tạo Đề</span>.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

