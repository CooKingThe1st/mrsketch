export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL !== undefined) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window.location.port === '5173' || window.location.port === '3000')) {
    return 'http://127.0.0.1:8000';
  }
  return '';
};
