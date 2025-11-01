import { sessionNames } from '../constants/sessionNames';

const { adjectives, nouns } = sessionNames;

export function generateSessionName(existingNames: Set<string> = new Set()): string {
  const maxAttempts = 100;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const name = `${adjective} ${noun}`;

    if (!existingNames.has(name)) {
      return name;
    }
    attempts++;
  }

  return `${Date.now()}`;
}

export function getSessionInitials(sessionName: string): string {
  const parts = sessionName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return sessionName.substring(0, 2).toUpperCase();
}
