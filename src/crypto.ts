import nacl from 'tweetnacl';
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';
import * as Crypto from 'expo-crypto';

nacl.setPRNG((bytes, length) => {
  bytes.set(Crypto.getRandomBytes(length));
});

export type KeyPair = { publicKey: string; secretKey: string };
export type SealedMessage = { nonce: string; box: string };

export function generateKeyPair(): KeyPair {
  const pair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(pair.publicKey),
    secretKey: encodeBase64(pair.secretKey),
  };
}

export function encrypt(
  body: string,
  recipientPublicKey: string,
  secretKey: string,
): SealedMessage {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(
    decodeUTF8(body),
    nonce,
    decodeBase64(recipientPublicKey),
    decodeBase64(secretKey),
  );
  return { nonce: encodeBase64(nonce), box: encodeBase64(box) };
}

export function decrypt(
  sealed: SealedMessage,
  senderPublicKey: string,
  secretKey: string,
): string | null {
  const opened = nacl.box.open(
    decodeBase64(sealed.box),
    decodeBase64(sealed.nonce),
    decodeBase64(senderPublicKey),
    decodeBase64(secretKey),
  );
  return opened ? encodeUTF8(opened) : null;
}
