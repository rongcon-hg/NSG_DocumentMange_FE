import { loginStart, loginSuccess, loginFailed } from './authSlice';
import axiosInstance from "../api/axiosInstance";
import { recordLoginSession, clearAuthSession } from "../utils/authUtils";

export const login = (email, password) => async (dispatch) => {
  dispatch(loginStart());
  try {
    // Gửi yêu cầu đăng nhập với email
    const response = await axiosInstance.post('/authen/signin', { email, password });

    const { name, accessToken } = response.data;
    // Lưu token vào cookie
    document.cookie = `accessToken=${accessToken}; path=/; max-age=${4 * 60 * 60}; Secure`;
    document.cookie = `currentUser=${encodeURIComponent(name)}; path=/; max-age=${4 * 60 * 60}; Secure`;

    // Ghi nhận mốc thời gian hoạt động ban đầu
    recordLoginSession();

    // Gửi dữ liệu đăng nhập thành công
    dispatch(loginSuccess({ name, accessToken }));
  } catch (error) {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại!";

    // Nếu token hết hạn (401/403), xóa session và chuyển hướng về trang đăng nhập
    if (status === 403 || status === 401) {
      clearAuthSession();

      window.location.reload();
      window.location.href = "/login";
    }

    dispatch(loginFailed(errorMessage));
    throw new Error(errorMessage);
  }
};
