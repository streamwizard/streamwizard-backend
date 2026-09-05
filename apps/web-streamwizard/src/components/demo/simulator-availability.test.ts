import { expect, test } from "bun:test";
import {
  MIN_LIVE_INTERVAL_MS,
  TOO_FAST_FOR_LIVE_HINT,
  simulatorItemState,
} from "./simulator-availability";

const description = "Walks a GPS point along a route";

test("local runs any interval", () => {
  expect(
    simulatorItemState({ mode: "local", running: false, intervalMs: 50, description })
  ).toEqual({ disabled: false, hint: description });
});

test("live allows the cap itself", () => {
  expect(
    simulatorItemState({
      mode: "live",
      running: false,
      intervalMs: MIN_LIVE_INTERVAL_MS,
      description,
    })
  ).toEqual({ disabled: false, hint: description });
});

test("live refuses anything faster than the cap and says why", () => {
  expect(
    simulatorItemState({
      mode: "live",
      running: false,
      intervalMs: MIN_LIVE_INTERVAL_MS - 1,
      description,
    })
  ).toEqual({ disabled: true, hint: TOO_FAST_FOR_LIVE_HINT });
});

test("a running simulator can always be stopped", () => {
  expect(
    simulatorItemState({
      mode: "live",
      running: true,
      intervalMs: MIN_LIVE_INTERVAL_MS - 1,
      description,
    })
  ).toEqual({ disabled: false, hint: description });
});
