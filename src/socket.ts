import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from './config';

export function connect(identityKey: string): Socket {
  return io(SERVER_URL, { auth: { identityKey }, transports: ['websocket'] });
}
