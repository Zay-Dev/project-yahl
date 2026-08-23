export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:4000"
).replace(/\/$/, "");

export const WIKI_PUBLIC_URL = (
  import.meta.env.VITE_WIKI_PUBLIC_URL ||
  "http://127.0.0.1:3001"
).replace(/\/$/, "");

export const CODE_SERVER_PUBLIC_URL = (
  import.meta.env.VITE_CODE_SERVER_PUBLIC_URL ||
  "http://127.0.0.1:8080"
).replace(/\/$/, "");

export const RESOURCES = {
  sessions: "api/sessions",
  tasks: "api/tasks",
} as const;
