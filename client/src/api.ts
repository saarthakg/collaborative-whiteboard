import type { Canvas, Shape, User } from "./types";

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export async function signup(username: string, email: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  return data.access_token;
}

export async function login(email: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

export async function getMe(): Promise<User> {
  return request<User>("/me");
}

// Canvases
export async function listCanvases(): Promise<Canvas[]> {
  return request<Canvas[]>("/canvases");
}

export async function createCanvas(name: string): Promise<Canvas> {
  return request<Canvas>("/canvases", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getCanvas(id: string): Promise<Canvas> {
  return request<Canvas>(`/canvases/${id}`);
}

export async function inviteToCanvas(canvasId: string, identifier: string): Promise<void> {
  await request(`/canvases/${canvasId}/invite`, {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

// Shapes
export async function getShapes(canvasId: string): Promise<Shape[]> {
  return request<Shape[]>(`/canvases/${canvasId}/shapes`);
}
