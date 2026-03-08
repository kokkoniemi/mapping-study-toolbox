const API_ROOT = "http://localhost:3000/api/";
const REQUEST_TIMEOUT_MS = 10000;

const buildUrl = (path, params) => {
    const url = new URL(path, API_ROOT);
    if (!params) {
        return url.toString();
    }
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
            return;
        }
        url.searchParams.append(key, String(value));
    });
    return url.toString();
};

const parseResponse = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
};

const request = async (method, path, { params, data } = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(buildUrl(path, params), {
            method,
            headers: {
                Accept: "application/json",
                ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
            signal: controller.signal,
        });
        const payload = await parseResponse(response);
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status} for ${method} ${path}`);
            error.response = { status: response.status, data: payload };
            throw error;
        }
        return { data: payload, status: response.status };
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const http = {
    get: (path, { params } = {}) => request("GET", path, { params }),
    post: (path, data, { params } = {}) => request("POST", path, { params, data }),
    put: (path, data, { params } = {}) => request("PUT", path, { params, data }),
    delete: (path, { params } = {}) => request("DELETE", path, { params }),
};

export const records = {
    index: (params) => http.get("records", { params }),
    get: (id, params) => http.get(`records/${id}`, { params }),
    update: (id, data, params) => http.put(`records/${id}`, data, { params }),
    mappingOptions: {
        save: (id, data, params) => http.post(`records/${id}/mapping-options`, data, { params }),
        delete: (id, optionId, params) => http.delete(`records/${id}/mapping-options/${optionId}`, { params }),
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
        delete: (id, optionId, params) => http.delete(`mapping-questions/${id}/mapping-options/${optionId}`, { params }),
    },
};
