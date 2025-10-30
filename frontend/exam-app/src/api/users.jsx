import axios from "axios";

const API_URL = import.meta.env.VITE_APP_API_URL;

// Hàm trả về headers có chứa token
function getAuthHeader() {
  const token = localStorage.getItem("accessToken");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// Lấy danh sách tất cả người dùng
export async function fetchUsers() {
  try {
    const res = await axios.get(`${API_URL}/users/`, getAuthHeader());
    return res.data;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

// Tạo người dùng mới
export async function createUser(data) {
  try {
    const res = await axios.post(`${API_URL}/users/`, data, getAuthHeader());
    return res.data;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

// Cập nhật thông tin người dùng theo ID
export async function updateUser(id, data) {
  try {
    const res = await axios.put(`${API_URL}/users/${id}/`, data, getAuthHeader());
    return res.data;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

// Xóa người dùng theo ID
export async function deleteUserById(id) {
  try {
    await axios.delete(`${API_URL}/users/${id}/`, getAuthHeader());
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

// Lấy thông tin người dùng hiện tại (dựa vào access token)
export async function fetchCurrentUser() {
  try {
    const res = await axios.get(`${API_URL}/users/me/`, getAuthHeader());
    return res.data;
  } catch (error) {
    console.error("Error fetching current user:", error);
    throw error;
  }
}


