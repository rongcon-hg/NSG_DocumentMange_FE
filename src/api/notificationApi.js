import axiosInstance from "./axiosInstance";

/**
 * Lấy danh sách thông báo của người dùng
 */
export const getMyNotifications = async (params = {}) => {
  const res = await axiosInstance.get("/notifications/my", { params });
  return res.data;
};

/**
 * Lấy số lượng thông báo chưa đọc
 */
export const getUnreadNotificationCount = async () => {
  const res = await axiosInstance.get("/notifications/unread-count");
  return res.data;
};

/**
 * Đánh dấu thông báo là đã đọc
 */
export const markNotificationAsRead = async (id) => {
  const res = await axiosInstance.patch(`/notifications/${id}/read`);
  return res.data;
};

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export const markAllNotificationsAsRead = async () => {
  const res = await axiosInstance.patch("/notifications/mark-all-read");
  return res.data;
};

/**
 * Đánh dấu các thông báo đã hiển thị popup
 */
export const markNotificationsPopupShown = async (ids) => {
  const res = await axiosInstance.patch("/notifications/popup-shown", { ids });
  return res.data;
};
