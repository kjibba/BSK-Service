import axios from 'axios'

export const api = axios.create({
  // Use relative path; Vite proxy will forward in dev
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Global response error interceptor → emit a browser event the UI can toast
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    try {
      const status = error?.response?.status
      const url = error?.config?.url || 'ukjent'
      const detailMsg = error?.response?.data?.message || error?.message || 'Ukjent feil'
      // Only toast on real HTTP errors (not cancellations)
      if (!axios.isCancel(error)) {
        const variant = status >= 500 ? 'danger' : status >= 400 ? 'warning' : 'default'
        const title = status ? `Feil ${status}` : 'Feil'
        const description = `${title} ved ${url}: ${detailMsg}`
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { variant, title, description, timeout: 5000 } }))
      }
    } catch (_) { /* no-op */ }
    return Promise.reject(error)
  }
)

// JWT helper: set or clear Authorization header globally
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

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
  assignNearest: (id, opts) => api.post(`/equipment/${id}/assign_nearest`, opts || {}).then(r => r.data),
  assignNearestBatch: (opts) => api.post('/equipment/assign_nearest/batch', opts || {}).then(r => r.data),
  assignToCustomerByCoords: (targetCustomerId, opts) => api.post('/equipment/assign_to_customer_by_coords', { target_customer_id: targetCustomerId, ...(opts||{}) }).then(r => r.data),
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
  batchDelete: (ids) => api.post('/visits/batch_delete', { ids }).then(r => r.data),
  delete: (id) => api.delete(`/visits/${id}`).then(r => r.data),
  office: {
  list: (params) => api.get('/office/visits', { params }).then(r => r.data),
    create: (payload) => api.post('/office/visits', payload).then(r => r.data),
    assign: (id, technicianId) => api.post(`/office/visits/${id}/assign`, { assigned_technician_id: technicianId }).then(r => r.data),
  }
}

export const RouteChoicesAPI = {
  add: (customerId, selectedDate) => api.post('/route-choices', { customer_id: customerId, selected_date: selectedDate }).then(r => r.data),
  myToday: () => api.get('/route-choices/my_today').then(r => r.data),
  remove: (id) => api.delete(`/route-choices/${id}`).then(r => r.data),
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
  detail: (id) => api.get(`/employees/${id}`).then(r => r.data),
  create: (payload) => api.post('/employees', payload).then(r => r.data),
  update: (id, payload) => api.put(`/employees/${id}`, payload).then(r => r.data),
  delete: (id) => api.delete(`/employees/${id}`).then(r => r.data),
  stats: (id) => api.get(`/employees/${id}/stats`).then(r => r.data),
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

export const ReportsAPI = {
  listAll: () => api.get('/reports').then(r => r.data),
  byCustomer: (id) => api.get(`/reports/by_customer/${id}`).then(r => r.data),
}
