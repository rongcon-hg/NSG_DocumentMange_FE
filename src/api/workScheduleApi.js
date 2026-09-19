import axiosInstance from './axiosInstance';

export const getWorkSchedules = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const response = await axiosInstance.get(`/api/work-schedules${query ? `?${query}` : ''}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching work schedules:', error);
    throw error;
  }
};

export const getPendingWorkScheduleCount = async () => {
  try {
    const response = await axiosInstance.get('/api/work-schedules/pending-count');
    return response.data;
  } catch (error) {
    console.error('Error fetching pending work schedule count:', error);
    throw error;
  }
};

export const createWorkSchedule = async (data) => {
  try {
    const response = await axiosInstance.post('/api/work-schedules', data);
    return response.data;
  } catch (error) {
    console.error('Error creating work schedule:', error);
    throw error;
  }
};

export const updateWorkSchedule = async (id, data) => {
  try {
    const response = await axiosInstance.put(`/api/work-schedules/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating work schedule:', error);
    throw error;
  }
};

export const deleteWorkSchedule = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/work-schedules/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting work schedule:', error);
    throw error;
  }
};

export const approveWorkSchedule = async (id) => {
  try {
    const response = await axiosInstance.patch(`/api/work-schedules/${id}/approve`);
    return response.data;
  } catch (error) {
    console.error('Error approving work schedule:', error);
    throw error;
  }
};

export const rejectWorkSchedule = async (id, reason) => {
  try {
    const response = await axiosInstance.patch(`/api/work-schedules/${id}/reject`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error rejecting work schedule:', error);
    throw error;
  }
};
