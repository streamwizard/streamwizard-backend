export type NodeHealthStatus = "online" | "offline" | "unreachable" | "unlinked";

const HEALTH_CHECK_TIMEOUT_MS = 2500;

export async function checkNodeHealth(apiUrl: string | null, nodeStatus: string): Promise<NodeHealthStatus> {
  if (nodeStatus !== "linked") return "unlinked";
  if (!apiUrl) return "offline";

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    if (!res.ok) return "unreachable";
    const body = await res.json().catch(() => null);
    return body?.ok ? "online" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function checkNodesHealth(
  nodes: { id: string; api_url: string | null; status: string }[],
): Promise<Record<string, NodeHealthStatus>> {
  const results = await Promise.allSettled(nodes.map((n) => checkNodeHealth(n.api_url, n.status)));

  const healthByNodeId: Record<string, NodeHealthStatus> = {};
  nodes.forEach((node, i) => {
    const result = results[i];
    healthByNodeId[node.id] = result?.status === "fulfilled" ? result.value : "unreachable";
  });
  return healthByNodeId;
}
