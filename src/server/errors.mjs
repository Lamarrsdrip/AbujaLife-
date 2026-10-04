export class GameError extends Error {
  constructor(message, status = 400, code = 'invalid_action') { super(message); this.status = status; this.code = code; }
}
