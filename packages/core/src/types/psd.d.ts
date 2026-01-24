declare module "psd" {
  interface PsdImage {
    toPng(): Promise<{ data: Uint8Array | Buffer }>;
  }

  interface PsdInstance {
    parse(): Promise<void>;
    image: PsdImage;
  }

  interface PsdConstructor {
    new (data: Uint8Array | Buffer): PsdInstance;
  }

  const PSD: PsdConstructor;
  export default PSD;
}
