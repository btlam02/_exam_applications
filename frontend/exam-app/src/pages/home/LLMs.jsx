// src/pages/GenerateQuestionsPage.jsx
import React, { useEffect, useState } from "react";
import {
  fetchSubjects,
  fetchTopicsBySubject,
  generateQuestionsLLM,
} from "../../api/assessment";

export default function GenerateQuestionsPage() {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [targetDifficulty, setTargetDifficulty] = useState("Medium");
  const [numQuestions, setNumQuestions] = useState(5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await fetchSubjects();
        setSubjects(res.data || []);
        if (res.data?.length) {
          setSubjectId(res.data[0].id);
        }
      } catch (err) {
        setError("Không thể tải danh sách môn học.");
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    const loadTopics = async () => {
      try {
        const res = await fetchTopicsBySubject(subjectId);
        setTopics(res.data || []);
        if (res.data?.length) {
          setTopicId(res.data[0].id);
        }
      } catch (err) {
        setTopics([]);
      }
    };
    loadTopics();
  }, [subjectId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setCandidates([]);

    try {
      const res = await generateQuestionsLLM({
        subject_id: subjectId,
        topic_id: topicId,
        target_difficulty: targetDifficulty,
        num_questions: numQuestions,
      });
      setCandidates(res.data.items || []);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Không rõ lỗi";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-8 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-white">
          Sinh câu hỏi bằng LLM (Gemini + DeepSeek)
        </h1>

        {/* Form cấu hình */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Môn học
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Chủ đề
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Độ khó mong muốn
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={targetDifficulty}
                onChange={(e) => setTargetDifficulty(e.target.value)}
              >
                <option value="Easy">Dễ</option>
                <option value="Medium">Trung bình</option>
                <option value="Hard">Khó</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Số câu hỏi
              </label>
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !subjectId || !topicId}
            className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Đang sinh câu hỏi..." : "Sinh câu hỏi"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">Lỗi: {error}</p>
          )}
        </section>

        {/* Kết quả candidate + chỉ số định lượng */}
        {candidates.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              Kết quả: {candidates.length} câu hỏi được sinh
            </h2>
            <div className="space-y-3 max-h-[520px] overflow-auto pr-2">
              {candidates.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    {c.stem}
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

                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Đáp án đúng:{" "}
                    <span className="font-semibold">{c.correct_answer}</span>
                  </div>

                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                    <div>
                      <div>Độ khó (Gemini): {c.difficulty_score_gemini?.toFixed?.(2)} ({c.difficulty_label_gemini})</div>
                      <div>Độ khó (DeepSeek): {c.difficulty_score_deepseek?.toFixed?.(2)} ({c.difficulty_label_deepseek})</div>
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

                  <div className="mt-1 text-xs">
                    Trạng thái:{" "}
                    <span
                      className={
                        c.status === "accepted"
                          ? "text-emerald-600"
                          : c.status === "rejected"
                          ? "text-red-600"
                          : "text-amber-600"
                      }
                    >
                      {c.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
