/**
 * SDK Zod Schemas - Centralized schema definitions
 * Single source of truth for Claude Code SDK message validation
 *
 * These schemas validate messages from the Claude Code SDK with progressive
 * fallback support (strict → relaxed → partial extraction).
 *
 * Schema Organization:
 * - Content Blocks: Text, ToolUse, ToolResult
 * - Messages: User, Assistant, System, Result, StreamEvent
 * - Supporting Types: Usage, ModelUsage, PermissionDenial
 *
 * Usage:
 * import { StrictSDKMessageSchema, RelaxedSDKMessageSchema } from '@/types/sdk.schemas';
 */

import { z } from 'zod';

/**
 * Usage tracking schema
 */
export const UsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
});

export const NonNullableUsageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
});

/**
 * Content block schemas
 */
export const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export const ImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.enum(['base64', 'url']),
    media_type: z.string(),
    data: z.string().optional(),
    url: z.string().optional(),
  }),
});

export const DocumentContentSchema = z.object({
  type: z.literal('document'),
  source: z.object({
    type: z.enum(['base64', 'url']),
    media_type: z.string(),
    data: z.string().optional(),
    url: z.string().optional(),
  }),
});

/**
 * Tool result content block schema
 * Can contain text, images, or documents
 */
const ToolResultTextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const ToolResultInnerContentSchema = z.union([
  ToolResultTextContentSchema,
  ImageContentSchema,
  DocumentContentSchema,
]);

export const ToolResultContentSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(ToolResultInnerContentSchema)]),
  is_error: z.boolean().optional(),
});

/**
 * Content block union schema
 * Note: Logging is handled in MessageValidator.ts, not here
 */
export const ContentBlockSchema = z.union([
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ImageContentSchema,
  DocumentContentSchema,
]);

/**
 * Assistant message schema
 */
export const AssistantMessageSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(ContentBlockSchema),
  model: z.string(),
  stop_reason: z
    .enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn', 'refusal'])
    .nullable(),
  stop_sequence: z.string().nullable(),
  usage: UsageSchema,
});

/**
 * User message schema
 */
export const UserMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

/**
 * Model usage schema
 */
export const ModelUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadInputTokens: z.number(),
  cacheCreationInputTokens: z.number(),
  webSearchRequests: z.number(),
  costUSD: z.number(),
  contextWindow: z.number(),
});

/**
 * Permission denial schema
 */
export const PermissionDenialSchema = z.object({
  tool_name: z.string(),
  tool_use_id: z.string(),
  tool_input: z.record(z.unknown()),
});

/**
 * Stream event schema
 */
export const StreamEventSchema = z.object({
  type: z.string(),
  index: z.number().optional(),
  delta: z
    .object({
      type: z.string(),
      text: z.string().optional(),
      partial_json: z.string().optional(),
    })
    .optional(),
  content_block: ContentBlockSchema.optional(),
  message: z.any().optional(),
  usage: UsageSchema.optional(),
});

/**
 * Base message schema with required UUID and session_id
 */
export const MessageBaseSchema = z.object({
  uuid: z.string(),
  session_id: z.string(),
});

/**
 * Base message schema with optional UUID
 * Used for messages that don't require tracking (system, result)
 */
export const MessageBaseSchemaOptionalUuid = z.object({
  uuid: z.string().optional(),
  session_id: z.string(),
});

/**
 * SDK User Message schema
 */
export const SDKUserMessageSchema = MessageBaseSchema.extend({
  type: z.literal('user'),
  message: UserMessageSchema,
  parent_tool_use_id: z.string().nullable(),
  isSynthetic: z.boolean().optional(),
  isReplay: z.boolean().optional(),
});

/**
 * SDK Assistant Message schema
 */
export const SDKAssistantMessageSchema = MessageBaseSchema.extend({
  type: z.literal('assistant'),
  message: AssistantMessageSchema,
  parent_tool_use_id: z.string().nullable(),
});

/**
 * SDK Result Message schema
 * UUID optional for runtime compatibility
 * duration_api_ms optional for runtime compatibility
 */
