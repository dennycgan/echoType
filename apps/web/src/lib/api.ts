import type {
  AnnotationIssue,
  ContentIssue,
  CourseDTO,
  CourseMode,
  CreateCourseInput,
  CreateSessionInput,
  ModeIssue,
  SessionDTO,
  UpdateCourseInput,
} from '@echotype/shared';

const BASE = '/api';

export type CourseApiErrorCode =
  | 'annotation_validation_error'
  | 'content_validation_error'
  | 'mode_length_violation'
  | string;

export type CourseApiErrorBody = {
  error: CourseApiErrorCode;
  issues?: Array<AnnotationIssue | ContentIssue | ModeIssue>;
};

/** Structured API failure so the editor can branch on status + error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get courseBody(): CourseApiErrorBody | null {
    if (this.body && typeof this.body === 'object' && 'error' in this.body) {
      return this.body as CourseApiErrorBody;
    }
    return null;
  }
}

async function parseErrorBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, null, 'Network error. Check your connection and try again.');
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listCourses: (mode?: CourseMode) =>
    request<CourseDTO[]>(mode ? `/courses?mode=${mode}` : '/courses'),
  getCourse: (id: string) => request<CourseDTO>(`/courses/${id}`),
  createCourse: (input: CreateCourseInput) =>
    request<CourseDTO>('/courses', { method: 'POST', body: JSON.stringify(input) }),
  updateCourse: (id: string, input: UpdateCourseInput) =>
    request<CourseDTO>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCourse: (id: string) => request<void>(`/courses/${id}`, { method: 'DELETE' }),
  createSession: (input: CreateSessionInput) =>
    request<SessionDTO>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
  listSessions: (courseId?: string) =>
    request<SessionDTO[]>(`/sessions${courseId ? `?courseId=${courseId}` : ''}`),
};
