const API_BASE = "";

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: string;
}

export interface FormItem {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed";
  isDraft?: boolean;
  isPublished?: boolean;
  isAcceptingResponses?: boolean;
  formSettings?: any;
  isQuiz: boolean;
  responseCount: number;
  opensAt: string | null;
  closesAt: string | null;
  maxResponses: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormSection {
  id: string;
  formId?: string;
  orderIndex: number;
  title: string;
  description?: string;
}

export interface FormElement {
  id: string;
  sectionId: string;
  orderIndex: number;
  type:
    | "short_answer"
    | "paragraph"
    | "multiple_choice"
    | "checkboxes"
    | "dropdown"
    | "linear_scale"
    | "rating"
    | "mc_grid"
    | "checkbox_grid"
    | "file_upload"
    | "date"
    | "time"
    | "title_desc"
    | "image"
    | "video";
  title: string;
  description?: string;
  isRequired?: boolean;
  points?: number;
  options?: any;
  scaleSettings?: any;
  validation?: any;
  branchingLogic?: any;
  mediaUrl?: string;
  mediaMeta?: any;
  quizAnswerKey?: any;
}

import { authClient } from "./auth-client";

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, data?: any, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.code = code || (typeof data === "object" ? data?.code : undefined);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", // for session cookies
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg =
      (typeof data === "object" && (data?.message || data?.error?.message || data?.error)) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${res.status}`;
    const code =
      typeof data === "object" ? (data?.code || data?.error?.code) : undefined;
    throw new ApiError(errorMsg, res.status, data, code);
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    sendOtp: (email: string, name?: string, purpose: "signup" | "password_reset" = "signup") =>
      request<{ success: boolean; message: string; cooldownSeconds?: number }>("/api/auth/otp/send", {
        method: "POST",
        body: JSON.stringify({ email, name, purpose }),
      }),

    verifyOtp: (email: string, code: string, purpose: "signup" | "password_reset" = "signup") =>
      request<{ success: boolean; tempToken: string }>("/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, code, purpose }),
      }),

    setPassword: (email: string, tempToken: string, password: string, name: string) =>
      request<{ success: boolean; message: string; user: User }>("/api/auth/otp/set-password", {
        method: "POST",
        body: JSON.stringify({ email, tempToken, password, name }),
      }),

    resetPassword: (email: string, tempToken: string, password: string) =>
      request<{ success: boolean; message: string }>("/api/auth/otp/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, tempToken, password }),
      }),

    login: async (email: string, password: string) => {
      return request<{ user: User; session: any }>("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },

    logout: async () => {
      try {
        await authClient.signOut();
      } catch (err) {
        console.warn("authClient.signOut failed, falling back to direct sign-out request", err);
        await request<{ success: boolean }>("/api/auth/sign-out", {
          method: "POST",
        });
      }
      return { success: true };
    },

    getMe: () =>
      request<{
        user: User;
        session: any;
        stats: {
          totalForms: number;
          publishedForms: number;
          draftForms: number;
          closedForms: number;
        };
      }>("/api/auth/me"),
  },

  // Forms Management
  forms: {
    list: (params?: { status?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.search) q.set("search", params.search);
      return request<{
        forms: FormItem[];
        summary: {
          total: number;
          published: number;
          draft: number;
          closed: number;
          totalResponses: number;
        };
      }>(`/api/forms?${q.toString()}`);
    },

    create: (data: { title?: string; description?: string; isQuiz?: boolean; template?: string }) =>
      request<{ id: string; publicId: string; title: string; status?: string }>("/api/forms", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    get: (id: string) =>
      request<
        FormItem & {
          themeSettings: any;
          formSettings: any;
          quizSettings: any;
          sections: FormSection[];
          elements: FormElement[];
          responseCount: number;
        }
      >(`/api/forms/${id}`),

    update: (id: string, updates: Partial<FormItem> & { themeSettings?: any; formSettings?: any; quizSettings?: any }) =>
      request<{ success: boolean }>(`/api/forms/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      }),

    saveLayout: (
      id: string,
      payload: {
        sections: FormSection[];
        elements: FormElement[];
      }
    ) =>
      request<{ success: boolean }>(`/api/forms/${id}/layout`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),

    duplicate: (id: string) =>
      request<{ id: string; publicId: string; title: string }>(`/api/forms/${id}/duplicate`, {
        method: "POST",
      }),

    delete: (id: string) =>
      request<{ success: boolean }>(`/api/forms/${id}`, {
        method: "DELETE",
      }),

    publish: (id: string) =>
      request<{
        success: boolean;
        message: string;
        status: "published";
        publicId: string;
        publicUrl: string;
        acceptingResponses: boolean;
      }>(`/api/forms/${id}/publish`, {
        method: "POST",
      }),

    unpublish: (id: string) =>
      request<{ success: boolean; message: string; status: "draft" }>(`/api/forms/${id}/unpublish`, {
        method: "POST",
      }),

    toggleResponses: (id: string, acceptingResponses: boolean, closedMessage?: string) =>
      request<{ success: boolean; acceptingResponses: boolean; status: string; message: string }>(
        `/api/forms/${id}/toggle-responses`,
        {
          method: "POST",
          body: JSON.stringify({ acceptingResponses, closedMessage }),
        }
      ),
  },

  // Public Form Submissions
  public: {
    get: (publicId: string) =>
      request<{
        id: string;
        publicId: string;
        title: string;
        description: string;
        status: string;
        themeSettings: any;
        formSettings: any;
        isQuiz: boolean;
        quizSettings: any;
        isClosed: boolean;
        closedReason: string;
        alreadySubmitted: boolean;
        sections: FormSection[];
        elements: FormElement[];
        requiresAuth?: boolean;
        message?: string;
        currentUser?: User | null;
      }>(`/api/public/forms/${publicId}`),

    submit: (
      publicId: string,
      payload: {
        answers: Record<string, any>;
        respondentEmail?: string;
        submissionTrigger?: "manual" | "tab_switch_limit";
        tabSwitchCount?: number;
      }
    ) =>
      request<{
        success: boolean;
        message: string;
        responseId: string;
        isQuiz: boolean;
        submissionTrigger?: string;
        tabSwitchCount?: number;
        score?: {
          totalScore: number;
          maxScore: number;
          percentage: number;
        } | null;
        allowSubmitAnother: boolean;
      }>(`/api/public/forms/${publicId}/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  // Analytics & Responses
  analytics: {
    getResponses: (formId: string) =>
      request<{
        total: number;
        responses: Array<{
          id: string;
          formId: string;
          respondentEmail: string | null;
          submittedAt: string;
          totalScore: number | null;
          maxScore: number | null;
          status: string;
        }>;
      }>(`/api/forms/${formId}/responses`),

    getResponseDetail: (formId: string, responseId: string) =>
      request<{
        response: any;
        details: Array<{
          elementId: string;
          title: string;
          type: string;
          points: number;
          answer: any;
          isCorrect: boolean | null;
          scoreAwarded: number;
          feedback: string | null;
        }>;
      }>(`/api/forms/${formId}/responses/${responseId}`),

    gradeAnswer: (
      formId: string,
      responseId: string,
      payload: {
        elementId: string;
        scoreAwarded: number;
        feedback?: string;
        isCorrect?: boolean;
      }
    ) =>
      request<{ success: boolean; totalScore: number }>(
        `/api/forms/${formId}/responses/${responseId}/grade`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      ),

    getSummary: (formId: string) =>
      request<{
        totalResponses: number;
        questions: Array<{
          elementId: string;
          title: string;
          type: string;
          totalResponses: number;
          data: any;
        }>;
        quizSummary?: {
          totalGraded: number;
          averageScore: number;
          maxScore: number;
          scoreDistribution: number[];
        } | null;
      }>(`/api/forms/${formId}/analytics`),

    deleteResponse: (formId: string, responseId: string) =>
      request<{ success: boolean }>(`/api/forms/${formId}/responses/${responseId}`, {
        method: "DELETE",
      }),

    getExportCsvUrl: (formId: string) => `/api/forms/${formId}/export/csv`,
  },

  // Media Uploads
  media: {
    uploadForForm: (
      formId: string,
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<{
      success: boolean;
      url: string;
      publicId: string;
      provider: string;
      resourceType: "image" | "video";
      format?: string;
      bytes?: number;
      originalFilename?: string;
    }> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/forms/${formId}/upload`);
        xhr.withCredentials = true;

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || "Upload failed"));
            }
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during file upload"));

        const formData = new FormData();
        formData.append("file", file);
        xhr.send(formData);
      });
    },

    uploadGeneric: (
      file: File,
      onProgress?: (percent: number) => void
    ): Promise<{
      success: boolean;
      url: string;
      publicId: string;
      provider: string;
      resourceType: "image" | "video";
      format?: string;
      bytes?: number;
      originalFilename?: string;
    }> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/upload`);
        xhr.withCredentials = true;

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || "Upload failed"));
            }
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during file upload"));

        const formData = new FormData();
        formData.append("file", file);
        xhr.send(formData);
      });
    },

    getStatus: () =>
      request<{
        cloudinaryConfigured: boolean;
        provider: string;
        maxImageSizeMB: number;
        maxVideoSizeMB: number;
        supportedImageFormats: string[];
        supportedVideoFormats: string[];
      }>("/api/upload/status"),
  },
};