export const SDKResultMessageSchema = MessageBaseSchemaOptionalUuid.extend({
  type: z.literal('result'),
  subtype: z.enum(['success', 'error_max_turns', 'error_during_execution']),
  duration_ms: z.number(),
  duration_api_ms: z.number().optional(),
  is_error: z.boolean(),
  num_turns: z.number(),
  total_cost_usd: z.number(),
  usage: NonNullableUsageSchema,
  modelUsage: z.record(ModelUsageSchema),
  permission_denials: z.array(PermissionDenialSchema),
  result: z.string().optional(),
});

/**
 * SDK System Init Message schema
 */
export const SDKSystemMessageSchema = MessageBaseSchemaOptionalUuid.extend({
  type: z.literal('system'),
  subtype: z.literal('init'),
  agents: z.array(z.string()).optional(),
  apiKeySource: z.enum(['user', 'project', 'org', 'temporary', 'none']),
  cwd: z.string(),
  tools: z.array(z.string()),
  mcp_servers: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
    })
  ),
  model: z.string(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']),
  slash_commands: z.array(z.string()),
  output_style: z.string(),
});

/**
 * SDK Compact Boundary Message schema
 */
export const SDKCompactBoundaryMessageSchema = MessageBaseSchemaOptionalUuid.extend({
  type: z.literal('system'),
  subtype: z.literal('compact_boundary'),
  compact_metadata: z.object({
    trigger: z.enum(['manual', 'auto']),
    pre_tokens: z.number(),
  }),
});

/**
 * SDK Stream Event schema
 */
export const SDKStreamEventSchema = MessageBaseSchema.extend({
  type: z.literal('stream_event'),
  event: StreamEventSchema,
  parent_tool_use_id: z.string().nullable(),
});

/**
 * Strict SDK Message schema - union of all message types
 * Use for initial validation attempt with full type safety
 */
export const StrictSDKMessageSchema = z.union([
  SDKUserMessageSchema,
  SDKAssistantMessageSchema,
  SDKResultMessageSchema,
  SDKSystemMessageSchema,
  SDKCompactBoundaryMessageSchema,
  SDKStreamEventSchema,
]);

/**
 * Relaxed Assistant Message schema (allows partial usage data)
 */
export const RelaxedAssistantMessageSchema = AssistantMessageSchema.partial({
  usage: true,
  stop_reason: true,
  stop_sequence: true,
});

/**
 * Relaxed SDK Message schema - allows partial data
 * Use as fallback when strict validation fails
 */
export const RelaxedSDKMessageSchema = z.union([
  SDKUserMessageSchema,
  MessageBaseSchema.extend({
    type: z.literal('assistant'),
    message: RelaxedAssistantMessageSchema,
    parent_tool_use_id: z.string().nullable(),
  }),
  SDKResultMessageSchema.partial({ result: true }),
  SDKSystemMessageSchema,
  SDKCompactBoundaryMessageSchema,
  SDKStreamEventSchema,
]);

/**
 * Type exports for TypeScript type inference
 */
export type Usage = z.infer<typeof UsageSchema>;
export type NonNullableUsage = z.infer<typeof NonNullableUsageSchema>;
export type TextContent = z.infer<typeof TextContentSchema>;
export type ToolUseContent = z.infer<typeof ToolUseContentSchema>;
export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;
export type ImageContent = z.infer<typeof ImageContentSchema>;
export type DocumentContent = z.infer<typeof DocumentContentSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type UserMessage = z.infer<typeof UserMessageSchema>;
export type ModelUsage = z.infer<typeof ModelUsageSchema>;
export type PermissionDenial = z.infer<typeof PermissionDenialSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type SDKUserMessage = z.infer<typeof SDKUserMessageSchema>;
export type SDKAssistantMessage = z.infer<typeof SDKAssistantMessageSchema>;
export type SDKResultMessage = z.infer<typeof SDKResultMessageSchema>;
export type SDKSystemMessage = z.infer<typeof SDKSystemMessageSchema>;
export type SDKCompactBoundaryMessage = z.infer<typeof SDKCompactBoundaryMessageSchema>;
export type SDKStreamEvent = z.infer<typeof SDKStreamEventSchema>;
export type StrictSDKMessage = z.infer<typeof StrictSDKMessageSchema>;
export type RelaxedSDKMessage = z.infer<typeof RelaxedSDKMessageSchema>;
