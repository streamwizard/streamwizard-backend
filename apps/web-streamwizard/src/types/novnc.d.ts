declare module "@novnc/novnc" {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      options?: { credentials?: { username?: string; password?: string; target?: string } } & Record<string, unknown>,
    );
    scaleViewport: boolean;
    resizeSession: boolean;
    disconnect(): void;
    clipboardPasteFrom(text: string): void;
    addEventListener(type: string, listener: (event: CustomEvent) => void): void;
    removeEventListener(type: string, listener: (event: CustomEvent) => void): void;
  }
}
