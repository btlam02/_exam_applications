import math

def p_3pl(theta: float, a: float, b: float, c: float) -> float:
    # P(θ) = c + (1-c) / (1 + exp(-a(θ-b)))
    if a is None or b is None or c is None:
        return 0.5  # fallback khi chưa calibrate
    return c + (1 - c) / (1.0 + math.exp(-a * (theta - b)))

def fisher_info(theta: float, a: float, b: float, c: float) -> float:
    p = p_3pl(theta, a, b, c)
    q = 1 - p
    if p <= 1e-6 or q <= 1e-6 or a is None:
        return 0.0
    # xấp xỉ thông tin Fisher cho 3PL
    return (a**2) * ((p - c)**2) / ((1 - c)**2 * p * q)

def update_theta_newton(theta0: float, responses: list, max_iter=20) -> tuple[float, float]:
    """
    responses: list of dicts [{a,b,c,y}, ...], y in {0,1}
    Trả về (theta, se)
    """
    theta = max(min(theta0, 4.0), -4.0)
    for _ in range(max_iter):
        g = 0.0  # đạo hàm 1
        h = 0.0  # đạo hàm 2
        for r in responses:
            a, b, c, y = r["a"], r["b"], r["c"], r["y"]
            p = p_3pl(theta, a, b, c)
            q = 1 - p
            if p <= 1e-6 or q <= 1e-6: 
                continue
            d = (p - c) / (1 - c)
            dp = a * d * (1 - d)  # đạo hàm của p theo θ (xấp xỉ 3PL)
            g += (y - p) * (dp / (p * q))
            h -= (dp**2) * ((1/p) + (1/q))
        if abs(h) < 1e-8: break
        step = g / h
        theta = max(min(theta - step, 4.0), -4.0)
        if abs(step) < 1e-3: break

    # SE ≈ 1/sqrt(I(θ))
    info = sum(fisher_info(theta, r["a"], r["b"], r["c"]) for r in responses)
    se = (1.0 / math.sqrt(info)) if info > 1e-8 else 1.0
    return theta, se




