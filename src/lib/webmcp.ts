/**
 * Thin wrapper over the WebMCP browser API.
 *
 * The getter moved from Navigator to Document in the May 2026 spec draft and
 * navigator.modelContext is deprecated in Chromium 150, so we read document
 * first and fall back for older builds. The API is SecureContext-only, which
 * is why local development must be https or localhost.
 */

export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface ModelContextLike {
  registerTool(tool: WebMCPToolDefinition): void;
  unregisterTool(name: string): void;
}

export function getModelContext(): ModelContextLike | null {
  if (typeof window === "undefined") return null;
  const fromDocument = (document as unknown as { modelContext?: ModelContextLike })
    .modelContext;
  if (fromDocument) return fromDocument;
  const fromNavigator = (navigator as unknown as { modelContext?: ModelContextLike })
    .modelContext;
  return fromNavigator ?? null;
}

export function isWebMCPAvailable(): boolean {
  return getModelContext() !== null;
}

/**
 * Registers a set of tools and returns a disposer. registerTool throws
 * InvalidStateError when a name is already taken, so we unregister first —
 * React strict mode double-invokes effects in development.
 */
export function registerTools(tools: WebMCPToolDefinition[]): () => void {
  const mc = getModelContext();
  if (!mc) return () => {};

  for (const tool of tools) {
    try {
      mc.unregisterTool(tool.name);
    } catch {
      // Not registered yet. Expected on first run.
    }
    try {
      mc.registerTool(tool);
    } catch (err) {
      console.warn(`[webmcp] failed to register ${tool.name}`, err);
    }
  }

  return () => {
    for (const tool of tools) {
      try {
        mc.unregisterTool(tool.name);
      } catch {
        // Already gone.
      }
    }
  };
}
