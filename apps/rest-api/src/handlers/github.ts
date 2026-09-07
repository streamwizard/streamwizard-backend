import { type Context } from "hono";
import { getTicketByGithubIssue, syncTicketStatusFromGithub } from "@repo/supabase/queries/tickets";
import { supabase } from "@repo/supabase";
import { sendDiscordChannelMessage } from "@repo/discord-api";
import { reportError } from "@repo/sentry";
import { env } from "../lib/env";

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

interface GithubIssuesEventPayload {
  action: string;
  issue: {
    number: number;
    html_url: string;
  };
  repository: {
    full_name: string;
  };
  sender: {
    login: string;
  };
}

export async function handleGithubWebhook(c: Context) {
  const eventType = c.get("githubEventType") as string;
  const payload = c.get("githubPayload");

  if (!payload) {
    return c.json({ error: "Internal error", message: "Webhook payload not found in context" }, 500);
  }

  if (eventType !== "issues") {
    return c.body(null, 204);
  }

  const issuesPayload = payload as GithubIssuesEventPayload;

  // Only react to events on the repo tickets are actually created in.
  if (issuesPayload.repository.full_name !== env.GITHUB_ISSUES_REPO) {
    return c.body(null, 204);
  }

  if (issuesPayload.action === "closed") {
    await handleIssueClosed(issuesPayload);
  } else if (issuesPayload.action === "reopened") {
    await handleIssueReopened(issuesPayload);
  }

  return c.body(null, 204);
}

async function handleIssueClosed(payload: GithubIssuesEventPayload): Promise<void> {
  const ticket = await getTicketByGithubIssue(supabase, payload.issue.number);
  if (!ticket) return;

  const scheduledDeletionAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();
  await syncTicketStatusFromGithub(supabase, ticket.channel_id, "closed", scheduledDeletionAt);

  await postDiscordMessage(
    ticket.channel_id,
    `🔒 [Issue #${payload.issue.number}](${payload.issue.html_url}) was closed on GitHub by **${payload.sender.login}**. This channel will be deleted in 24 hours unless the issue is reopened.`
  );
}

async function handleIssueReopened(payload: GithubIssuesEventPayload): Promise<void> {
  const ticket = await getTicketByGithubIssue(supabase, payload.issue.number);
  if (!ticket) return;

  await syncTicketStatusFromGithub(supabase, ticket.channel_id, "open", null);

  await postDiscordMessage(
    ticket.channel_id,
    `🔓 [Issue #${payload.issue.number}](${payload.issue.html_url}) was reopened on GitHub by **${payload.sender.login}**. Scheduled deletion cancelled.`
  );
}

async function postDiscordMessage(channelId: string, content: string): Promise<void> {
  try {
    await sendDiscordChannelMessage(channelId, { content });
  } catch (err) {
    reportError(err, "github.ticket-sync-discord-message", { channelId });
  }
}
