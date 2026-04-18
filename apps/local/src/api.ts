import { useAuthStore } from './store';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { token, logout } = useAuthStore.getState();
  const headers = new Headers(init?.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set default content type for JSON if method is POST/PUT and body is a string
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, { ...init, headers });
  
  // If unauthorized, automatically log out
  if (response.status === 401 && token) {
     logout();
  }
  
  return response;
}
