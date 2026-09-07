import { supabase } from "@repo/supabase/next/client";

// Browsers can't set an Authorization header on `new WebSocket()`, so auth has
// to ride on the URL -- and a long-lived Supabase JWT in a WS URL leaks into
// node/proxy access logs and browser history. Instead we mint a short-lived,
// single-use, scope+instance-bound ticket from obs-instance-manager over an
// authenticated POST (the JWT stays in the Authorization header), and only that
// ticket goes on the socket. Mirrors how Twitch EventSub keeps the OAuth token
// off the WebSocket. Tickets are ~30s and single-use, so they must be minted
// immediately before each connect (including every reconnect), never cached.

export type WsTicketScope = "metrics" | "novnc" | "obsws";

// vnc_password is only ever present for scope=novnc (see obs-instance-manager's
// POST /:id/ws-ticket) -- the noVNC/RFB handshake happens directly between this
// client and x11vnc inside the container (the API's WS proxy is a blind byte
// relay), so the browser needs the password out-of-band to authenticate it.
async function getWsTicket(
  apiUrl: string,
  ticketPath: string,
  scope: WsTicketScope,
): Promise<{ ticket: string; vncPassword?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}${ticketPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ scope }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to get WebSocket ticket (${res.status})`);
  }

  const { ticket, vnc_password } = (await res.json()) as { ticket: string; vnc_password?: string };
  return { ticket, vncPassword: vnc_password };
}

// apiUrl must come from a trusted server-side lookup (never the query string):
// the ticket is appended and the URL dialed as a WebSocket, so an attacker-
// controlled apiUrl would exfiltrate the ticket to an arbitrary host.
export async function mintWsUrl(
  apiUrl: string,
  opts: { ticketPath: string; wsPath: string; scope: WsTicketScope },
): Promise<string> {
  const { ticket } = await getWsTicket(apiUrl, opts.ticketPath, opts.scope);
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}${opts.wsPath}`;
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

// Same as mintWsUrl, but for scope=novnc specifically: also returns the VNC
// password the caller must hand to noVNC's RFB client (as `credentials.password`)
// to complete the RFB auth handshake with x11vnc. See CloudOBSViewer.
export async function mintNoVncConnection(
  apiUrl: string,
  opts: { ticketPath: string; wsPath: string },
): Promise<{ url: string; password: string }> {
  const { ticket, vncPassword } = await getWsTicket(apiUrl, opts.ticketPath, "novnc");
  if (!vncPassword) throw new Error("Server didn't return a VNC password for this instance.");

  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}${opts.wsPath}`;
  url.searchParams.set("ticket", ticket);
  return { url: url.toString(), password: vncPassword };
}
