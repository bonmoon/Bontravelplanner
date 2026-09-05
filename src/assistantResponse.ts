export class AssistantFormatError extends Error {}

export function parseAssistantJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
  try { const value: unknown = JSON.parse(cleaned); if (object(value)) return value; throw new AssistantFormatError("助手返回的资料不是对象，未修改行程"); } catch (error) { if (error instanceof AssistantFormatError) throw error; /* Try a complete object surrounded by explanatory text. */ }
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let index = 0; index < cleaned.length; index++) {
    const char = cleaned[index];
    if (start < 0) { if (char === "{") { start = index; depth = 1; } continue; }
    if (escaped) { escaped = false; continue; }
    if (quoted && char === "\\") { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (char === "{") depth++;
    if (char === "}" && --depth === 0) {
      try { const value: unknown = JSON.parse(cleaned.slice(start, index + 1)); if (object(value)) return value; } catch { /* Never invent missing fields or repair incomplete data. */ }
      start = -1;
    }
  }
  throw new AssistantFormatError("助手没有返回完整的资料格式，未修改行程。请缩短为一天的攻略后重试");
}

export function readAssistantContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new AssistantFormatError("API 返回内容为空，未修改行程");
  const choice = (payload as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown; reasoning_content?: string } }> }).choices?.[0];
  if (!choice) throw new AssistantFormatError("API 返回格式与聊天接口不一致，请确认使用 chat/completions 接口");
  if (choice.finish_reason === "length") throw new AssistantFormatError("助手输出达到长度上限，资料未完整生成，未修改行程。请按天分批整理");
  if (choice.finish_reason === "content_filter") throw new Error("服务未返回可用答案，未修改行程，请调整攻略文字后重试");
  const raw = choice.message?.content;
  const content = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw.map((part) => part && typeof part === "object" && typeof part.text === "string" ? part.text : "").join("").trim() : "";
  if (!content) throw new AssistantFormatError(choice.message?.reasoning_content ? "模型只返回了思考过程，没有最终答案，未修改行程" : "模型返回空答案，未修改行程");
  return content;
}
