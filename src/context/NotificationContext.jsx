/* eslint-disable react/prop-types */
import { createContext, useState, useEffect, useCallback, useContext } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getDocumentsByUserAndType, getUnreadDocCount } from "../api/documentApi";
import { getStaffPendingReplyCount } from "../api/repliedDocApi";
import { getTasks } from "../api/taskApi";

const NotificationContext = createContext();

const getUserInfo = () => {
  const token = Cookies.get("accessToken");
  if (!token) return { role: null, userId: null };
  try {
    const decodedToken = jwtDecode(token);
    return { role: decodedToken.role, userId: decodedToken.userId };
  } catch (error) {
    console.error("Error decoding token in NotificationContext:", error);
    return { role: null, userId: null };
  }
};

export const NotificationProvider = ({ children }) => {
  const [unreadDocCount, setUnreadDocCount] = useState(0);
  const [pendingReplyCount, setPendingReplyCount] = useState(0);
  const [myPendingReplyCount, setMyPendingReplyCount] = useState(0);
  const [todoTaskCount, setTodoTaskCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({ role: null, userId: null });

  useEffect(() => {
    setUserInfo(getUserInfo());
  }, []);

  const fetchNotificationCounts = useCallback(async () => {
    const { role, userId } = userInfo;

    if (!userId || !role) {
      setUnreadDocCount(0);
      setPendingReplyCount(0);
      setMyPendingReplyCount(0);
      return;
    }

    setIsLoading(true);
    let fetchedUnreadCount = 0;
    let fetchedPendingCount = 0;
    let fetchedMyPendingCount = 0;
    let fetchedTodoTaskCount = 0;

    try {
    
        // Đếm văn bản chưa đọc bằng API tối ưu
        const unreadCountResponse = await getUnreadDocCount(userId);
        if (unreadCountResponse?.success) {
          fetchedUnreadCount = unreadCountResponse.count;
        }

        // Đếm pending + rejected cho staff
        fetchedMyPendingCount = await getStaffPendingReplyCount(userId);
        
        // Lấy số lượng task TODO
        try {
          const tasksRes = await getTasks(userId);
          if (tasksRes && tasksRes.success) {
            fetchedTodoTaskCount = tasksRes.data.filter(t => t.status === 'TODO').length;
          }
        } catch (e) {
          console.error("Error fetching tasks for context:", e);
        }
    
      

      setUnreadDocCount(fetchedUnreadCount);
      setPendingReplyCount(fetchedPendingCount);
      setMyPendingReplyCount(fetchedMyPendingCount);
      setTodoTaskCount(fetchedTodoTaskCount);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      setUnreadDocCount(0);
      setPendingReplyCount(0);
      setMyPendingReplyCount(0);
      setTodoTaskCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [userInfo]);

  useEffect(() => {
    if (userInfo.userId && userInfo.role) {
      fetchNotificationCounts(); // Gọi lần đầu
  
      // Polling mỗi 3 phút (180000ms) để tránh tràn CPU trên Vercel
      const interval = setInterval(() => {
        fetchNotificationCounts();
      }, 180000);
  
      // Cleanup interval
      return () => clearInterval(interval);
    } else {
      setUnreadDocCount(0);
      setPendingReplyCount(0);
      setMyPendingReplyCount(0);
      setTodoTaskCount(0);
    }
  }, [userInfo, fetchNotificationCounts]);

  const contextValue = {
    unreadDocCount,
    pendingReplyCount,
    myPendingReplyCount,
    todoTaskCount,
    isLoadingCounts: isLoading,
    refetchNotificationCounts: fetchNotificationCounts,
    userRole: userInfo.role,
    userId: userInfo.userId,
  };

  return <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>;
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
};