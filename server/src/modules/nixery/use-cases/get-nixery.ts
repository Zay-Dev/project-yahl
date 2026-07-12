import { Middlewares } from '@omni-infra/express';

import type { TResponseNixeryDef } from '../-api-types';
import { readNixeryDef } from '../-read-nixery-def';

export const getNixery = [
  Middlewares.Chainable
    .next(async (express) => {
      const defId = express.req.params.defId?.trim();

      if (!defId) {
        throw errors.badRequest('defId required');
      }

      const result = await readNixeryDef(defId);

      express.respondOne<TResponseNixeryDef>({
        def: result.def as unknown as Record<string, unknown>,
        id: result.id,
        path: result.path,
      });
    })
    .toMiddleware(),
];
