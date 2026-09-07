import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

type DBClient = SupabaseClient<Database>;

export interface IrlGeoTrackRow {
  id: string;
  user_id: string;
  session_id: string;
  stream_id: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
  inserted_at: string;
}

export interface IrlGeoTrackInsert {
  user_id: string;
  session_id: string;
  stream_id?: string | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recorded_at: string;
}

export const insertIrlGeoTrack = withMetrics(
  "irl_geo_track",
  "insert",
  async (client: DBClient, data: IrlGeoTrackInsert) => client.from("irl_geo_track" as never).insert(data as never),
);
