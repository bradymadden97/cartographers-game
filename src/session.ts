const SESSION_ID_KEY = 'cartographers_session_id';
const SESSION_NAME_KEY = 'cartographers_player_name';

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function getSessionName(): string {
  return sessionStorage.getItem(SESSION_NAME_KEY) ?? '';
}

export function setSessionName(name: string): void {
  sessionStorage.setItem(SESSION_NAME_KEY, name);
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(SESSION_NAME_KEY);
}
