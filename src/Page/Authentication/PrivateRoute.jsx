/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React from "react";
import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";
import { isSessionExpired, clearAuthSession } from "../../utils/authUtils";

const PrivateRoute = ({ children }) => {
  const accessToken = Cookies.get("accessToken");

  if (accessToken) {
    if (isSessionExpired()) {
      clearAuthSession();
      return <Navigate to="/login" replace />;
    }
    return children;
  }

  return <Navigate to="/login" replace />;
};

export default PrivateRoute;
