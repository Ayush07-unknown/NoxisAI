const envApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const isDev = process.env.NODE_ENV !== "production";

if (!envApiBaseUrl && !isDev) {
  throw new Error("❌ NEXT_PUBLIC_API_BASE_URL is missing in production");
}

export const CONFIG = {
  API_BASE_URL: envApiBaseUrl || "http://localhost:5000",
};
