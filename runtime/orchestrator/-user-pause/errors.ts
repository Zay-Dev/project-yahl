export class UserPausedError extends Error {
  constructor(message = 'user pause requested') {
    super(message);
    this.name = 'UserPausedError';
  }
}
