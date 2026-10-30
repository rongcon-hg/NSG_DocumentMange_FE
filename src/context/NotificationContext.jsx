/* eslint-disable react/prop-types */
import { createContext, useState, useEffect, useCallback, useContext } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getDocumentsByUserAndType, getUnreadDocCount } from "../api/documentApi";
import { getStaffPendingReplyCount } from "../api/repliedDocApi";
import { getTasks } from "../api/taskApi";
import { getUserInfo as fetchUserInfoApi } from "../api/auth";
import { getEmulationPendingCount } from "../api/emulationApi";
import { getTrainingPendingCount } from "../api/trainingApi";
import { getPendingRecordCount } from "../api/onlineRecordApi";
import { getPendingWorkScheduleCount } from "../api/workScheduleApi";
import { getVehiclePendingCounts } from "../api/vehicleApi";
import { 
  getMyNotifications, 
  markNotificationAsRead as apiMarkRead, 
  markAllNotificationsAsRead as apiMarkAllRead, 
  markNotificationsPopupShown 
} from "../api/notificationApi";
import { notification, Button } from "antd";
import dayjs from "dayjs";

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
  const [overdueTaskCount, setOverdueTaskCount] = useState(0);
  const [emulationCounts, setEmulationCounts] = useState({
    pendingForManager: 0,
    pendingForBGH: 0,
    rejectedForUser: 0,
    totalActionableCount: 0,
  });
  const [trainingPendingCount, setTrainingPendingCount] = useState(0);
  const [onlineRecordPendingCount, setOnlineRecordPendingCount] = useState(0);
  const [workSchedulePendingCount, setWorkSchedulePendingCount] = useState(0);
  const [vehiclePendingCount, setVehiclePendingCount] = useState(0);
  const [vehiclePendingDetails, setVehiclePendingDetails] = useState({
    total: 0,
    bghPendingCount: 0,
    dispatchPendingCount: 0,
    driverTripCount: 0,
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
    let fetchedOverdueTaskCount = 0;

    try {
        // Tối ưu hóa: Chạy song song các truy vấn đếm thông báo để giảm tối đa thời gian chờ của người dùng
        const [
          unreadCountResponse,
          staffPendingCount,
          tasksRes,
          emuRes,
          trainRes,
          recRes,
          wsRes,
          vehRes,
          notifRes,
          userRes
        ] = await Promise.all([
          getUnreadDocCount(userId).catch(e => { console.error(e); return null; }),
          getStaffPendingReplyCount(userId).catch(e => { console.error(e); return 0; }),
          getTasks(userId).catch(e => { console.error(e); return null; }),
          getEmulationPendingCount().catch(e => { console.error(e); return null; }),
          getTrainingPendingCount().catch(e => { console.error(e); return null; }),
          getPendingRecordCount().catch(e => { console.error(e); return null; }),
          getPendingWorkScheduleCount().catch(e => { console.error(e); return null; }),
          getVehiclePendingCounts().catch(e => { console.error(e); return null; }),
          getMyNotifications({ limit: 20, unreadOnly: "true" }).catch(e => { console.error(e); return null; }),
          userInfo.userId ? fetchUserInfoApi(userInfo.userId).catch(e => { console.error(e); return null; }) : Promise.resolve(null)
        ]);

        if (unreadCountResponse?.success) {
          fetchedUnreadCount = unreadCountResponse.count;
        }

        fetchedMyPendingCount = staffPendingCount || 0;

        if (tasksRes && tasksRes.success && Array.isArray(tasksRes.data)) {
          fetchedTodoTaskCount = tasksRes.data.filter(t => t.status === 'TODO').length;
          fetchedInProgressTaskCount = tasksRes.data.filter(t => t.status === 'IN_PROGRESS').length;
          const now = dayjs();
          fetchedOverdueTaskCount = tasksRes.data.filter(t => 
            t.status !== 'DONE' && t.endDate && dayjs(t.endDate).endOf('day').isBefore(now)
          ).length;
        }

        if (emuRes && emuRes.success && emuRes.data) {
          setEmulationCounts(emuRes.data);
        }

        if (trainRes && trainRes.success) {
          setTrainingPendingCount(trainRes.count ?? 0);
        }

        if (recRes && recRes.success) {
          setOnlineRecordPendingCount(recRes.count ?? 0);
        }

        if (wsRes && wsRes.success) {
          setWorkSchedulePendingCount(wsRes.data?.count || 0);
        } else {
          setWorkSchedulePendingCount(0);
        }

        if (vehRes?.data?.success && vehRes.data.data) {
          const vData = vehRes.data.data;
          setVehiclePendingCount(vData.total || 0);
          setVehiclePendingDetails(vData);
        } else {
          setVehiclePendingCount(0);
        }

        if (notifRes && notifRes.success) {
          const list = (notifRes.data || []).filter(n => !n.isRead);
          setUserNotifications(list);
          setUnreadNotificationCount(notifRes.unreadCount ?? list.length);

          // Tìm thông báo chưa đọc và chưa hiện popup
          const newPopups = list.filter(n => !n.isPopupShown && !n.isRead);
          if (newPopups.length > 0) {
            newPopups.forEach(notif => {
              notification.info({
                message: notif.title || "Thông báo công việc",
                description: (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-gray-700">{notif.message}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        {dayjs(notif.createdAt).format("HH:mm DD/MM/YYYY")}
                      </span>
                      <Button
                        type="link"
                        size="small"
                        className="p-0 text-blue-600 font-medium"
                        onClick={() => {
                          if (notif.link) {
                            window.location.href = notif.link;
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

        // Lấy thông tin avatar người dùng
        if (userRes) {
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
        }
    
    setUnreadDocCount(fetchedUnreadCount);
      setPendingReplyCount(fetchedPendingCount);
      setMyPendingReplyCount(fetchedMyPendingCount);
      setTodoTaskCount(fetchedTodoTaskCount);
      setInProgressTaskCount(fetchedInProgressTaskCount);
      setOverdueTaskCount(fetchedOverdueTaskCount);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      setUnreadDocCount(0);
      setPendingReplyCount(0);
      setMyPendingReplyCount(0);
      setTodoTaskCount(0);
      setInProgressTaskCount(0);
      setOverdueTaskCount(0);
      setEmulationCounts({
        pendingForManager: 0,
        pendingForBGH: 0,
        rejectedForUser: 0,
        totalActionableCount: 0,
      });
      setTrainingPendingCount(0);
      setOnlineRecordPendingCount(0);
      setWorkSchedulePendingCount(0);
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
      setOverdueTaskCount(0);
      setEmulationCounts({
        pendingForManager: 0,
        pendingForBGH: 0,
        rejectedForUser: 0,
        totalActionableCount: 0,
      });
      setTrainingPendingCount(0);
      setOnlineRecordPendingCount(0);
      setWorkSchedulePendingCount(0);
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
    setUserNotifications(prev => prev.filter(n => n._id !== id));
    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    try {
      await apiMarkRead(id);
    } catch (err) {
      console.error("Error markNotificationAsRead in context:", err);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await apiMarkAllRead();
      setUserNotifications([]);
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
    overdueTaskCount,
    emulationCounts,
    trainingPendingCount,
    onlineRecordPendingCount,
    workSchedulePendingCount,
    vehiclePendingCount,
    vehiclePendingDetails,
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