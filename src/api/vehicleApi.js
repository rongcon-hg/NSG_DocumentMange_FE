import axiosInstance from "./axiosInstance";

// ==========================================
// 1. Quản lý Phương tiện (Vehicles)
// ==========================================
export const getAllVehicles = (params) => {
  return axiosInstance.get("/api/vehicles/vehicles", { params });
};

export const createVehicle = (data) => {
  return axiosInstance.post("/api/vehicles/vehicles", data);
};

export const updateVehicle = (id, data) => {
  return axiosInstance.put(`/api/vehicles/vehicles/${id}`, data);
};

export const deleteVehicle = (id) => {
  return axiosInstance.delete(`/api/vehicles/vehicles/${id}`);
};

// ==========================================
// 2. Quản lý Tài xế (Drivers)
// ==========================================
export const getAllDrivers = (params) => {
  return axiosInstance.get("/api/vehicles/drivers", { params });
};

export const createDriver = (data) => {
  return axiosInstance.post("/api/vehicles/drivers", data);
};

export const updateDriver = (id, data) => {
  return axiosInstance.put(`/api/vehicles/drivers/${id}`, data);
};

export const deleteDriver = (id) => {
  return axiosInstance.delete(`/api/vehicles/drivers/${id}`);
};

// ==========================================
// 3. Đơn đăng ký & Điều xe công tác
// ==========================================
export const createVehicleBooking = (data) => {
  return axiosInstance.post("/api/vehicles/bookings", data);
};

export const getVehicleBookings = (params) => {
  return axiosInstance.get("/api/vehicles/bookings", { params });
};

// Thống kê & Phân tích dữ liệu điều xe
export const getVehicleStats = (params) => {
  return axiosInstance.get("/api/vehicles/bookings/stats", { params });
};

export const getVehicleBookingById = (id) => {
  return axiosInstance.get(`/api/vehicles/bookings/${id}`);
};

// Chỉnh sửa đơn đăng ký xe khi BGH chưa duyệt
export const updateVehicleBooking = (id, data) => {
  return axiosInstance.put(`/api/vehicles/bookings/${id}`, data);
};

// BGH phê duyệt hoặc từ chối
export const reviewVehicleBooking = (id, data) => {
  return axiosInstance.put(`/api/vehicles/bookings/${id}/review`, data);
};

// Đơn vị quản lý phân bổ xe & tài xế
export const dispatchVehicleBooking = (id, data) => {
  return axiosInstance.put(`/api/vehicles/bookings/${id}/dispatch`, data);
};

// Cập nhật trạng thái chuyến đi (Đang đi, hoàn thành)
export const updateTripStatus = (id, data) => {
  return axiosInstance.put(`/api/vehicles/bookings/${id}/trip-status`, data);
};

// Hủy đơn đăng ký
export const cancelVehicleBooking = (id) => {
  return axiosInstance.put(`/api/vehicles/bookings/${id}/cancel`);
};

// Xóa hoàn toàn đơn đăng ký (Dành cho Admin/Manager)
export const deleteVehicleBooking = (id) => {
  return axiosInstance.delete(`/api/vehicles/bookings/${id}`);
};

// Lấy số lượng thông báo / việc cần xử lý điều xe
export const getVehiclePendingCounts = () => {
  return axiosInstance.get("/api/vehicles/bookings/pending-count");
};

// Kiểm tra trùng lịch của tài xế và xe trong khung giờ
export const checkDispatchConflictsApi = (params) => {
  return axiosInstance.get("/api/vehicles/bookings/dispatch-conflicts", { params });
};

// ==========================================
// 4. Định vị, Tính khoảng cách & Tối ưu lộ trình (Routing)
// ==========================================

// Tính toán khoảng cách và thời gian di chuyển qua các điểm
export const calculateRouteApi = (data) => {
  return axiosInstance.post("/api/vehicles/routing/calculate", data);
};

// Tối ưu hóa thứ tự các điểm dừng ngắn nhất (TSP)
export const optimizeRouteApi = (data) => {
  return axiosInstance.post("/api/vehicles/routing/optimize", data);
};

// Gợi ý địa chỉ và tọa độ (Geocoding)
export const geocodeAddressApi = (keyword) => {
  return axiosInstance.get("/api/vehicles/routing/geocode", { params: { q: keyword } });
};
