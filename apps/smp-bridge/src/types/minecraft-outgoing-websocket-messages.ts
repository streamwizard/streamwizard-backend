export type MinecraftActionsType = MinecraftEvents | MinecraftJumpscares | MinecraftDisasters;

export type MinecraftEvents = "event.launce" | "event.random_mob_spawn" | "event.celebration_alert";

export type MinecraftJumpscares = "jumpscare.fake_damage" | "jumpscare.fireworks" | "jumpscare.door_scare" | "jumpscare.EndermanJumpscare" | "jumpscare.SpinningPlayer" | "jumpscare.welcome_home";

export type MinecraftDisasters = "disaster.supernova" | "disaster.windstorm";

export type MinecraftRedemptionData<T = null> = T & {
    action: MinecraftActionsType;
    player_uuid: string;
    streamer_id: string;
    metadata?: T;
};

export interface WindStormMetadata {
    // Intensity/Power (optional)
    level?: number; // 1-10 scale, default: 5
    intensity?: number; // 0.1-2.0 multiplier, alternative to level
    force?: number; // Direct wind force value (0.1-2.0), default: 0.6

    // Duration/Timing (optional)
    duration?: number; // Duration in seconds (1-60), default: 15
    ticks?: number; // Exact tick count, alternative to duration

    // Area Effects (optional)
    radius?: number; // Effect radius in blocks (5-50), default: 20
    range?: number; // Alternative to radius

    // Direction Control (optional)
    direction?: "north" | "south" | "east" | "west" | "northeast" | "northwest" | "southeast" | "southwest" | "random"; // Wind direction, default: "random"
    angle?: number; // 0-360 degrees, alternative to direction

    // Visual/Audio Effects (optional)
    particles?: number; // Particle count multiplier (0.1-3.0), default: 1.0
    volume?: number; // Sound volume (0.0-2.0), default: 1.0
    effects?: "minimal" | "normal" | "maximum"; // Effect intensity preset

    // Entity Targeting (optional)
    targets?: "players" | "mobs" | "all"; // What to affect, default: "all"
    exclude_flying?: boolean; // Exclude flying entities, default: false

    // Advanced Options (optional)
    max_velocity?: number; // Maximum horizontal velocity limit, default: 2.0
    distance_falloff?: boolean; // Whether effects weaken with distance, default: true
}

export interface TwitchSubscriptionMetadata {
    // Subscriber Information (optional)
    subscriber_name?: string; // Name of the subscriber, default: "Someone"
    tier?: "1" | "2" | "3" | "prime"; // Subscription tier, default: "1"

    title: string;
    subtitle: string;

    // Effect Duration (optional)
    duration?: number; // Duration in seconds (1-10), default: 5

    // Visual Effects (optional)
    fireworks?: number; // Number of fireworks (1-10), default: 3
    intensity?: "low" | "normal" | "high" | "extreme"; // Effect intensity preset

    // Display Options (optional)
    show_chat?: boolean; // Show chat message, default: true
    show_title?: boolean; // Show title/subtitle, default: true
    broadcast?: boolean;
    // Show to all players vs just streamer, default: false

    // Customization (optional)
    message?: string; // Custom celebration message
    volume?: number; // Sound volume (0.0-2.0), default: 1.0
}


export interface RandomMobSpawnMetadata {
    viewer_list: string[];
    mob_list: string[];
    amount: number;
    viewer_name: string;
}


export interface SupernovaMetadata {
    level: number;
    viewer_name: string;
}