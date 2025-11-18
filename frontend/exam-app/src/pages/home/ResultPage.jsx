// src/pages/ResultsPage.jsx
import React from "react";
import { useLocation, Link } from "react-router-dom";

function interpretTheta(theta) {
  if (theta === null || theta === undefined || Number.isNaN(theta)) {
    return {
      label: "Chưa xác định",
      badgeClass: "bg-slate-100 text-slate-700",
      desc: "Chưa đủ dữ liệu câu hỏi để ước lượng năng lực cho chủ đề này.",
    };
  }

  if (theta <= -0.5) {
    return {
      label: "Cần cố gắng",
      badgeClass: "bg-rose-100 text-rose-700",
      desc: "Bạn còn gặp khó khăn với các câu hỏi thuộc chủ đề này. Nên ôn tập lại các kiến thức nền tảng.",
    };
  }

  if (theta <= 0.5) {
    return {
      label: "Mức cơ bản",
      badgeClass: "bg-amber-100 text-amber-700",
      desc: "Bạn đã nắm được các ý chính ở mức cơ bản, nhưng vẫn còn khoảng trống cần củng cố.",
    };
  }

  if (theta <= 1.5) {
    return {
      label: "Khá",
      badgeClass: "bg-emerald-100 text-emerald-700",
      desc: "Bạn xử lý khá tốt các câu hỏi chủ đề này, chỉ còn một số câu khó cần luyện thêm.",
    };
  }

  return {
    label: "Thành thạo",
    badgeClass: "bg-indigo-100 text-indigo-700",
    desc: "Bạn đang làm rất tốt ở chủ đề này, có thể thử thêm những bài nâng cao hơn.",
  };
}

function ResultsPage() {
  const location = useLocation();
  const results = location.state?.results;

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-6 text-center">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Không có dữ liệu kết quả
          </h2>
          <p className="text-slate-500 mb-4">
            Có vẻ như bạn truy cập trang này mà chưa hoàn thành bài test.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            ⬅ Quay về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const abilities = Object.entries(results.ability_vector || {});

  // Có thể có thêm các trường như tổng số câu, số câu đã làm, v.v. (nếu backend trả về)
  const totalItems = results.total_items || results.total_questions;
  const totalAnswered = results.total_answered;
  const method = results.method || "IRT + CAT";

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              🎉 Hoàn thành bài kiểm tra!
            </h1>
            <p className="mt-2 text-slate-600">
              Dưới đây là kết quả ước lượng năng lực của bạn theo mô hình{" "}
              <span className="font-semibold">IRT</span> và hình thức{" "}
              <span className="font-semibold">CAT (Computerized Adaptive Testing)</span>.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
            <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            <span>Phương pháp: {method}</span>
          </div>
        </header>

        {/* Tóm tắt nhanh */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white shadow-sm p-4 border border-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Trạng thái
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              Bài test đã hoàn thành
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Hệ thống đã tự động dừng test khi đã đủ thông tin để ước lượng
              tương đối ổn định năng lực của bạn.
            </p>
          </div>

          <div className="rounded-2xl bg-white shadow-sm p-4 border border-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Số câu hỏi
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {totalItems ?? "—"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Tổng số câu đã sử dụng trong quá trình ước lượng. Mỗi câu được
              chọn sao cho phù hợp với mức độ hiện tại của bạn (CAT).
            </p>
          </div>

          <div className="rounded-2xl bg-white shadow-sm p-4 border border-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Câu trả lời
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {totalAnswered ?? totalItems ?? "—"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Số câu bạn đã trả lời. Câu trả lời đúng/sai được dùng để cập nhật
              tham số năng lực (theta).
            </p>
          </div>
        </section>

        {/* Giải thích IRT & CAT */}
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">
            IRT & CAT là gì?
          </h2>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              🔹 <strong>IRT (Item Response Theory)</strong> là mô hình thống kê dùng
              để ước lượng <strong>năng lực tiềm ẩn</strong> của người học (gọi là{" "}
              <code>theta</code>), dựa trên cách bạn trả lời các câu hỏi có mức độ khó
              khác nhau.
            </p>
            <p>
              🔹 <strong>CAT (Computerized Adaptive Testing)</strong> là hình thức
              kiểm tra thích ứng trên máy tính: hệ thống sẽ{" "}
              <strong>chọn câu hỏi tiếp theo</strong> dựa trên kết quả các câu bạn đã
              làm, sao cho phù hợp nhất với mức năng lực hiện tại của bạn.
            </p>
            <p>
              Nói ngắn gọn: thay vì cho bạn làm một đề cố định, hệ thống vừa
              “đo” năng lực, vừa “chọn” câu hỏi phù hợp để việc đánh giá nhanh
              và chính xác hơn.
            </p>
          </div>
        </section>

        {/* Legend cho theta */}
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            Cách đọc chỉ số năng lực (Theta)
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Mỗi chủ đề sẽ có một giá trị <code>theta</code>. Giá trị càng cao thì năng
            lực ước lượng ở chủ đề đó càng tốt. Bảng dưới là gợi ý cách hiểu:
          </p>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
              <p className="font-semibold text-rose-700 mb-1">Cần cố gắng</p>
              <p className="text-rose-700/80">Theta ≤ -0.5</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="font-semibold text-amber-700 mb-1">Mức cơ bản</p>
              <p className="text-amber-700/80">-0.5 &lt; Theta ≤ 0.5</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="font-semibold text-emerald-700 mb-1">Khá</p>
              <p className="text-emerald-700/80">0.5 &lt; Theta ≤ 1.5</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="font-semibold text-indigo-700 mb-1">Thành thạo</p>
              <p className="text-indigo-700/80">Theta &gt; 1.5</p>
            </div>
          </div>
        </section>

        {/* Kết quả theo từng chủ đề */}
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">
              Năng lực theo từng chủ đề
            </h2>
            <span className="text-xs text-slate-400">
              Giá trị hiển thị: Theta ước lượng cuối cùng
            </span>
          </div>

          {abilities.length > 0 ? (
            <div className="space-y-3">
              {abilities.map(([topicId, theta]) => {
                const t = typeof theta === "number" ? theta : null;
                const { label, badgeClass, desc } = interpretTheta(t);
                return (
                  <div
                    key={topicId}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Chủ đề: <span className="font-mono">{topicId}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Theta:{" "}
                        <span className="font-mono">
                          {t !== null ? t.toFixed(4) : "—"}
                        </span>
                      </p>
                    </div>

                    <div className="flex-1 md:px-4">
                      <p className="text-xs text-slate-600">{desc}</p>
                    </div>

                    <div className="flex justify-end">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium " +
                          badgeClass
                        }
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Không có dữ liệu năng lực theo chủ đề.
            </p>
          )}
        </section>

        {/* Debug JSON (tùy chọn) */}
        <section className="rounded-2xl bg-slate-900/95 text-slate-50 p-5 text-xs overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Dữ liệu thô từ backend</h3>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Dành cho developer / debug
            </span>
          </div>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(results, null, 2)}
          </pre>
        </section>

        {/* CTA */}
        <div className="flex justify-between items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            🔁 Làm bài test khác
          </Link>
          <p className="text-xs text-slate-500">
            Gợi ý: bạn có thể chụp màn hình kết quả này để lưu lại quá trình
            tiến bộ của mình.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResultsPage;
