import axiosInstance from "./axiosInstance";

// ==========================================
// 1. Quản lý Phương tiện (Vehicles)
// ==========================================
export const getAllVehicles = (params) => {
  return axiosInstance.get("/vehicles/vehicles", { params });
};

export const createVehicle = (data) => {
  return axiosInstance.post("/vehicles/vehicles", data);
};

export const updateVehicle = (id, data) => {
  return axiosInstance.put(`/vehicles/vehicles/${id}`, data);
};

export const deleteVehicle = (id) => {
  return axiosInstance.delete(`/vehicles/vehicles/${id}`);
};

// ==========================================
// 2. Quản lý Tài xế (Drivers)
// ==========================================
export const getAllDrivers = (params) => {
  return axiosInstance.get("/vehicles/drivers", { params });
};

export const createDriver = (data) => {
  return axiosInstance.post("/vehicles/drivers", data);
};

export const updateDriver = (id, data) => {
  return axiosInstance.put(`/vehicles/drivers/${id}`, data);
};

export const deleteDriver = (id) => {
  return axiosInstance.delete(`/vehicles/drivers/${id}`);
};

// ==========================================
// 3. Đơn đăng ký & Điều xe công tác
// ==========================================
export const createVehicleBooking = (data) => {
  return axiosInstance.post("/vehicles/bookings", data);
};

export const getVehicleBookings = (params) => {
  return axiosInstance.get("/vehicles/bookings", { params });
};

export const getVehicleBookingById = (id) => {
  return axiosInstance.get(`/vehicles/bookings/${id}`);
};

// BGH phê duyệt hoặc từ chối
export const reviewVehicleBooking = (id, data) => {
  return axiosInstance.put(`/vehicles/bookings/${id}/review`, data);
};

// Đơn vị quản lý phân bổ xe & tài xế
export const dispatchVehicleBooking = (id, data) => {
  return axiosInstance.put(`/vehicles/bookings/${id}/dispatch`, data);
};

// Cập nhật trạng thái chuyến đi (Đang đi, hoàn thành)
export const updateTripStatus = (id, data) => {
  return axiosInstance.put(`/vehicles/bookings/${id}/trip-status`, data);
};

// Hủy đơn đăng ký
export const cancelVehicleBooking = (id) => {
  return axiosInstance.put(`/vehicles/bookings/${id}/cancel`);
};
