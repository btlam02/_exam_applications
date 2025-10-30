import React from 'react';
import LoginForm from '../../components/LoginForm';

const LoginPage = () => {
  return (
    <div className='h-full w-full'>
    <div className="flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 shadow-md rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center mb-4">Đăng nhập</h2>
        <LoginForm />
      </div>
    </div>
    </div>
  );
};

export default LoginPage