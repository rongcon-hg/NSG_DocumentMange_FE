import Cookies from "js-cookie";

export const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 phút (300,000 ms)
export const LAST_ACTIVITY_KEY = "lastActivityTime";
export const LOGOUT_EVENT_KEY = "app_logout_event";

/**
 * Xóa sạch cookie và dữ liệu phiên làm việc
 */
export const clearAuthSession = () => {
  // Xóa cookie bằng js-cookie với các path phổ biến
  Cookies.remove("accessToken", { path: "/" });
  Cookies.remove("currentUser", { path: "/" });
  Cookies.remove("accessToken");
  Cookies.remove("currentUser");

  // Xóa bổ sung bằng document.cookie đảm bảo sạch
  document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
  document.cookie = "currentUser=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";

  // Xóa mốc thời gian hoạt động
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch (e) {
    // ignore
  }

  // Phát tín hiệu đăng xuất cho các tab khác
  try {
    localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString());
  } catch (e) {
    // ignore
  }
};

/**
 * Khởi tạo mốc hoạt động khi đăng nhập thành công
 */
export const recordLoginSession = () => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch (e) {
    // ignore
  }
};

/**
 * Lấy mốc thời gian hoạt động cuối cùng
 */
export const getLastActivity = () => {
  try {
    const val = localStorage.getItem(LAST_ACTIVITY_KEY);
    return val ? parseInt(val, 10) : null;
  } catch (e) {
    return null;
  }
};

let lastUpdateTime = 0;
/**
 * Cập nhật mốc thời gian hoạt động (throttled 2 giây để tối ưu hiệu năng)
 */
export const updateLastActivity = (force = false) => {
  const now = Date.now();
  if (force || now - lastUpdateTime >= 2000) {
    lastUpdateTime = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    } catch (e) {
      // ignore
    }
  }
};

/**
 * Kiểm tra xem phiên làm việc đã quá 5 phút không hoạt động hay chưa
 */
export const isSessionExpired = () => {
  const token = Cookies.get("accessToken");
  if (!token) return false;

  const lastActivity = getLastActivity();
  // Nếu có token nhưng chưa có mốc thời gian (ví dụ mới đăng nhập hoặc chuyển từ phiên cũ)
  if (!lastActivity) {
    return false;
  }

  return Date.now() - lastActivity >= INACTIVITY_TIMEOUT;
};
