export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_BASE_URL?: string;
      API_HOST?: string;
      API_PORT?: string;
    }
  }
}
