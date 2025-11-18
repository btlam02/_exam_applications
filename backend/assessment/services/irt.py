import math


def p_3pl(theta: float, a: float, b: float, c: float) -> float:
    """
    Xác suất trả lời đúng theo mô hình 3PL:
    P(θ) = c + (1 - c) * logistic(a(θ - b))
    """
    if a is None or b is None or c is None:
        return 0.5  # fallback khi chưa calibrate

    # Dùng logistic ổn định hơn, tránh overflow
    z = a * (theta - b)
    if z > 20:
        L = 1.0
    elif z < -20:
        L = 0.0
    else:
        L = 1.0 / (1.0 + math.exp(-z))

    return c + (1.0 - c) * L


def fisher_info(theta: float, a: float, b: float, c: float) -> float:
    """
    Thông tin Fisher xấp xỉ cho 3PL (dùng trong chọn câu tối ưu).
    """
    if a is None or b is None or c is None:
        return 0.0

    p = p_3pl(theta, a, b, c)
    q = 1.0 - p
    if p <= 1e-6 or q <= 1e-6:
        return 0.0

    # d = L = (p - c)/(1-c)
    if (1.0 - c) <= 1e-6:
        return 0.0
    d = (p - c) / (1.0 - c)

    # dp/dθ = (1 - c) * a * d * (1 - d)
    dp = (1.0 - c) * a * d * (1.0 - d)

    # I(θ) = (dp^2) / (p * q)
    return (dp * dp) / (p * q)


def update_theta_newton(
    theta0: float,
    responses: list,
    max_iter: int = 25,
    prior_var: float | None = 1.0,
) -> tuple[float, float]:
    """
    Newton-Raphson để ước lượng θ (MLE hoặc MAP).

    responses: list các dict [{a,b,c,y}, ...], y in {0,1}
      - a,b,c: tham số IRT của câu
      - y: 1 nếu đúng, 0 nếu sai

    prior_var:
      - None  -> MLE (không prior)
      - >0    -> MAP với prior N(0, prior_var)

    Trả về:
      - theta: ước lượng năng lực
      - se: sai số chuẩn ≈ 1 / sqrt(I(θ))
    """
    # Khởi tạo θ trong khoảng hợp lý
    theta = max(min(theta0, 4.0), -4.0)

    if not responses:
        return theta, 1.0

    for _ in range(max_iter):
        g = 0.0  # đạo hàm bậc 1 của log-likelihood
        h = 0.0  # đạo hàm bậc 2

        for r in responses:
            a, b, c, y = r["a"], r["b"], r["c"], r["y"]
            if a is None or b is None or c is None:
                continue

            p = p_3pl(theta, a, b, c)
            q = 1.0 - p
            if p <= 1e-6 or q <= 1e-6:
                continue

            if (1.0 - c) <= 1e-6:
                continue

            # L = (p - c)/(1-c)
            L = (p - c) / (1.0 - c)

            # dp/dθ = (1 - c) * a * L * (1 - L)
            dp = (1.0 - c) * a * L * (1.0 - L)

            # dℓ/dθ = Σ (y - p) * dp / (p * q)
            g += (y - p) * (dp / (p * q))

            # d²ℓ/dθ² ≈ - Σ (dp^2) * (1/p + 1/q)
            h -= (dp * dp) * ((1.0 / p) + (1.0 / q))

        # Thêm prior N(0, prior_var) nếu có (MAP)
        if prior_var is not None and prior_var > 0:
            # log prior ∝ -θ^2 / (2σ^2) -> d/dθ = -θ/σ^2, d²/dθ² = -1/σ^2
            g -= theta / prior_var
            h -= 1.0 / prior_var

        if abs(h) < 1e-8:
            break  # tránh chia cho 0

        step = g / h

        # Clip bước nhảy để tránh nhảy quá mạnh -> dính biên
        if step > 1.0:
            step = 1.0
        elif step < -1.0:
            step = -1.0

        theta_new = theta - step
        # Giữ trong [-4, 4] nhưng chỉ kẹp nhẹ ở ngoài
        theta = max(min(theta_new, 4.0), -4.0)

        if abs(step) < 1e-3:
            break

    # Tính SE từ Fisher info tại θ đã hội tụ
    info = 0.0
    for r in responses:
        a, b, c = r["a"], r["b"], r["c"]
        if a is None or b is None or c is None:
            continue
        info += fisher_info(theta, a, b, c)

    if prior_var is not None and prior_var > 0:
        # Info posterior = I(θ) + 1/σ^2 (đơn giản hóa)
        info += 1.0 / prior_var

    se = (1.0 / math.sqrt(info)) if info > 1e-8 else 1.0
    return theta, se
