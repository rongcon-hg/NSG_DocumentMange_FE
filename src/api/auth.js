import axios from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

axios.defaults.withCredentials = true; 

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8081";

import axiosInstance from './axiosInstance.js';


// Tạo người dùng mới
export const createUser = async (userData) => {
  try {
    const response = await axiosInstance.post(`/authen/createUser`, userData);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Hàm đăng nhập
export const loginRequest = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}/authen/signin`, { email, password }); 
    return response.data; 
  } catch (error) {
    throw error.response?.data?.message || "Đăng nhập thất bại!"; 
  }
};


export const requestResetPassword = async (email) => {
  try {
    const response = await axiosInstance.post(`${API_URL}/authen/reqResetPass`, { email });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to send reset password request';
  }
};

// Gửi yêu cầu xác nhận mã xác minh
export const verifyCode = async (email, code) => {
  try {
    const response = await axiosInstance.post(`${API_URL}/authen/verifyCode`, { email, code });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Invalid verification code';
  }
};

// Gửi yêu cầu đặt lại mật khẩu
export const resetPassword = async (email, newPassword) => {
  try {
    const response = await axiosInstance.post(`${API_URL}/authen/resetPassword`, { email, newPassword });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to reset password';
  }
};



// Lấy tất cả người dùng
export const getAllUsers = async () => {
  try {
    const response = await axiosInstance.get(`/authen/users`);
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};


export const getAllUsersCanSearchBanUser = async () => {
  try {
    const response = await axiosInstance.get(`/authen/users`);
    const data = response.data;

    // Filter out users with null role for staff/manager; keep admin as-is
    try {
      const token = Cookies.get("accessToken");
      if (token && data && Array.isArray(data.users)) {
        const decoded = jwtDecode(token);
        const requesterRole = decoded?.role;
        if (["staff", "manager", "cappho", "chuyenvien"].includes(requesterRole)) {
          const filteredUsers = data.users.filter((u) => u.role !== null);
          return { ...data, users: filteredUsers };
        }
      }
    } catch {
      // Silently ignore decode errors and return raw data
    }

    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};
//hàm lấy thông tin người dùng
export const getUserInfo = async (userId) => {
  try {
    const response = await axiosInstance.get(`/authen/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
};

// Cập nhật thông tin người dùng
export const updateUserInfo = async (userId, updatedData) => {
  try {
      const response = await axiosInstance.post(`/authen/update/${userId}`, updatedData);
      return response.data;
  } catch (error) {
      console.error('Error updating user info:', error);
      throw error.response?.data?.message || 'Failed to update user info';
  }
};


export const disableUser = async (userId) => {
  try {
    const response = await axiosInstance.put(`/authen/disableUser/${userId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Lỗi khi vô hiệu hóa người dùng");
  }
};

// Khôi phục người dùng
export const restoreUser = async (userId, role) => {
  try {
    const response = await axiosInstance.put(`/authen/restore/${userId}`, { role });
    return response.data;
  } catch (error) { 
    throw new Error(error.response?.data?.message || "Lỗi khi khôi phục người dùng");
  }
};

// Xóa người dùng
export const deleteUser = async (userId) => {
  try {
    const response = await axiosInstance.delete(`/authen/delete/${userId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Lỗi khi xóa người dùng!");
  }
};

// Lấy danh sách users theo departmentCode
export const getUsersByDepartmentCode = async (departmentCode) => {
  try {
    const response = await axiosInstance.get(`/authen/users`, {
      params: { departmentCode }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching users by department code:', error);
    throw error;
  }
};