import axiosInstance from './axiosInstance';

export const getRecurringTasks = async (params = {}) => {
    try {
        const query = new URLSearchParams(params).toString();
        const response = await axiosInstance.get(`/api/recurring-tasks${query ? `?${query}` : ''}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching recurring tasks:', error);
        throw error;
    }
};

export const getRecurringTaskById = async (id) => {
    try {
        const response = await axiosInstance.get(`/api/recurring-tasks/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching recurring task by id:', error);
        throw error;
    }
};

export const createRecurringTask = async (data) => {
    try {
        const response = await axiosInstance.post('/api/recurring-tasks', data);
        return response.data;
    } catch (error) {
        console.error('Error creating recurring task:', error);
        throw error;
    }
};

export const updateRecurringTask = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/recurring-tasks/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating recurring task:', error);
        throw error;
    }
};

export const deleteRecurringTask = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/recurring-tasks/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting recurring task:', error);
        throw error;
    }
};

export const toggleRecurringTask = async (id) => {
    try {
        const response = await axiosInstance.patch(`/api/recurring-tasks/${id}/toggle`);
        return response.data;
    } catch (error) {
        console.error('Error toggling recurring task:', error);
        throw error;
    }
};

export const runRecurringTaskNow = async (id) => {
    try {
        const response = await axiosInstance.post(`/api/recurring-tasks/${id}/run-now`);
        return response.data;
    } catch (error) {
        console.error('Error running recurring task now:', error);
        throw error;
    }
};
