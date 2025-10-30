import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const {access, role, refresh, res_email} = await loginUser(email, password);
      localStorage.setItem('accessToken', access);
      localStorage.setItem('role',role)
      localStorage.setItem('refreshToken', refresh);
      localStorage.setItem('email', res_email);

      navigate('/dashboard');
    } catch (err) {
      setError('Email hoặc mật khẩu không đúng.');
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        className="w-full border p-2 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className='relative'>
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder="Mật khẩu"
        className="w-full border p-2 rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required/>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-500"
        >
          {showPassword ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded">
        Đăng nhập
      </button>
      <p class="text-center text-sm font-light text-gray-500">
                      Chưa có tài khoản? <a href="/register" class="font-medium text-primary-600 hover:underline dark:text-primary-500">Đăng ký</a>
                  </p>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </form>
  );
};

export default LoginForm;
