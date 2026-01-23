// API Client for LARA Backend
// Handles all HTTP requests to the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lara-demo-production.up.railway.app';

// Token storage
const TOKEN_KEY = 'lara-auth-token';
const STUDENT_TOKEN_KEY = 'lara-student-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStudentToken(): string | null {
  return sessionStorage.getItem(STUDENT_TOKEN_KEY);
}

export function setStudentToken(token: string): void {
  sessionStorage.setItem(STUDENT_TOKEN_KEY, token);
}

export function clearStudentToken(): void {
  sessionStorage.removeItem(STUDENT_TOKEN_KEY);
}

// Generic fetch wrapper with auth
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  useStudentToken = false
): Promise<T> {
  const token = useStudentToken ? getStudentToken() : getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ==================== Auth API ====================

export interface TeacherResponse {
  id: string;
  email: string;
  name: string;
  tier: string;
  aiCallsUsed?: number;
  aiCallsLimit?: number;
  aiCallsRemaining?: number;
}

export interface AuthResponse {
  token: string;
  teacher: TeacherResponse;
}

export interface StudentJoinResponse {
  token: string;
  studentId: string;
  sessionId: string;
  task: {
    id: string;
    title: string;
    prompt: string;
    successCriteria: string[];
  };
}

export interface StudentRestoreResponse {
  token: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  status: string;
  task: {
    id: string;
    title: string;
    prompt: string;
    successCriteria: string[];
    status: 'active' | 'inactive';
  };
  feedbackReady: boolean;
  feedback?: FeedbackData;
  masteryConfirmed: boolean;
  submission?: {
    content: string;
    timestamp: number;
  };
}

export const authApi = {
  register: (email: string, password: string, name: string): Promise<AuthResponse> =>
    apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getProfile: (): Promise<TeacherResponse> =>
    apiFetch('/api/auth/me'),

  joinSession: (taskCode: string, studentName: string): Promise<StudentJoinResponse> =>
    apiFetch('/api/auth/session/join', {
      method: 'POST',
      body: JSON.stringify({ taskCode, studentName }),
    }),

  restoreSession: (studentId: string): Promise<StudentRestoreResponse> =>
    apiFetch(`/api/auth/session/restore/${studentId}`),
};

// ==================== Tasks API ====================

export interface TaskResponse {
  id: string;
  teacherId: string;
  title: string;
  prompt: string;
  taskCode: string;
  universalExpectations: boolean;
  successCriteria: string[];
  status: 'active' | 'inactive';
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  folder?: FolderResponse | null;
  _count?: { sessions: number };
  liveSessionId?: string | null;
}

export interface CreateTaskRequest {
  title: string;
  prompt: string;
  successCriteria: string[];
  universalExpectations?: boolean;
  folderId?: string | null;
}

export const tasksApi = {
  getAll: (): Promise<TaskResponse[]> =>
    apiFetch('/api/tasks'),

  getOne: (taskId: string): Promise<TaskResponse> =>
    apiFetch(`/api/tasks/${taskId}`),

  create: (data: CreateTaskRequest): Promise<TaskResponse> =>
    apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (taskId: string, data: Partial<CreateTaskRequest>): Promise<TaskResponse> =>
    apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (taskId: string, status: 'active' | 'inactive'): Promise<TaskResponse> =>
    apiFetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  moveToFolder: (taskId: string, folderId: string | null): Promise<TaskResponse> =>
    apiFetch(`/api/tasks/${taskId}/folder`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId }),
    }),

  delete: (taskId: string): Promise<void> =>
    apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' }),
};

// ==================== Folders API ====================

export interface FolderResponse {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

export const foldersApi = {
  getAll: (): Promise<FolderResponse[]> =>
    apiFetch('/api/folders'),

  create: (name: string, description?: string, color?: string): Promise<FolderResponse> =>
    apiFetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, description, color }),
    }),

  update: (folderId: string, name: string, description?: string, color?: string): Promise<FolderResponse> =>
    apiFetch(`/api/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, color }),
    }),

  delete: (folderId: string): Promise<void> =>
    apiFetch(`/api/folders/${folderId}`, { method: 'DELETE' }),
};

// ==================== Sessions API ====================

export interface StudentSessionData {
  id: string;
  name: string;
  joinedAt: number;
  status: string;
  submission?: StudentSubmission;
}

export interface StudentSubmission {
  studentId: string;
  content: string;
  timestamp: number;
  timeElapsed?: number;
  revisionCount: number;
  previousContent?: string;
  feedbackStatus: 'pending' | 'generated' | 'released';
  validationWarnings: string[];
  isRevision: boolean;
  feedback?: FeedbackData;
}

export interface FeedbackData {
  goal: string;
  masteryAchieved: boolean;
  strengths: Array<{
    id: string;
    type: 'task' | 'process' | 'self_reg';
    text: string;
    anchors: string[];
  }>;
  growthAreas: Array<{
    id: string;
    type: 'task' | 'process' | 'self_reg';
    text: string;
    anchors: string[];
  }>;
  nextSteps: Array<{
    id: string;
    actionVerb: string;
    target: string;
    successIndicator: string;
    ctaText: string;
    actionType: 'revise' | 'improve_section' | 'reupload' | 'rehearse';
  }>;
}

export interface DashboardResponse {
  session: {
    id: string;
    taskId: string;
    task: TaskResponse;
    startedAt: string | null;
    isLive: boolean;
  };
  students: StudentSessionData[];
  stats: {
    total: number;
    writing: number;
    readyForFeedback: number;
    generating: number;
    submitted: number;
    feedbackReady: number;
    revising: number;
    completed: number;
  };
  usage: {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface GenerateFeedbackResponse {
  generated: number;
  failed: number;
  results: Array<{ studentId: string; success: boolean; error?: string }>;
}

export interface StudentFeedbackResponse {
  status: string;
  feedbackReady: boolean;
  feedback?: FeedbackData;
  masteryConfirmed?: boolean;
  message?: string;
}

export const sessionsApi = {
  getDashboard: (sessionId: string): Promise<DashboardResponse> =>
    apiFetch(`/api/sessions/${sessionId}/dashboard`),

  submitWork: (sessionId: string, content: string, timeElapsed?: number): Promise<{ status: string; message: string }> =>
    apiFetch(`/api/sessions/${sessionId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ content, timeElapsed }),
    }, true), // Use student token

  generateFeedback: (sessionId: string, studentIds?: string[]): Promise<GenerateFeedbackResponse> =>
    apiFetch(`/api/sessions/${sessionId}/generate-feedback`, {
      method: 'POST',
      body: JSON.stringify({ studentIds }),
    }),

  approveFeedback: (sessionId: string, studentId: string, isMastered: boolean): Promise<{ approved: boolean }> =>
    apiFetch(`/api/sessions/${sessionId}/feedback/${studentId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ isMastered }),
    }),

  editFeedback: (sessionId: string, studentId: string, feedback: Partial<FeedbackData>): Promise<{ updated: boolean }> =>
    apiFetch(`/api/sessions/${sessionId}/feedback/${studentId}/edit`, {
      method: 'PATCH',
      body: JSON.stringify({ feedback }),
    }),

  getFeedback: (sessionId: string, studentId: string): Promise<StudentFeedbackResponse> =>
    apiFetch(`/api/sessions/${sessionId}/feedback/${studentId}`, {}, true), // Use student token

  getUsage: (): Promise<{ allowed: boolean; used: number; limit: number; remaining: number; resetDate?: string }> =>
    apiFetch('/api/sessions/usage'),
};

// Export API base URL for debugging
export { API_BASE_URL };
