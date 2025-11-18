// src/pages/CandidateQuestionsReviewPage.jsx
import React, { useEffect, useState } from "react";
import {
  fetchCandidateQuestions,
  approveCandidateQuestion,
  rejectCandidateQuestion,
  fetchSubjects,
} from "../../api/assessment";

export default function CandidateQuestionsReviewPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await fetchSubjects();
        setSubjects(res.data || []);
      } catch (err) {
        // ignore
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadCandidates = async () => {
      setError(null);
      try {
        const params = {};
        if (statusFilter) params.status = statusFilter;
        if (subjectId) params.subject_id = subjectId;
        const res = await fetchCandidateQuestions(params);
        setItems(res.data || []);
      } catch (err) {
        const msg = err?.response?.data?.detail || err.message || "Không rõ lỗi";
        setError(msg);
      }
    };
    loadCandidates();
  }, [statusFilter, subjectId, refreshKey]);

  const handleApprove = async (id) => {
    try {
      await approveCandidateQuestion(id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      // bạn có thể thêm toast
      console.error(err);
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectCandidateQuestion(id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">
          Duyệt câu hỏi sinh tự động
        </h1>

        <section className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <div>
            <label className="mr-2 font-medium text-slate-700 dark:text-slate-200">
              Trạng thái:
            </label>
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="mr-2 font-medium text-slate-700 dark:text-slate-200">
              Môn:
            </label>
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Tất cả</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {items.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Không có candidate nào.
            </p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-auto pr-2">
              {items.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase text-slate-500 dark:text-slate-400">
                        {c.subject?.name} · {c.topic?.name}
                      </div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">
                        {c.stem}
                      </div>
                    </div>
                    <span
                      className={
                        "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold " +
                        (c.status === "accepted"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : c.status === "rejected"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200")
                      }
                    >
                      {c.status}
                    </span>
                  </div>

                  <ul className="mt-1 ml-4 list-disc text-slate-700 dark:text-slate-200">
                    {c.options_json.map((opt, idx) => (
                      <li key={idx}>
                        <span className="font-semibold">
                          {String.fromCharCode(65 + idx)}.
                        </span>{" "}
                        {opt}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Đáp án đúng: <strong>{c.correct_answer}</strong> · Target:{" "}
                    {c.target_difficulty}
                  </div>

                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                    <div>
                      <div>
                        Độ khó (Gemini):{" "}
                        {c.difficulty_score_gemini?.toFixed?.(2)} (
                        {c.difficulty_label_gemini})
                      </div>
                      <div>
                        Độ khó (DeepSeek):{" "}
                        {c.difficulty_score_deepseek?.toFixed?.(2)} (
                        {c.difficulty_label_deepseek})
                      </div>
                      <div>Overall score: {c.overall_score?.toFixed?.(2)}</div>
                    </div>
                    <div>
                      <div>Validity: {c.validity?.toFixed?.(2)}</div>
                      <div>On-topic: {c.on_topic?.toFixed?.(2)}</div>
                      <div>Clarity: {c.clarity?.toFixed?.(2)}</div>
                      <div>Single correct: {c.single_correct?.toFixed?.(2)}</div>
                      <div>Similarity: {c.similarity_to_examples?.toFixed?.(2)}</div>
                    </div>
                  </div>

                  {c.comment && (
                    <p className="mt-2 text-xs italic text-slate-600 dark:text-slate-300">
                      Nhận xét: {c.comment}
                    </p>
                  )}

                  {/* nút duyệt */}
                  {c.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleApprove(c.id)}
                        className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                      >
                        Chấp nhận & đưa vào CSDL
                      </button>
                      <button
                        onClick={() => handleReject(c.id)}
                        className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
