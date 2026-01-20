import type { ChannelChatMessageEvent } from "@repo/schemas";

// Import variable resolvers from separate files
import { GlobalVariableResolvers, type GlobalContext } from "./variables/global";
import { TwitchVariableResolvers, type TwitchContext } from "./variables/twitch";

// Base context that all resolvers can use
export type BaseContext = {
  event?: ChannelChatMessageEvent;
  [key: string]: any; // Allow additional properties for future services
};

// Generic resolver function type (legacy - returns strings only)
export type VariableResolver<TContext = BaseContext> = (ctx: TContext) => Promise<string>;

// Flexible resolver function type that can return any data type
export type FlexibleResolver<TContext = BaseContext> = (ctx: TContext) => Promise<any>;

// Service dependency configuration
export type ServiceDependencies = {
  required: string[]; // Required services for this namespace
  optional: string[]; // Optional services
};

// Union of all possible contexts (expand this as you add services)
export type ServiceContext = GlobalContext | TwitchContext; // | YouTubeContext | DiscordContext | SpotifyContext;

// ===== SERVICE CONFIGURATIONS =====

// Define what each namespace requires
const ServiceRequirements: Record<string, ServiceDependencies> = {
  global: {
    required: [],
    optional: [],
  },
  twitch: {
    required: ["twitchApi"],
    optional: ["event"],
  },
};

// ===== RESOLVER REGISTRY =====
const ResolverRegistry: Record<string, Record<string, VariableResolver<any> | FlexibleResolver<any>>> = {
  global: GlobalVariableResolvers,
  twitch: TwitchVariableResolvers,
};

// ===== MAIN RESOLVER FUNCTION =====
export async function resolveVariables(message: string, ctx: ServiceContext = {}, historyResults: Record<string, any> = {}): Promise<string> {
  // Extract all variable references
  const variablesArray = message.match(/\$\{([\w\.-]+)\}/g) || [];
  if (variablesArray.length === 0) return message;

  // Validate the context for the namespaces
  const namespaces = extractNamespacesFromTemplate(message);
  validateContextForNamespaces(ctx, namespaces);

  let resolvedMessage = message;

  for (const variable of variablesArray) {
    const raw = variable.slice(2, -1); // Remove ${...}

    // Determine namespace and key
    const hasNamespace = raw.includes(".");

    const [namespace, key] = hasNamespace ? (raw.split(".", 2) as [string, string]) : ["twitch", raw]; // Default to twitch for backwards compatibility

    if (isUuid(namespace)) {
      if (!historyResults?.[namespace]) {
        console.warn(`No history results found for UUID: ${namespace}`);
        resolvedMessage = resolvedMessage.replace(variable, "");
        continue;
      }

      const value = historyResults[namespace][key];

      // check if the value is a string
      if (typeof value !== "string") {
        console.warn(`History result is not a string: ${namespace}`);
        resolvedMessage = resolvedMessage.replace(variable, "");
        continue;
      }

      resolvedMessage = resolvedMessage.replace(variable, value);
      continue;
    }

    const namespaceResolvers = ResolverRegistry[namespace];
    if (!namespaceResolvers) {
      console.warn(`Unknown namespace: ${namespace}`);
      resolvedMessage = resolvedMessage.replace(variable, "");
      continue;
    }

    const resolver = namespaceResolvers[key];
    if (!resolver) {
      console.warn(`Unknown variable: ${namespace}.${key}`);
      resolvedMessage = resolvedMessage.replace(variable, "");
      continue;
    }

    try {
      const value = await resolver(ctx);
      // Convert non-string values to string for template replacement
      const stringValue =
        typeof value === "string"
          ? value
          : value === null || value === undefined
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);
      resolvedMessage = resolvedMessage.replace(variable, stringValue);
    } catch (error) {
      console.error(`Error resolving ${namespace}.${key}:`, error);
      resolvedMessage = resolvedMessage.replace(variable, "");
    }
  }

  return resolvedMessage;
}

function extractNamespacesFromTemplate(template: string): string[] {
  const matches = template.match(/\$\{([\w\.-]+)\}/g) || [];
  const namespaces = new Set<string>();

  for (const match of matches) {
    const raw = match.slice(2, -1);
    const hasNamespace = raw.includes(".");
    const [namespace] = hasNamespace ? raw.split(".", 2) : ["twitch", raw];
    if (!namespace) continue;
    namespaces.add(namespace);
  }

  return Array.from(namespaces);
}

function validateContextForNamespaces(ctx: BaseContext, namespaces: string[]): void {
  const errors: string[] = [];

  for (const namespace of namespaces) {
    if (isUuid(namespace)) {
      console.warn(`UUID namespace: ${namespace}`);
      continue;
    }

    const requirements = ServiceRequirements[namespace];
    if (!requirements) {
      errors.push(`Unknown namespace: ${namespace}`);
      continue;
    }

    const missingServices = requirements.required.filter((service) => !(service in ctx) || ctx[service] === undefined);

    if (missingServices.length > 0) {
      errors.push(`Namespace '${namespace}' requires: ${missingServices.join(", ")}. ` + `Please provide these services in the context.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Context validation failed:\n${errors.join("\n")}`);
  }
}

function isUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
