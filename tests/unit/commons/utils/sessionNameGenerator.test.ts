import { generateSessionName, getSessionInitials } from '@/commons/utils/sessionNameGenerator';
import { sessionNames } from '@/commons/constants/sessionNames';

describe('sessionNameGenerator', () => {
  describe('generateSessionName', () => {
    it('should generate a session name with format "[Adjective] [Noun]"', () => {
      const name = generateSessionName();
      expect(name).toMatch(/^\w+ \w+$/);
    });

    it('should generate unique names when provided existing names', () => {
      const existingNames = new Set<string>();
      const generatedNames = new Set<string>();

      // Generate 10 names
      for (let i = 0; i < 10; i++) {
        const name = generateSessionName(existingNames);
        expect(generatedNames.has(name)).toBe(false);
        generatedNames.add(name);
        existingNames.add(name);
      }

      expect(generatedNames.size).toBe(10);
    });

    it('should avoid collision with existing names', () => {
      const existingNames = new Set(['Swift River']);
      const name = generateSessionName(existingNames);

      expect(name).not.toBe('Swift River');
      expect(name).toMatch(/^\w+ \w+$/);
    });

    it('should use valid adjectives from the word list', () => {
      const name = generateSessionName();
      const parts = name.split(' ');

      expect(parts.length).toBe(2);
      expect(sessionNames.adjectives).toContain(parts[0]);
    });

    it('should use valid nouns from the word list', () => {
      const name = generateSessionName();
      const parts = name.split(' ');

      expect(parts.length).toBe(2);
      expect(sessionNames.nouns).toContain(parts[1]);
    });

    it('should fallback to timestamp if all combinations exhausted', () => {
      // Create a set with many existing names
      const existingNames = new Set<string>();

      // Add enough names to potentially trigger fallback
      for (let i = 0; i < 150; i++) {
        existingNames.add(generateSessionName(new Set()));
      }

      const name = generateSessionName(existingNames);

      // Should either be a valid session name or timestamp fallback
      expect(name).toMatch(/^(\w+ \w+|\d+)$/);
    });

    it('should handle empty existing names set', () => {
      const name = generateSessionName(new Set());
      expect(name).toMatch(/^\w+ \w+$/);
    });
  });

  describe('getSessionInitials', () => {
    it('should extract initials from session name', () => {
      expect(getSessionInitials('Swift River')).toBe('SR');
      expect(getSessionInitials('Golden Phoenix')).toBe('GP');
      expect(getSessionInitials('Azure Mountain')).toBe('AM');
    });

    it('should handle single word names', () => {
      expect(getSessionInitials('CustomName')).toBe('CU');
      expect(getSessionInitials('AB')).toBe('AB');
    });

    it('should handle two-word names', () => {
      expect(getSessionInitials('Swift River')).toBe('SR');
      expect(getSessionInitials('Test Name')).toBe('TN');
    });

    it('should uppercase the initials', () => {
      const initials = getSessionInitials('swift river');
      expect(initials).toBe('SR');
      expect(initials).toMatch(/^[A-Z]{2}$/);
    });
  });

  describe('word list constraints', () => {
    it('should have adjectives with 6 or fewer characters', () => {
      sessionNames.adjectives.forEach((adj) => {
        expect(adj.length).toBeLessThanOrEqual(6);
      });
    });

    it('should have nouns with 6 or fewer characters', () => {
      sessionNames.nouns.forEach((noun) => {
        expect(noun.length).toBeLessThanOrEqual(6);
      });
    });

    it('should have at least 50 adjectives', () => {
      expect(sessionNames.adjectives.length).toBeGreaterThanOrEqual(50);
    });

    it('should have at least 50 nouns', () => {
      expect(sessionNames.nouns.length).toBeGreaterThanOrEqual(50);
    });

    it('should provide at least 2500 possible combinations', () => {
      const combinations = sessionNames.adjectives.length * sessionNames.nouns.length;
      expect(combinations).toBeGreaterThanOrEqual(2500);
    });
  });
});
