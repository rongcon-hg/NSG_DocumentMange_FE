import axiosInstance from './axiosInstance';

export const getTasks = async (userId) => {
    try {
        const response = await axiosInstance.get(`/tasks${userId ? `?userId=${userId}` : ''}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching tasks', error);
        throw error;
    }
};

export const createTask = async (taskData) => {
    try {
        const isFormData = taskData instanceof FormData;
        const response = await axiosInstance.post(`/tasks`, taskData, {
            headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
        });
        return response.data;
    } catch (error) {
        console.error('Error creating task', error);
        throw error;
    }
};

export const updateTask = async (taskId, updates) => {
    try {
        const isFormData = updates instanceof FormData;
        const response = await axiosInstance.put(`/tasks/${taskId}`, updates, {
            headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
        });
        return response.data;
    } catch (error) {
        console.error('Error updating task', error);
        throw error;
    }
};

export const deleteTask = async (taskId) => {
    try {
        const response = await axiosInstance.delete(`/tasks/${taskId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting task', error);
        throw error;
    }
};

export const evaluateTask = async (taskId, data) => {
    try {
        const response = await axiosInstance.patch(`/tasks/${taskId}/evaluate`, data);
        return response.data;
    } catch (error) {
        console.error('Error evaluating task', error);
        throw error;
    }
};

export const getKpiStats = async (params = {}) => {
    try {
        const query = new URLSearchParams();
        if (params.month) query.append('month', params.month);
        if (params.year) query.append('year', params.year);
        if (params.departmentId) query.append('departmentId', params.departmentId);
        if (params.userId) query.append('userId', params.userId);

        const queryString = query.toString();
        const response = await axiosInstance.get(`/tasks/kpi/stats${queryString ? `?${queryString}` : ''}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching KPI stats', error);
        throw error;
    }
};

