import React, { useState } from 'react';
import { registerUser } from '../api/auth';
import { useNavigate } from 'react-router-dom';

const RegisterForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();


  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Mật khẩu không khớp!');
      return;
    }

    try {
      await registerUser({ email, password });
      setMessage('Đăng ký thành công!');
      navigate('/login')

    } catch (err) {
      setMessage((err.response?.data?.error_message || 'Lỗi không xác định'));
    }
  };

  return (
    <form onSubmit={handleRegister} className="p-4 max-w-md mx-auto space-y-4">
      <input
        type="email"
        className="w-full border p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <div className='relative'>
      <input
        type={showPassword ? 'text' : 'password'}
        className="w-full border p-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu"
        required
      />
      <button type = "button" 
              onClick={()=> setShowPassword(!showPassword)} 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-500"
      >
      {showPassword ? 'Ẩn': 'Hiện'}
      </button>
      </div>
      <div className='relative'> 
      <input
        type={showConfirmPassword ? 'text' : 'password'}
        className="w-full border p-2"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Nhập lại mật khẩu"
        required
      />
      <button type = "button" 
              onClick={()=> setShowConfirmPassword(!showConfirmPassword)} 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-500"
      >
      {showConfirmPassword ? 'Ẩn': 'Hiện'}
      </button>
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded">
        Đăng ký
      </button>
      <p class="text-center text-sm font-light text-gray-500 dark:text-gray-400">
                      Đã có tài khoản? <a href="/login" class="font-medium text-primary-600 hover:underline dark:text-primary-500">Đăng nhập</a>
                  </p>
      {message && <p className="text-sm text-center text-red-500">{message}</p>}


    </form>
  );
};

export default RegisterForm;
