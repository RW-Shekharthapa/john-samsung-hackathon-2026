const BASE = import.meta.env.BASE_URL + 'api'

export const session = {
  get token() { return localStorage.getItem('token') },
  set token(v) { v ? localStorage.setItem('token', v) : localStorage.removeItem('token') },
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, path, body) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(session.token ? { Authorization: 'Bearer ' + session.token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Network error. Please check your connection.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && session.token) onUnauthorized()
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  login: (b) => request('POST', '/auth/login', b),
  register: (b) => request('POST', '/auth/register', b),
  me: () => request('GET', '/auth/me'),
  logout: () => request('POST', '/auth/logout'),
  feed: (q) => request('GET', '/feed?' + new URLSearchParams(q)),
  listArticles: (search) => request('GET', '/articles' + (search ? '?search=' + encodeURIComponent(search) : '')),
  createArticle: (b) => request('POST', '/articles', b),
  updateArticle: (id, b) => request('PUT', '/articles/' + id, b),
  deleteArticle: (id) => request('DELETE', '/articles/' + id),
}
