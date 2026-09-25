// The engine compiles against lib es2022 only (no DOM), but share links use
// the base64 and UTF-8 helpers that every browser and Node 18+ provide.
// Declaring just these keeps DOM types out of a package that must stay pure.
declare function atob(data: string): string;
declare function btoa(data: string): string;
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  decode(input?: Uint8Array): string;
}
