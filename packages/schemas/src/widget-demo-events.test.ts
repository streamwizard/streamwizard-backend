import { describe, expect, it } from "bun:test";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  DEMO_EVENT_TYPES,
  buildDemoEvent,
  isDemoEventType,
} from "./widget-demo-events";
import { OverlayGeoEventSchema } from "./streamwizard";
import { ChannelChatMessageEventSchema } from "./chat";
import {
  initChatStream,
  initGeoWalk,
  stepChatStream,
  stepGeoWalk,
  type GeoWalkOptions,
} from "./widget-simulator-steps";

describe("demo events", () => {
  // Same guard the EventSub fixtures have: if a schema is updated and a demo
  // payload isn't, it fails here rather than silently lying to a streamer who
  // is using it to test their widget.
  for (const type of DEMO_EVENT_TYPES) {
    it(`${type} builds a payload matching its schema`, () => {
      const { payload } = buildDemoEvent(type);
      const result = DEMO_EVENT_DEFS[type].schema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    const variants = DEMO_EVENT_DEFS[type].variants;
    for (const variant of Object.keys(variants ?? {})) {
      it(`${type} variant "${variant}" matches its schema`, () => {
        const { payload } = buildDemoEvent(type, undefined, variant);
        const result = DEMO_EVENT_DEFS[type].schema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    }
  }

  it("includes both the EventSub fixtures and the StreamWizard events", () => {
    expect(isDemoEventType("channel.follow")).toBe(true);
    expect(isDemoEventType("streamwizard.geo")).toBe(true);
  });

  it("rejects unknown types", () => {
    expect(isDemoEventType("streamwizard.definitely_not_real")).toBe(false);
    expect(isDemoEventType("constructor")).toBe(false);
  });

  // The offline case is a variant rather than its own catalogue entry so the
  // allowlist only ever contains listener strings ws-server will accept.
  it("keeps geo offline under the geo listener", () => {
    expect(isDemoEventType("streamwizard.geo:offline")).toBe(false);
    const { type, payload } = buildDemoEvent("streamwizard.geo", undefined, "offline");
    expect(type).toBe("streamwizard.geo");
    expect(payload).toEqual({ status: "offline" });
  });

  it("throws on an unknown variant rather than silently firing the default", () => {
    expect(() => buildDemoEvent("streamwizard.geo", undefined, "nope")).toThrow();
  });

  it("builds fresh values per call", () => {
    const a = buildDemoEvent("streamwizard.obs_instance_lifecycle");
    expect(typeof a.payload.at).toBe("string");
  });
});

describe("geo walk simulator", () => {
  /** Deterministic stand-in for Math.random, so a failure is reproducible. */
  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  const opts: GeoWalkOptions = {};
  const START = { lat: 52.3676, lon: 4.9041 };

  it("emits 300 ticks that all parse as geo events and stay plausible", () => {
    const rand = seededRandom(42);
    let state = initGeoWalk(opts, 0);

    for (let i = 1; i <= 300; i++) {
      const now = i * 1000;
      const stepped = stepGeoWalk(state, opts, now, rand);
      state = stepped.state;

      const parsed = OverlayGeoEventSchema.safeParse(stepped.event);
      expect(parsed.success).toBe(true);

      // Narrow past the offline arm; a walk tick is always "connected".
      if (stepped.event.status !== "connected") throw new Error("walk emitted offline");
      const geo = stepped.event.payload;

      expect(Number.isFinite(geo.latitude)).toBe(true);
      expect(Number.isFinite(geo.longitude)).toBe(true);
      expect(Math.abs(geo.latitude - START.lat)).toBeLessThan(0.5);
      expect(Math.abs(geo.longitude - START.lon)).toBeLessThan(0.5);
      // Speed rides a sine between base ± swing (9 ± 6).
      expect(geo.speed).toBeGreaterThanOrEqual(3);
      expect(geo.speed).toBeLessThanOrEqual(15);
      expect(geo.heading).toBeGreaterThanOrEqual(0);
      expect(geo.heading).toBeLessThan(360);
      expect(geo.timestamp).toBe(now);
    }
  });

  it("actually moves", () => {
    const rand = seededRandom(7);
    let state = initGeoWalk(opts, 0);
    for (let i = 1; i <= 10; i++) state = stepGeoWalk(state, opts, i * 1000, rand).state;
    expect(state.lat).not.toBe(START.lat);
    expect(state.lon).not.toBe(START.lon);
  });

  it("is reproducible given the same seed and clock", () => {
    const run = () => {
      const rand = seededRandom(99);
      let state = initGeoWalk(opts, 0);
      for (let i = 1; i <= 20; i++) state = stepGeoWalk(state, opts, i * 1000, rand).state;
      return state;
    };
    expect(run()).toEqual(run());
  });
});

describe("chat stream simulator", () => {
  it("emits messages that parse as channel.chat.message", () => {
    let state = initChatStream();
    for (let i = 0; i < 8; i++) {
      const stepped = stepChatStream(state);
      state = stepped.state;
      expect(ChannelChatMessageEventSchema.safeParse(stepped.event).success).toBe(true);
    }
  });

  it("cycles through its pool rather than repeating one line", () => {
    let state = initChatStream();
    const texts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const stepped = stepChatStream(state);
      state = stepped.state;
      texts.push((stepped.event.message as { text: string }).text);
    }
    expect(new Set(texts).size).toBe(3);
  });
});

// Guards the shape the panel and the server action both rely on.
describe("demo event catalogue", () => {
  it("every entry has a label, group, schema and build", () => {
    for (const type of DEMO_EVENT_TYPES) {
      const def = DEMO_EVENT_DEFS[type];
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.group.length).toBeGreaterThan(0);
      expect(typeof def.build).toBe("function");
      expect(def.schema).toBeDefined();
    }
  });
});
