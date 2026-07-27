/**
 * Channel message sanitizer hook.
 * Mount a custom file over /sanitize/sanitize-channel-message.mjs (see docker-compose SANITIZE_CHANNEL_MESSAGE).
 *
 * @param {Record<string, unknown>} message
 * @returns {Promise<Record<string, unknown>> | Record<string, unknown>}
 */
export const sanitizeChannelMessage = async (message) => {
  console.log(
    'skipped channel sanitization, this is the default ${SANITIZE_CHANNEL_MESSAGE:-./worker/sanitize-channel-message.mjs}:/sanitize/sanitize-channel-message.mjs:ro, override it to use your sanitizer',
  );

  return message;
};
