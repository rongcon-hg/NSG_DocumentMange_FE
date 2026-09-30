/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { Navigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import { isSessionExpired, clearAuthSession } from "../../utils/authUtils";

const PrivateRoute = ({ children }) => {
  const location = useLocation();
  const accessToken = Cookies.get("accessToken");

  // Cho phép truy cập trực tiếp phòng họp qua quét mã QR mà không cần đăng nhập
  const isMeetingRoom = /^\/meetings\/[a-zA-Z0-9_-]+$/.test(location.pathname);

  if (accessToken) {
    if (isSessionExpired()) {
      clearAuthSession();
      if (isMeetingRoom) return children;
      return <Navigate to="/login" replace />;
    }
    return children;
  }

  if (isMeetingRoom) {
    return children;
  }

  return <Navigate to="/login" replace />;
};

export default PrivateRoute;
