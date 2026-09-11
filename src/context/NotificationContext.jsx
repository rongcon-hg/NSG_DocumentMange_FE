/* eslint-disable react/prop-types */
import { createContext, useState, useEffect, useCallback, useContext } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getDocumentsByUserAndType, getUnreadDocCount } from "../api/documentApi";
import { getStaffPendingReplyCount } from "../api/repliedDocApi";
import { getTasks } from "../api/taskApi";
import { getUserInfo as fetchUserInfoApi } from "../api/auth";
import { getEmulationPendingCount } from "../api/emulationApi";
import { 
  getMyNotifications, 
  markNotificationAsRead as apiMarkRead, 
  markAllNotificationsAsRead as apiMarkAllRead, 
  markNotificationsPopupShown 
} from "../api/notificationApi";
import { notification, Button } from "antd";

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
  const [inProgressTaskCount, setInProgressTaskCount] = useState(0);
  const [emulationCounts, setEmulationCounts] = useState({
    pendingForManager: 0,
    pendingForBGH: 0,
    rejectedForUser: 0,
    totalActionableCount: 0,
  });
  const [userNotifications, setUserNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem("user_avatar_url") || null);
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
    let fetchedInProgressTaskCount = 0;

    try {
    
        // Đếm văn bản chưa đọc bằng API tối ưu
        const unreadCountResponse = await getUnreadDocCount(userId);
        if (unreadCountResponse?.success) {
          fetchedUnreadCount = unreadCountResponse.count;
        }

        // Đếm pending + rejected cho staff
        fetchedMyPendingCount = await getStaffPendingReplyCount(userId);
        
        // Lấy số lượng task TODO và IN_PROGRESS
        try {
          const tasksRes = await getTasks(userId);
          if (tasksRes && tasksRes.success) {
            fetchedTodoTaskCount = tasksRes.data.filter(t => t.status === 'TODO').length;
            fetchedInProgressTaskCount = tasksRes.data.filter(t => t.status === 'IN_PROGRESS').length;
          }
        } catch (e) {
          console.error("Error fetching tasks for context:", e);
        }

        // Lấy số lượng hồ sơ đề nghị thi đua chờ xử lý
        try {
          const emuRes = await getEmulationPendingCount();
          if (emuRes && emuRes.success && emuRes.data) {
            setEmulationCounts(emuRes.data);
          }
        } catch (e) {
          console.error("Error fetching emulation counts for context:", e);
        }

        // Lấy thông báo hệ thống / việc con hoàn thành của người dùng
        try {
          const notifRes = await getMyNotifications({ limit: 20 });
          if (notifRes && notifRes.success) {
            const list = notifRes.data || [];
            setUserNotifications(list);
            setUnreadNotificationCount(notifRes.unreadCount || 0);

            // Tìm thông báo chưa đọc và chưa hiện popup
            const newPopups = list.filter(n => !n.isPopupShown && !n.isRead);
            if (newPopups.length > 0) {
              newPopups.forEach(item => {
                notification.success({
                  message: (
                    <span style={{ fontWeight: 600, color: "#059669" }}>
                      🎉 {item.title || "Công việc con đã hoàn thành"}
                    </span>
                  ),
                  description: (
                    <div style={{ fontSize: "13px", color: "#334155" }}>
                      <p style={{ margin: "4px 0 8px 0", lineHeight: 1.4 }}>{item.message}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        <Button
                          type="primary"
                          size="small"
                          style={{ backgroundColor: "#2563eb", fontSize: "12px", height: "26px" }}
                          onClick={() => {
                            apiMarkRead(item._id).catch(() => {});
                            setUserNotifications(prev => prev.map(n => n._id === item._id ? { ...n, isRead: true } : n));
                            setUnreadNotificationCount(prev => Math.max(0, prev - 1));
                            if (item.link) {
                              window.location.href = item.link;
                            }
                          }}
                        >
                          Xem chi tiết
                        </Button>
                      </div>
                    </div>
                  ),
                  placement: "topRight",
                  duration: 8,
                });
              });

              // Đánh dấu backend là đã hiển thị popup
              const ids = newPopups.map(n => n._id);
              markNotificationsPopupShown(ids).catch(e => console.error("Lỗi markNotificationsPopupShown:", e));
            }
          }
        } catch (e) {
          console.error("Error fetching user notifications in context:", e);
        }

    // Lấy thông tin avatar người dùng
    if (userInfo.userId) {
      try {
        const userRes = await fetchUserInfoApi(userInfo.userId);
        const userObj = userRes?.user || userRes?.data;
        if (userObj?.avatar?.fileId) {
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8081";
          const url = `${API_URL}/authen/avatar/${userObj.avatar.fileId}`;
          setAvatarUrl(url);
          localStorage.setItem("user_avatar_url", url);
        } else {
          setAvatarUrl(null);
          localStorage.removeItem("user_avatar_url");
        }
      } catch (e) {
        console.error("Error fetching avatar in context:", e);
      }
    }
    
    setUnreadDocCount(fetchedUnreadCount);
      setPendingReplyCount(fetchedPendingCount);
      setMyPendingReplyCount(fetchedMyPendingCount);
      setTodoTaskCount(fetchedTodoTaskCount);
      setInProgressTaskCount(fetchedInProgressTaskCount);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      setUnreadDocCount(0);
      setPendingReplyCount(0);
      setMyPendingReplyCount(0);
      setTodoTaskCount(0);
      setInProgressTaskCount(0);
      setEmulationCounts({
        pendingForManager: 0,
        pendingForBGH: 0,
        rejectedForUser: 0,
        totalActionableCount: 0,
      });
      setUserNotifications([]);
      setUnreadNotificationCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [userInfo]);

  useEffect(() => {
    if (userInfo.userId && userInfo.role) {
      fetchNotificationCounts(); // Gọi lần đầu
  
      // Polling mỗi 45 giây để cập nhật nhanh chóng thông báo
      const interval = setInterval(() => {
        fetchNotificationCounts();
      }, 45000);
  
      // Cleanup interval
      return () => clearInterval(interval);
    } else {
      setUnreadDocCount(0);
      setPendingReplyCount(0);
      setMyPendingReplyCount(0);
      setTodoTaskCount(0);
      setInProgressTaskCount(0);
      setEmulationCounts({
        pendingForManager: 0,
        pendingForBGH: 0,
        rejectedForUser: 0,
        totalActionableCount: 0,
      });
      setUserNotifications([]);
      setUnreadNotificationCount(0);
      setAvatarUrl(null);
      localStorage.removeItem("user_avatar_url");
    }
  }, [userInfo, fetchNotificationCounts]);

  const updateAvatar = useCallback((url) => {
    setAvatarUrl(url);
    if (url) {
      localStorage.setItem("user_avatar_url", url);
    } else {
      localStorage.removeItem("user_avatar_url");
    }
  }, []);

  const handleMarkAsRead = useCallback(async (id) => {
    try {
      await apiMarkRead(id);
      setUserNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error markNotificationAsRead in context:", err);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await apiMarkAllRead();
      setUserNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadNotificationCount(0);
    } catch (err) {
      console.error("Error markAllNotificationsAsRead in context:", err);
    }
  }, []);

  const contextValue = {
    unreadDocCount,
    pendingReplyCount,
    myPendingReplyCount,
    todoTaskCount,
    inProgressTaskCount,
    emulationCounts,
    userNotifications,
    unreadNotificationCount,
    markNotificationAsRead: handleMarkAsRead,
    markAllNotificationsAsRead: handleMarkAllAsRead,
    isLoadingCounts: isLoading,
    refetchNotificationCounts: fetchNotificationCounts,
    userRole: userInfo.role,
    userId: userInfo.userId,
    avatarUrl,
    setAvatarUrl: updateAvatar,
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