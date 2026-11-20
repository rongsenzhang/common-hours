// Configuration comes from the deployed site's own release. URL or form parameters
// never select where messages are sent.
export function chatEndpoint(config, pageUrl) {
  if (typeof config?.endpoint !== "string" || !config.endpoint.trim())
    return null;
  try {
    const url = new URL(config.endpoint, pageUrl);
    const page = new URL(pageUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"];
    const local =
      url.protocol === "http:" &&
      page.protocol === "http:" &&
      loopback.includes(url.hostname) &&
      loopback.includes(page.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && !local)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export class ChatRequestError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind;
  }
}

function recentLiveHistory(turns) {
  return turns
    .filter((turn) => turn.reply?.provider === "openai")
    .slice(-8)
    .map(({ input, reply }) => ({
      user: input,
      text: reply.text.slice(0, 1200),
      matches: reply.matches,
      toConfirm: reply.toConfirm,
    }));
}

function checkedReply(data, roles) {
  if (
    data?.provider !== "openai" ||
    typeof data.model !== "string" ||
    !data.model.trim() ||
    typeof data.text !== "string" ||
    !data.text.trim() ||
    !Array.isArray(data.matches) ||
    !Array.isArray(data.toConfirm)
  ) {
    throw new ChatRequestError("invalid");
  }
  const ids = [...data.matches, ...data.toConfirm];
  const roleIds = new Set(roles.map((role) => role.id));
  if (
    ids.length > 3 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !roleIds.has(id))
  ) {
    throw new ChatRequestError("invalid");
  }
  const details = {};
  for (const id of ids) {
    if (typeof data.details?.[id] === "string") details[id] = data.details[id];
  }
  return {
    provider: "openai",
    model: data.model,
    text: data.text.trim(),
    matches: data.matches,
    toConfirm: data.toConfirm,
    details,
  };
}

export async function requestLiveReply({
  endpoint,
  message,
  turns,
  roles,
  signal,
  fetchImpl = fetch,
  timeoutMs = 35000,
}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let expired = false;
  if (signal?.aborted) throw new ChatRequestError("cancelled");
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      body: JSON.stringify({ message, history: recentLiveHistory(turns) }),
    });
    if (!response.ok)
      throw new ChatRequestError(
        response.status === 429 ? "busy" : "unavailable",
      );
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json"))
      throw new ChatRequestError("invalid");
    return checkedReply(await response.json(), roles);
  } catch (error) {
    if (expired) throw new ChatRequestError("timeout");
    if (signal?.aborted) throw new ChatRequestError("cancelled");
    if (error instanceof ChatRequestError) throw error;
    throw new ChatRequestError("unavailable");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function liveFailureMessage(kind, message = "") {
  const chinese = /[\u3400-\u9fff]/u.test(message);
  if (kind === "cancelled")
    return chinese
      ? "已取消，你可以修改问题再发送。"
      : "Cancelled. You can edit your question and send it again.";
  if (kind === "busy")
    return chinese
      ? "实时 AI 暂时达到使用上限。请稍后重试，或使用本地搜索。"
      : "Live AI has reached its usage limit. Try again later or use on-device search.";
  if (kind === "timeout")
    return chinese
      ? "实时 AI 响应超时。请重试或使用本地搜索。"
      : "Live AI took too long to respond. Try again or use on-device search.";
  return chinese
    ? "实时 AI 暂时无法回复。请重试或使用本地搜索。"
    : "Live AI could not reply. Try again or use on-device search.";
}
