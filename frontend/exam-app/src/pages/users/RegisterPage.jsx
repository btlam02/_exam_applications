import React from 'react';
import RegisterForm from '../../components/RegisterForm.jsX';

const LoginPage = () => {
  return (
    <div className="flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 shadow-md rounded-lg w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center mb-4">Đăng ký</h2>
        <RegisterForm/>
      </div>
    </div>
  );
};

export default LoginPage

