declare module 'tweetnacl-util' {
  export function encodeBase64(bytes: Uint8Array): string;
  export function decodeBase64(value: string): Uint8Array;
  export function encodeUTF8(bytes: Uint8Array): string;
  export function decodeUTF8(value: string): Uint8Array;
}
