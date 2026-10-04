import { id } from './id.js';
import { invariant } from './errors.js';
export const sendMessage = ({ store, from, to, text }) => {
  store.getPlayer(from); store.getPlayer(to);
  const body = String(text ?? '').trim();
  invariant(body.length > 0 && body.length <= 1000, 'INVALID_MESSAGE', 'Message must be 1-1000 characters.');
  return store.addMessage({ id: id('msg'), from, to, text: body, createdAt: new Date().toISOString() });
};
