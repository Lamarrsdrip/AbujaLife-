import { invariant } from './errors.js';

export const requestFriend = ({ store, from, to }) => {
  invariant(from !== to, 'SELF_RELATIONSHIP', 'You cannot friend yourself.');
  store.getPlayer(from); store.getPlayer(to);
  return store.setRelationship(from, to, 'pending');
};
export const acceptFriend = ({ store, playerId, otherId }) => {
  const relation = store.getRelationship(otherId, playerId);
  invariant(relation?.status === 'pending', 'FRIEND_REQUEST_NOT_FOUND', 'Friend request not found.', 404);
  store.setRelationship(otherId, playerId, 'friends');
  store.setRelationship(playerId, otherId, 'friends');
  return { playerId, otherId, status: 'friends' };
};
export const blockPlayer = ({ store, playerId, otherId }) => {
  invariant(playerId !== otherId, 'SELF_RELATIONSHIP', 'You cannot block yourself.');
  store.getPlayer(playerId); store.getPlayer(otherId);
  store.setRelationship(playerId, otherId, 'blocked');
  return { playerId, otherId, status: 'blocked' };
};
