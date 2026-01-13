import { TwitchApiBaseClient } from "./base-client";

export type TransportMethod = "webhook" | "websocket" | "conduit";

export interface Transport {
  method: TransportMethod;
  callback?: string;
  secret?: string;
  session_id?: string;
  conduit_id?: string;
  shard_id?: string;
}

export interface EventSubSubscription {
  id: string;
  status:
  | "enabled"
  | "webhook_callback_verification_pending"
  | "webhook_callback_verification_failed"
  | "notification_failures_exceeded"
  | "authorization_revoked"
  | "user_removed"
  | "version_removed";
  type: string;
  version: string;
  condition: Record<string, unknown>;
  created_at: string;
  transport: Transport;
  cost: number;
}

export interface CreateEventSubSubscriptionOptions {
  type: string;
  version: string;
  condition: Record<string, unknown>;
  transport: Transport;
}

export interface ConduitShard {
  id: string;
  status: "enabled" | "disabled";
  transport: Transport;
}

export interface CreateConduitOptions {
  shard_count: number;
}

export interface Conduit {
  id: string;
  shard_count: number;
  shards: ConduitShard[];
}

interface RequiredScopes {
  [key: string]: string[];
}

export class TwitchEventSubClient extends TwitchApiBaseClient {


  async createSubscription(options: CreateEventSubSubscriptionOptions, channelId: string): Promise<{ data: EventSubSubscription[] }> {
    const response = await this.appApi().post("/eventsub/subscriptions", options);
    return response.data;
  }

  async deleteSubscription(subscriptionId: string, channelId: string): Promise<void> {
    await this.appApi().delete(`/eventsub/subscriptions?id=${subscriptionId}`);
  }

  async getSubscriptions(channelId: string): Promise<{ data: EventSubSubscription[] }> {
    const response = await this.appApi().get("/eventsub/subscriptions");
    return response.data;
  }

  // Conduit-specific methods
  async createConduit(options: CreateConduitOptions): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().post("/eventsub/conduits", options);
    return response.data;
  }

  async getConduits(): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().get("/eventsub/conduits");
    return response.data;
  }

  async getConduitShards(conduitId: string): Promise<{ data: ConduitShard[] }> {
    const response = await this.appApi().get("/eventsub/conduits/shards", {
      params: {
        conduit_id: conduitId,
      },
    });
    return response.data;
  }

  async getConduitWithShards(conduitId: string): Promise<Conduit | null> {
    try {
      const [conduitResponse, shardsResponse] = await Promise.all([this.getConduits(), this.getConduitShards(conduitId)]);

      const conduit = conduitResponse.data.find((c) => c.id === conduitId);
      if (!conduit) {
        return null;
      }

      return {
        ...conduit,
        shards: shardsResponse.data,
      };
    } catch (error) {
      console.error(`❌ Failed to get conduit ${conduitId} with shards:`, error);
      return null;
    }
  }

  async updateConduitShards(conduitId: string, shardCount: number): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().patch(`/eventsub/conduits/${conduitId}/shards`, {
      shard_count: shardCount,
    });
    return response.data;
  }

  async updateShardTransport(conduitId: string, shardId: string, transport: Transport): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().patch("/eventsub/conduits/shards", {
      conduit_id: conduitId,
      shards: [
        {
          id: shardId,
          transport: transport,
        },
      ],
    });
    return response.data;
  }
}
