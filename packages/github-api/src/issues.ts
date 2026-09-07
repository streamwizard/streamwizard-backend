import type { Octokit } from "@octokit/rest";

export interface CreatedIssue {
  number: number;
  url: string;
}

export interface CreateIssueInput {
  title: string;
  body: string;
}

// repo is "owner/repo", matching the GITHUB_ISSUES_REPO env var format.
export async function createTicketIssue(octokit: Octokit, repo: string, input: CreateIssueInput): Promise<CreatedIssue> {
  const [owner, name] = repo.split("/") as [string, string];
  const { data } = await octokit.rest.issues.create({
    owner,
    repo: name,
    title: input.title,
    body: input.body,
  });

  return { number: data.number, url: data.html_url };
}
