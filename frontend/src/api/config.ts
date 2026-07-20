export type ClientConfig = {
  backendBaseUrl: string;
  wsBaseUrl: string;
};

const normalizeHttpBaseUrl = (rawValue: string | undefined): string => {
  if (rawValue?.trim()) {
    return rawValue.replace(/\/+$/, "");
  }

  return window.location.origin;
};

const normalizeWebSocketBaseUrl = (rawValue: string | undefined, backendBaseUrl: string): string => {
  if (rawValue?.trim()) {
    return rawValue.replace(/\/+$/, "");
  }

  const backendUrl = new URL(backendBaseUrl);
  backendUrl.protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
  return backendUrl.toString().replace(/\/+$/, "");
};

export const getClientConfig = (): ClientConfig => {
  const backendBaseUrl = normalizeHttpBaseUrl(import.meta.env.VITE_BACKEND_BASE_URL);
  const wsBaseUrl = normalizeWebSocketBaseUrl(import.meta.env.VITE_WS_BASE_URL, backendBaseUrl);

  return {
    backendBaseUrl,
    wsBaseUrl,
  };
};
