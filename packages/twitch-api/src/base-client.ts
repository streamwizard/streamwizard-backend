import {
  getChannelAccessToken,
  getChannelRefreshToken,
  getTwitchAppToken,
  updateChannelAccessToken,
  updateTwitchAppToken,
  type RefreshTwitchTokenResponse,
} from "@repo/supabase";
import { env } from "@repo/env";
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

export abstract class TwitchApiBaseClient {
  private readonly MAX_RETRIES = 2;
  protected broadcaster_id: string | null = null;

  constructor(broadcaster_id: string | null = null) {
    this.broadcaster_id = broadcaster_id;
  }

  protected clientApi(): AxiosInstance {
    const api = axios.create({
      baseURL: "https://api.twitch.tv/helix",
    });
    this.clientInterceptor(api);
    return api;
  }

  // This interceptor is used to intercept the request and add the token to the request
  protected clientInterceptor(api: AxiosInstance): void {
    api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (!this.broadcaster_id) {
          throw new Error("Broadcaster ID is required in Twitch client interceptor");
        }

        // Maybe we should redis cache for caching the token?

        const token = await getChannelAccessToken(this.broadcaster_id);

        config.headers["Client-Id"] = env.TWITCH_CLIENT_ID;
        config.headers["Content-Type"] = "application/json";
        config.headers["Authorization"] = `Bearer ${token}`;

        return config;
      },
      (error) => Promise.reject(error)
    );

    // This interceptor is used to intercept the response and check if the token is expired and refresh it if it is
    api.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { __retryCount?: number };
        if (!config) return Promise.reject(error);

        const statusCode = error.response?.status;
        const currentRetryCount = config.__retryCount || 0;

        if (statusCode === 401 && currentRetryCount < this.MAX_RETRIES) {
          config.__retryCount = currentRetryCount + 1;
          try {
            if (!this.broadcaster_id) {
              throw new Error("Broadcaster ID is required in Twitch client interceptor");
            }
            console.log(
              "🔄 Token expired, attempting to refresh for broadcaster:",
              this.broadcaster_id
            );
            const newToken = await this.refreshUserToken(this.broadcaster_id);
            if (!newToken) {
              return Promise.reject(error);
            }
            config.headers = config.headers || {};
            config.headers["Authorization"] = `Bearer ${newToken}`;
            console.log("✅ Token refreshed, retrying request");
            return api(config);
          } catch (refreshError) {
            console.error("❌ Token refresh failed:", refreshError);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  protected appApi(): AxiosInstance {
    const api = axios.create({
      baseURL: "https://api.twitch.tv/helix",
    });
    this.appInterceptor(api);
    return api;
  }

  protected appInterceptor(api: AxiosInstance): void {
    api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const { access_token, expires_in, updated_at } = await getTwitchAppToken();

        let token: string = access_token;

        // check if token is expired
        if (this.checkTokenExpiry(updated_at, expires_in)) {
          const newToken = await this.refreshAppToken();
          if (!newToken) {
            return Promise.reject(new Error("Failed to refresh app token"));
          }
          token = newToken as string;
        }

        config.headers["Client-Id"] = env.TWITCH_CLIENT_ID;
        config.headers["Content-Type"] = "application/json";
        config.headers["Authorization"] = `Bearer ${access_token}`;
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    api.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { __retryCount?: number };
        if (!config) return Promise.reject(error);

        const statusCode = error.response?.status;
        const currentRetryCount = config.__retryCount || 0;

        if (statusCode === 401 && currentRetryCount < this.MAX_RETRIES) {
          config.__retryCount = currentRetryCount + 1;
          try {
            console.log("🔄 Token invalid, attempting to refresh for app token");
            const newToken = await this.refreshAppToken();
            if (!newToken) {
              return Promise.reject(new Error("Failed to refresh app token"));
            }
            config.headers = config.headers || {};
            config.headers["Authorization"] = `Bearer ${newToken}`;
            console.log("✅ Token refreshed, retrying request");
            return api(config);
          } catch (refreshError) {
            console.error("❌ Token refresh failed:", refreshError);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private checkTokenExpiry(updated_at: string, expires_in: number): boolean {
    const updatedAtTimestamp = new Date(updated_at).getTime();
    const expiresInMs = expires_in * 1000; // Convert seconds to milliseconds
    const isExpired = Date.now() > updatedAtTimestamp + expiresInMs;
    return isExpired;
  }

  private async refreshUserToken(broadcaster_id: string): Promise<string | null> {
    try {
      // get the refresh token from the database
      const refreshToken = await getChannelRefreshToken(broadcaster_id);
      if (!refreshToken) {
        throw new Error("No refresh token found for channel");
      }
      // refresh the token
      const response = await axios.post<RefreshTwitchTokenResponse>(
        "https://id.twitch.tv/oauth2/token",
        null,
        {
          params: {
            client_id: env.TWITCH_CLIENT_ID,
            client_secret: env.TWITCH_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          },
        }
      );
      // update the token in the database
      await updateChannelAccessToken(response.data, broadcaster_id);
      return response.data.access_token;
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      throw error;
    }
  }

  private async refreshAppToken(): Promise<string | null> {
    try {
      const response = await axios.post("https://id.twitch.tv/oauth2/token", null, {
        params: {
          client_id: env.TWITCH_CLIENT_ID,
          client_secret: env.TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        },
      });

      await updateTwitchAppToken(response.data.access_token, response.data.expires_in);

      return response.data.access_token;
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      throw error;
    }
  }
}
