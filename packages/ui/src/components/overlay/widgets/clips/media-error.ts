/**
 * A failed <video> reports nothing useful to the network tab — the proxy status
 * that caused it is invisible from the element. Surface what it does know.
 */

const MEDIA_ERROR_NAMES: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED",
  2: "MEDIA_ERR_NETWORK",
  3: "MEDIA_ERR_DECODE",
  4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
};

/**
 * A failed <video> reports nothing useful to the network tab — the proxy status
 * that caused it is invisible from the element. Surface what it does know.
 */
export function describeMediaError(el: HTMLVideoElement | null | undefined) {
  if (!el) return { reason: "no element" };
  return {
    code: el.error?.code,
    name: el.error ? MEDIA_ERROR_NAMES[el.error.code] : undefined,
    message: el.error?.message,
    networkState: el.networkState,
    readyState: el.readyState,
    src: el.currentSrc || el.src,
  };
}
