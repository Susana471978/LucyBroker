const API_BASE_URL = 'http://127.0.0.1:8000'
const API_PREFIX = `${API_BASE_URL}/api`

function getAuthToken() {
  return localStorage.getItem('auth_token')
}

function clearAuthToken() {
  localStorage.removeItem('auth_token')
}

async function request(path, options = {}) {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken()
    }
    const message = data?.detail || data?.message || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data?.data ?? data
}

export async function login(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export async function getMe() {
  return request('/auth/me')
}

export async function getEmails() {
  return request('/emails')
}

export async function getStats() {
  return request('/emails/stats/summary')
}

export async function health() {
  const response = await fetch(`${API_BASE_URL}/health`)
  return response.json()
}

export function getStoredToken() {
  return getAuthToken()
}

export function clearStoredToken() {
  clearAuthToken()
}
