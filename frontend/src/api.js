import axios from 'axios'

export const api = axios.create({
  // Use relative path; Vite proxy will forward in dev
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

export const CustomersAPI = {
  list: (params) => api.get('/customers', { params }).then(r => r.data),
  create: (payload) => api.post('/customers', payload).then(r => r.data),
  update: (id, payload) => api.put(`/customers/${id}`, payload).then(r => r.data),
  fixGeo: (id, lat, lng) => api.post(`/customers/${id}/fix-geo`, { latitude: lat, longitude: lng }).then(r => r.data),
  detail: (id) => api.get(`/customers/${id}/detail`).then(r => r.data),
}

export const EquipmentAPI = {
  list: (params) => api.get('/equipment', { params }).then(r => r.data),
  create: (payload) => api.post('/equipment', payload).then(r => r.data),
  update: (id, payload) => api.put(`/equipment/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/equipment/${id}`).then(r => r.data),
}

export const VisitsAPI = {
  list: (params) => api.get('/visits', { params }).then(r => r.data),
  create: (payload) => api.post('/visits', payload).then(r => r.data),
  myMissions: (overrides) => api.get('/visits/my_missions', { params: overrides }).then(r => r.data),
  detail: (id) => api.get(`/visits/${id}/detail`).then(r => r.data),
  start: (id, overrides) => api.post(`/visits/${id}/start`, null, { params: overrides }).then(r => r.data),
  logs: {
    list: (id) => api.get(`/visits/${id}/logs`).then(r => r.data),
    create: (id, payload) => api.post(`/visits/${id}/logs`, payload).then(r => r.data),
  },
  complete: (id, payload) => api.post(`/visits/${id}/complete`, payload).then(r => r.data),
  assign: (id, technicianId) => api.post(`/visits/${id}/assign`, { assigned_technician_id: technicianId }).then(r => r.data),
  office: {
    create: (payload) => api.post('/office/visits', payload).then(r => r.data),
    assign: (id, technicianId) => api.post(`/office/visits/${id}/assign`, { assigned_technician_id: technicianId }).then(r => r.data),
  }
}

export const ServiceLogsAPI = {
  list: (params) => api.get('/service-logs', { params }).then(r => r.data),
  create: (payload) => api.post('/service-logs', payload).then(r => r.data),
  update: (id, payload) => api.put(`/service-logs/${id}`, payload).then(r => r.data),
}

export const MapAPI = {
  customers: () => api.get('/map/customers').then(r => r.data),
}

export const AuthAPI = {
  login: (email) => api.post('/auth/login', { email }).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  whoami: () => api.get('/auth/whoami').then(r => r.data),
}

export const EmployeesAPI = {
  list: () => api.get('/employees').then(r => r.data),
  update: (id, payload) => api.put(`/employees/${id}`, payload).then(r => r.data),
}

export const EquipmentTypesAPI = {
  list: () => api.get('/equipment-types').then(r => r.data),
  create: (payload) => api.post('/equipment-types', payload).then(r => r.data),
  update: (id, payload) => api.put(`/equipment-types/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/equipment-types/${id}`).then(r => r.data),
}

export const MaterialsAPI = {
  list: (type, q) => api.get('/materials', { params: { type, q } }).then(r => r.data),
}

export const FeedbackAPI = {
  submit: (payload) => api.post('/feedback', payload).then(r => r.data),
  list: (tail) => api.get('/feedback', { params: { tail } }).then(r => r.data),
  detail: (id) => api.get(`/feedback/${id}`).then(r => r.data),
  update: (id, payload) => api.put(`/feedback/${id}`, payload).then(r => r.data),
}
