import axios from 'axios';

const API_ROOT = "http://localhost:3000/api/";

export const http = axios.create({
    baseURL: API_ROOT,
    timeout: 10000,
});

const handleError = (error) => {
    console.error(error);
    return Promise.reject(error);
};

http.interceptors.request.use(request => {
    return request;
}, handleError);

http.interceptors.response.use(response => {
    return response;
}, handleError);

export const records = {
    index: (params) => http.get("records", { params }),
    get: (id, params) => http.get(`records/${id}`, { params }),
    update: (id, data, params) => http.put(`records/${id}`, data, { params }),
    mappingOptions: {
        save: (id, data, params) => http.post(`records/${id}/mapping-options`, data, { params }),
        delete: (id, optionId, params) => http.delete(`records/${id}/mapping-options/${optionId}`, { params })
    },
};

export const mappingQuestions = {
    index: (params) => http.get("mapping-questions", { params }),
    save: (data, params) => http.post("mapping-questions", data, { params }),
    update: (id, data, params) => http.put(`mapping-questions/${id}`, data, { params }),
    delete: (id, params) => http.delete(`mapping-questions/${id}`, { params }),
    mappingOptions: {
        index: (id, params) => http.get(`mapping-questions/${id}/mapping-options`, { params }),
        save: (id, data, params) => http.post(`mapping-questions/${id}/mapping-options`, data, { params }),
        update: (id, optionId, data, params) => http.put(`mapping-questions/${id}/mapping-options/${optionId}`, data, { params }),
        delete: (id, optionId, params) => http.delete(`mapping-questions/${id}/mapping-options/${optionId}`, { params })
    }
}