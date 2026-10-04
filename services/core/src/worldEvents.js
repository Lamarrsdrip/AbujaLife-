import { invariant } from './errors.js';
export const listActiveEvents = ({ events, districtId }) => events.filter(e => !districtId || e.district === districtId);
export const joinEvent = ({ store, events, playerId, eventId }) => {
  const event = events.find(e => e.id === eventId);
  invariant(event, 'EVENT_NOT_FOUND', 'City event does not exist.', 404);
  store.getPlayer(playerId);
  return store.joinEvent(playerId, eventId);
};
