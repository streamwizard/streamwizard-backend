import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export interface GithubAppCredentials {
  appId: string;
  privateKey: string;
  installationId: string;
}

// One Octokit instance per installation, reused across calls. @octokit/auth-app
// already caches/refreshes the installation token internally, so this just
// avoids re-creating the auth strategy on every call.
const clients = new Map<string, Octokit>();

export function getInstallationOctokit(credentials: GithubAppCredentials): Octokit {
  const cached = clients.get(credentials.installationId);
  if (cached) return cached;

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: credentials.appId,
      privateKey: credentials.privateKey,
      installationId: credentials.installationId,
    },
  });

  clients.set(credentials.installationId, octokit);
  return octokit;
}
