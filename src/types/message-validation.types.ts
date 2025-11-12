/**
 * Message validation types for corrupt message handling
 */

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  field: string;
  message: string;
  recovered?: boolean;
}

export interface ValidatedMessage {
  original: any;
  validated: any;
  result: ValidationResult;
  recovered: boolean;
}

export type MessageValidationMode = 'strict' | 'lenient' | 'auto';

export interface MessageValidationOptions {
  mode?: MessageValidationMode;
  skipFields?: string[];
  allowPartialRecovery?: boolean;
}
