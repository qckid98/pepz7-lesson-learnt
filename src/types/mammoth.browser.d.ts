declare module "mammoth/mammoth.browser" {
  export interface ConvertResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  export interface ConvertOptions {
    arrayBuffer: ArrayBuffer;
    styleMap?: string[];
  }
  export function convertToHtml(
    options: ConvertOptions,
    converterOptions?: { styleMap?: string[] }
  ): Promise<ConvertResult>;
  export function extractRawText(options: ConvertOptions): Promise<ConvertResult>;
}
