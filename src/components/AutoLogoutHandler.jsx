import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import { message } from "antd";
import {
  isSessionExpired,
  updateLastActivity,
  clearAuthSession,
  LOGOUT_EVENT_KEY,
} from "../utils/authUtils";

const AutoLogoutHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    // Không chạy kiểm tra nếu đang ở trang login hoặc reset password
    const publicPaths = ["/login", "/reset-password"];
    if (publicPaths.includes(location.pathname)) {
      isLoggingOutRef.current = false;
      return;
    }

    const token = Cookies.get("accessToken");
    if (!token) {
      return;
    }

    // Hàm thực hiện đăng xuất do hết hạn không hoạt động
    const performAutoLogout = () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      clearAuthSession();
      message.warning("Phiên làm việc đã hết hạn sau 5 phút không hoạt động. Vui lòng đăng nhập lại!");
      navigate("/login");
    };

    // Kiểm tra ngay khi mount hoặc khi chuyển trang
    if (isSessionExpired()) {
      performAutoLogout();
      return;
    }

    // Nếu vừa đăng nhập mà chưa có mốc thời gian, cập nhật ngay
    updateLastActivity(true);

    // Lắng nghe các tương tác của người dùng để cập nhật mốc hoạt động
    const handleUserActivity = () => {
      if (Cookies.get("accessToken")) {
        updateLastActivity();
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Lắng nghe sự kiện đa tab (nếu tab khác đăng xuất, tab này đăng xuất theo)
    const handleStorageChange = (e) => {
      if (e.key === LOGOUT_EVENT_KEY) {
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          clearAuthSession();
          navigate("/login");
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Lắng nghe khi người dùng quay lại tab trình duyệt
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (isSessionExpired()) {
          performAutoLogout();
        } else if (Cookies.get("accessToken")) {
          updateLastActivity(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Kiểm tra định kỳ mỗi 5 giây
    const intervalId = setInterval(() => {
      if (isSessionExpired()) {
        performAutoLogout();
      }
    }, 5000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [location.pathname, navigate]);

  return null;
};

export default AutoLogoutHandler;
