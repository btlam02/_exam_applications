// src/services/api.js
import axios from "axios";

// Đổi URL này thành URL backend Django của bạn
const API_BASE_URL = "http://127.0.0.1:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});


export const generateFixedTest = (payload) =>
  apiClient.post("/fixed-test/generate/", payload);

export const submitFixedTest = (payload) =>
  apiClient.post("/fixed-test/submit/", payload);

export const catStart = (payload) =>
  apiClient.post("/cat/start/", payload);

export const catAnswer = (payload) =>
  apiClient.post("/cat/answer/", payload);

export default apiClient;
