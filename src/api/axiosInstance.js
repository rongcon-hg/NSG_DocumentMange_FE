import axios from "axios";
import Cookies from "js-cookie";
import { message } from "antd";
import { clearAuthSession } from "../utils/authUtils";

axios.defaults.withCredentials = true; // Cho phép gửi cookie với request

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8081",
  timeout: 600000,
});

// Interceptor để thêm token từ cookie vào header
axiosInstance.interceptors.request.use(
  (config) => {
    const token = Cookies.get("accessToken"); // Lấy token từ cookie
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor để xử lý lỗi 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      message.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");

      // Xóa session khi hết hạn
      clearAuthSession();

      // Chuyển hướng về trang đăng nhập
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
