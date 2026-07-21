import type { ClientConfig } from "./config";
import type { CreativeThemeId } from "../theme";

export type ParticipantSlot = "first" | "second";

export type ParticipantIdentity = {
  participantId: string;
  identityKey: string;
  slot: ParticipantSlot;
  lastUsedThemeId: CreativeThemeId;
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

export type ThemePreferenceResponse = {
  participantId: string;
  themeId: CreativeThemeId;
  updatedAt: string;
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

export async function getThemePreference(
  config: ClientConfig,
  roomId: string,
  participant: ParticipantIdentity,
): Promise<ThemePreferenceResponse> {
  const response = await fetch(
    `${config.backendBaseUrl}/api/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(
      participant.participantId,
    )}/theme-preference`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Participant-Identity-Key": participant.identityKey,
      },
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to read theme preference");
  }

  return response.json() as Promise<ThemePreferenceResponse>;
}

export async function updateThemePreference(
  config: ClientConfig,
  roomId: string,
  participant: ParticipantIdentity,
  themeId: CreativeThemeId,
): Promise<ThemePreferenceResponse> {
  const response = await fetch(
    `${config.backendBaseUrl}/api/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(
      participant.participantId,
    )}/theme-preference`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identityKey: participant.identityKey,
        themeId,
      }),
    },
  );

  if (!response.ok) {
    throw await createApiRequestError(response, "Unable to save theme preference");
  }

  return response.json() as Promise<ThemePreferenceResponse>;
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
