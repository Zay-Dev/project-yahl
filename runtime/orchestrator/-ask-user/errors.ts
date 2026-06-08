export class AskUserPausedError extends Error {
  constructor(message = 'ask_user paused for user answer') {
    super(message);
    this.name = 'AskUserPausedError';
  }
}
