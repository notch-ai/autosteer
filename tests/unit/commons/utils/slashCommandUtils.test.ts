import {
  convertSlashCommandFormat,
  isCustomSlashCommand,
} from '@/commons/utils/slash-commands/slash_command_utils';

describe('slashCommandUtils', () => {
  describe('convertSlashCommandFormat', () => {
    it('should convert colon-separated command to "run command" format', () => {
      expect(convertSlashCommandFormat('/engineering:write-docs')).toBe(
        'run command /engineering/write-docs'
      );
    });

    it('should convert colon-separated command without leading slash', () => {
      expect(convertSlashCommandFormat('engineering:write-docs')).toBe(
        'run command /engineering/write-docs'
      );
    });

    it('should handle nested namespaces with colons', () => {
      expect(convertSlashCommandFormat('/product:research:market')).toBe(
        'run command /product/research:market'
      );
    });

    it('should return built-in commands unchanged with leading slash', () => {
      expect(convertSlashCommandFormat('/compact')).toBe('/compact');
      expect(convertSlashCommandFormat('/clear')).toBe('/clear');
      expect(convertSlashCommandFormat('/help')).toBe('/help');
    });

    it('should add leading slash to built-in commands without it', () => {
      expect(convertSlashCommandFormat('compact')).toBe('/compact');
      expect(convertSlashCommandFormat('clear')).toBe('/clear');
    });

    it('should handle commands with multiple colons correctly', () => {
      expect(convertSlashCommandFormat('/context:write-prompt')).toBe(
        'run command /context/write-prompt'
      );
    });

    it('should handle empty string', () => {
      expect(convertSlashCommandFormat('')).toBe('/');
    });
  });

  describe('isCustomSlashCommand', () => {
    it('should return true for colon-separated commands', () => {
      expect(isCustomSlashCommand('/engineering:write-docs')).toBe(true);
      expect(isCustomSlashCommand('engineering:write-docs')).toBe(true);
    });

    it('should return false for built-in commands', () => {
      expect(isCustomSlashCommand('/compact')).toBe(false);
      expect(isCustomSlashCommand('/clear')).toBe(false);
      expect(isCustomSlashCommand('help')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isCustomSlashCommand('')).toBe(false);
    });

    it('should detect multiple colons as custom command', () => {
      expect(isCustomSlashCommand('/product:research:market')).toBe(true);
    });
  });
});
