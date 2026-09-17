export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "/api"
).replace(/\/$/, "");

export const CODE_SERVER_PUBLIC_URL = (
  import.meta.env.VITE_CODE_SERVER_PUBLIC_URL ||
  "/code"
).replace(/\/$/, "");

export const RESOURCES = {
  sessions: "api/sessions",
  tasks: "api/tasks",
} as const;
