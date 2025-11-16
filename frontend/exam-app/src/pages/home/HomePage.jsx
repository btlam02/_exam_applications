// src/pages/HomePage.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-900/40 dark:bg-slate-900/40 dark:text-indigo-300">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
            phiên bản demo
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
            Hệ thống{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Sinh đề &amp; Chấm điểm
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
            Chọn hình thức kiểm tra để bắt đầu. Bạn có thể thử bản Test Thích
            Ứng (CAT) hoặc bản Demo cố định.
          </p>
        </div>

        {/* Cards */}
        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* CAT Card */}
          <Link
            to="/test/cat"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl hover:ring-2 hover:ring-indigo-200/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:hover:ring-indigo-800/50"
            aria-label="Làm bài Test Thích Ứng (CAT)"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {/* Icon: Target */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Test Thích Ứng (CAT)
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Câu hỏi điều chỉnh theo năng lực của bạn, rút ngắn thời gian
                    nhưng vẫn đảm bảo độ chính xác.
                  </p>
                </div>
              </div>
              <svg
                className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 10 10.293 6.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                IRT 3PL
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Thông minh
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Nhanh gọn
              </span>
            </div>

            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-indigo-100 opacity-60 blur-2xl dark:bg-indigo-900/30" />
          </Link>

          {/* Fixed Card */}
          <Link
            to="/test/fixed"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl hover:ring-2 hover:ring-violet-200/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:hover:ring-violet-800/50"
            aria-label="Làm bài Test Demo (Cố định)"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                  {/* Icon: Clipboard List */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6M9 16h6M9 8h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
                    />
                  </svg>
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Test Demo (Cố định)
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Bộ câu hỏi cố định để trải nghiệm nhanh luồng làm bài và
                    chấm điểm.
                  </p>
                </div>
              </div>
              <svg
                className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600 dark:group-hover:text-violet-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 10 10.293 6.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                Dễ thử
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                10–20 câu
              </span>
            </div>

            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-100 opacity-60 blur-2xl dark:bg-violet-900/30" />
          </Link>
        </section>

        {/* Note */}
        <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-400">
          <em>
            Lưu ý: API Admin (CRUD Câu hỏi) nên quản lý qua{" "}
            <span className="font-medium text-slate-700 underline decoration-dotted dark:text-slate-200">
              Django Admin
            </span>{" "}
            hoặc một trang Admin riêng biệt.
          </em>
        </p>
      </div>
    </main>
  );
}
