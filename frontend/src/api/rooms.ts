import type { ClientConfig } from "./config";

export type ParticipantSlot = "first" | "second";

export type ParticipantIdentity = {
  participantId: string;
  identityKey: string;
  slot: ParticipantSlot;
};

export type CreateRoomResponse = {
  roomId: string;
  shareableIdentifier: string;
  sharePath: string;
  creatorParticipant: ParticipantIdentity;
};

export type JoinRoomResponse = {
  roomId: string;
  shareableIdentifier: string;
  sharePath: string;
  participant: ParticipantIdentity;
  restoredIdentity: boolean;
};

type ApiErrorPayload = {
  error?: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function createRoom(config: ClientConfig): Promise<CreateRoomResponse> {
  const response = await fetch(`${config.backendBaseUrl}/api/rooms`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to create room");
  }

  return response.json() as Promise<CreateRoomResponse>;
}

export async function joinRoom(
  config: ClientConfig,
  roomId: string,
  identityKey?: string,
): Promise<JoinRoomResponse> {
  const response = await fetch(`${config.backendBaseUrl}/api/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identityKey }),
  });

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to join room");
  }

  return response.json() as Promise<JoinRoomResponse>;
}

async function createApiRequestError(response: Response, fallbackMessage: string): Promise<ApiRequestError> {
  let payload: ApiErrorPayload | undefined;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = undefined;
  }

  return new ApiRequestError(payload?.error ?? fallbackMessage, response.status, payload?.error);
}
