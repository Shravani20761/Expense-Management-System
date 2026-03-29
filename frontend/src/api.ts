// ─── API Client ───────────────────────────────────────────────────────────────
// All backend calls go through this file.
// Base URL proxied via Vite: /api → http://localhost:3000

const BASE = "/api";

// ─── Token helpers ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.message ?? JSON.stringify(err);
    } catch {}
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Backend Types ────────────────────────────────────────────────────────────

export type BackendRole = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type BackendExpenseStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export interface BackendUser {
  id: string;
  email: string;
  role: BackendRole;
  companyId: string;
  managerId?: string | null;
  isActive: boolean;
  mustChangePassword?: boolean;
  temporaryPassword?: string | null;
  createdAt: string;
}

export interface BackendMe extends BackendUser {
  profile?: {
    name?: string;
    department?: string;
    designation?: string;
    approvalLimit?: string;
    canManageUsers?: boolean;
    canManageWorkflows?: boolean;
  };
}

export interface BackendExpense {
  id: string;
  userId: string;
  companyId: string;
  amount: string;
  currency: string;
  amountCompanyCurrency?: string | null;
  category: string;
  description?: string | null;
  paidBy?: string | null;
  remarks?: string | null;
  receiptUrl?: string | null;
  expenseDate: string;
  status: BackendExpenseStatus;
  ocrData?: unknown;
  expenseLines?: unknown;
  createdAt: string;
}

export interface BackendCompany {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  mustChangePassword?: boolean;
}

export interface SignupResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

export function apiLogin(email: string, password: string) {
  return request<LoginResponse>("POST", "/auth/login", { email, password });
}

export function apiSignup(payload: {
  email: string;
  password: string;
  companyName: string;
  baseCurrency: string;
}) {
  return request<SignupResponse>("POST", "/auth/signup", payload);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function apiGetMe() {
  return request<BackendMe>("GET", "/users/me");
}

export function apiGetUsers() {
  return request<BackendUser[]>("GET", "/users");
}

export function apiCreateUser(payload: {
  name: string;
  email: string;
  role: BackendRole;
  managerId?: string;
}) {
  return request<{ id: string; email: string; role: string; rawPassword_temporary: string }>(
    "POST",
    "/users",
    payload
  );
}

export function apiUpdateUser(
  id: string,
  payload: { role?: BackendRole; managerId?: string | null; isActive?: boolean }
) {
  return request<BackendUser>("PUT", `/users/${id}`, payload);
}

export function apiGetUserProfile(id: string) {
  return request<BackendMe>("GET", `/users/${id}/profile`);
}

export function apiUpdateUserProfile(id: string, payload: Record<string, unknown>) {
  return request("PATCH", `/users/${id}/profile`, payload);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export function apiGetMyExpenses() {
  return request<BackendExpense[]>("GET", "/expenses");
}

export function apiGetAllExpenses() {
  return request<BackendExpense[]>("GET", "/expenses/all");
}

export function apiCreateExpense(payload: {
  amount: number;
  currency: string;
  category: string;
  description?: string;
  paidBy?: string;
  remarks?: string;
  receiptUrl?: string;
  isDraft?: boolean;
}) {
  return request<BackendExpense>("POST", "/expenses", payload);
}

export function apiApproveExpense(id: string, comment?: string) {
  return request<BackendExpense>("POST", `/expenses/${id}/approve`, { comment });
}

export function apiRejectExpense(id: string, comment?: string) {
  return request<BackendExpense>("POST", `/expenses/${id}/reject`, { comment });
}

// ─── Reimbursements ───────────────────────────────────────────────────────────

export function apiCreateReimbursement(payload: {
  expenseId: string;
  amountPaid: number;
  currency: string;
  paymentMethod: string;
  referenceNumber?: string;
}) {
  return request("POST", "/reimbursements", payload);
}

export function apiGetReimbursementByExpense(expenseId: string) {
  return request("GET", `/reimbursements/expense/${expenseId}`);
}

// ─── JWT Decode helper ────────────────────────────────────────────────────────
export function decodeToken(token: string): {
  sub: string;
  email: string;
  role: BackendRole;
  companyId: string;
} | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
