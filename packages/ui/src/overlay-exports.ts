export * from "./components/overlay/types";
export type {
  OverlayEventType,
  OverlaySocketMessage,
  BotBroadcastMessage,
  StreamWizardEventType,
} from "@repo/types";
export * from "./components/overlay/widget-definition";
export {
  MIN_ITEM_SCALE,
  MAX_ITEM_SCALE,
  MIN_SOURCE_SIZE,
  NO_CROP,
  getDesignSize,
  getCropInsets,
  getSourceSize,
  hasCrop,
  getItemScale,
  applyScale,
  clampScale,
  clampCrop,
  type Size,
  type CropInsets,
} from "./components/overlay/lib/item-scale";
export {
  ANCHOR_X_VALUES,
  ANCHOR_Y_VALUES,
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
  getAnchor,
  isAnchored,
  isAnchorX,
  isAnchorY,
  resolveAnchoredPosition,
  toAnchoredOffset,
  withAbsolutePosition,
  type Anchor,
  type AnchorX,
  type AnchorY,
} from "./components/overlay/lib/item-anchor";
export { itemFlipTransform, itemTransform } from "./components/overlay/lib/item-flip";
export { WidgetScaleFrame } from "./components/overlay/WidgetScaleFrame";
export { formatCountdownMs } from "./components/overlay/lib/format-countdown";
export { formatClockWidgetDisplay } from "./components/overlay/lib/format-clock-widget";
export {
  formatClipDuration,
  formatClipDate,
  formatClipViewCount,
  formatClipField,
  type ClipFieldData,
} from "./components/overlay/lib/format-clip-fields";
export {
  useGoogleFont,
  useGoogleFonts,
} from "./components/overlay/hooks/use-google-font";
export { TextWidgetRenderer } from "./components/overlay/widgets/text/TextWidgetRenderer";
export { TimerWidgetRenderer } from "./components/overlay/widgets/timer/TimerWidgetRenderer";
export { ClockWidgetRenderer } from "./components/overlay/widgets/clock/ClockWidgetRenderer";
export { ClipsWidgetRenderer } from "./components/overlay/widgets/clips/ClipsWidgetRenderer";
export type {
  ClipsWidgetRendererProps,
  NextClipResult,
  ClipRotationCursor,
} from "./components/overlay/widgets/clips/ClipsWidgetRenderer";
export type { WidgetRenderProps } from "./components/overlay/widgets/text/TextWidgetRenderer";
export {
  textWidgetBaseDefinition,
  TEXT_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/text/text-widget-definition";
export {
  timerWidgetBaseDefinition,
  TIMER_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/timer/timer-widget-definition";
export {
  clockWidgetBaseDefinition,
  CLOCK_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/clock/clock-widget-definition";
export {
  clipsWidgetBaseDefinition,
  CLIPS_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/clips/clips-widget-definition";
export {
  IrlFieldWidgetRenderer,
  IRL_FIELD_WIDGET_DEFAULT_SIZE,
  collectIrlFieldFontFamilies,
  DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG,
} from "./components/overlay/widgets/irl/irl-field-widget-definition";
export type { IrlFieldWidgetRendererProps } from "./components/overlay/widgets/irl/IrlFieldWidgetRenderer";
export {
  useIrlGeoData,
  type IrlConnectionStatus,
} from "./components/overlay/widgets/irl/use-irl-geo-data";
export {
  subscribeToWsRoom,
  subscribeToWsRoomWith,
  wsStatusFromMessage,
  type WsEventListener,
  type WsRoomOptions,
  type WsRoomStatus,
} from "./components/overlay/lib/ws-store";
export {
  ALERT_EVENT_TYPES,
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_EVENT_LABELS,
  ALERT_AMOUNT_LABELS,
  ALERT_NAME_LABELS,
  ALERT_DEFAULT_ON_EVENTS,
  ALERT_MESSAGE_EVENTS,
  ALERT_GIFTER_EVENTS,
  ALERT_DETAIL_TOKENS,
  ALERT_LAYOUTS,
  ALERT_DURATION_MODES,
  ALERT_ANIMATIONS_IN,
  ALERT_ANIMATIONS_OUT,
  ALERT_TEST_BROWSER_EVENT,
  DEFAULT_ALERT_VARIANT_TITLES,
  createDefaultAlertWidgetConfig,
  createDefaultAlertVariantConfig,
  normalizeAlertWidgetConfig,
  alertInstanceFromSocketMessage,
  alertSkipReason,
  renderAlertTemplate,
  alertAmountText,
  buildTestAlertSocketMessage,
  type AlertEventType,
  type AlertEventCategoryId,
  type AlertMediaKind,
  type AlertLayout,
  type AlertAnimationIn,
  type AlertAnimationOut,
  type AlertDurationMode,
  type AlertVariantConfig,
  type AlertWidgetItemConfig,
  type AlertInstance,
  type AlertSkipReason,
  type AlertTestBrowserEventDetail,
} from "./components/overlay/widgets/alert/alert-widget-config";
export { AlertWidgetRenderer } from "./components/overlay/widgets/alert/AlertWidgetRenderer";
export type { AlertWidgetRendererProps } from "./components/overlay/widgets/alert/AlertWidgetRenderer";
export {
  alertWidgetBaseDefinition,
  ALERT_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/alert/alert-widget-definition";
export {
  resolveWidgetTemplate,
  buildWidgetSrcdoc,
  mergeFieldValues,
  ASSET_FIELD_TYPES,
  isAssetFieldType,
  GROUP_FIELD_TYPE,
  isGroupFieldDef,
  flattenFieldSchema,
  type WidgetFieldDef,
  type WidgetFieldSchema,
} from "./components/overlay/lib/resolve-widget-template";
export {
  WIDGET_SIMULATORS,
  WIDGET_SIMULATOR_IDS,
  type SimulatorDef,
  type SimulatorEmit,
} from "./components/overlay/lib/widget-simulators";
export {
  scanWidgetListeners,
  type WidgetListenerScan,
} from "./components/overlay/lib/detect-widget-listeners";
export {
  OverlaySceneCanvas,
  type OverlayWidgetProps,
  type OverlayWidgetRegistration,
} from "./components/overlay/OverlaySceneCanvas";
export {
  CustomWidgetIframe,
  type CustomWidgetIframeHandle,
  type CustomWidgetIframeProps,
  type WidgetLogEntry,
} from "./components/overlay/CustomWidgetIframe";
