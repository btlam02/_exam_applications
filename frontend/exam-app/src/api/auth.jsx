import axios from 'axios';

const API_URL= import.meta.env.VITE_APP_API_URL;


export const loginUser = async (email, password) => {
  const res = await axios.post(`${API_URL}/users/login/`, {
    email,
    password,
  });
  const { 
          email: res_email ,
          role: role,
          access_token: access, 
          refresh_token: refresh,
          access_expires,
          refresh_expires} = res.data;
  return { access, role, refresh, res_email};
};

// api/auth.js
export const registerUser = async ({ email, password }) => {
  const response = await axios.post(`${API_URL}/users/register/`, {
    email,
    password,
  });
  return response.data;
};

export const logoutUser = async (refreshToken) => {
  await axios.post(`${API_URL}/users/logout/`, {
    refresh: refreshToken
  }, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`
    }
  });
};


