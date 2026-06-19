import type { ErrorRequestHandler } from 'express';

export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '20mb';

export const payloadTooLargeHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.type !== 'entity.too.large') {
    next(err);
    return;
  }

  res.status(413).json({
    limit: JSON_BODY_LIMIT,
    message: 'Request body exceeds JSON size limit',
  });
};
