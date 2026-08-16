import { Middlewares } from '@omni-infra/express';

import type { TResponseNixeryListItem } from '../-api-types';
import { listNixeryDefIds, readNixeryDef } from '../-read-nixery-def';

export const listNixery = [
  Middlewares.Chainable
    .next(async (express) => {
      const ids = await listNixeryDefIds();
      const items: TResponseNixeryListItem[] = [];

      for (const id of ids) {
        try {
          const { def, path } = await readNixeryDef(id);

          items.push({
            description: def.description,
            id,
            path,
          });
        } catch {
          continue;
        }
      }

      express.respondMany<TResponseNixeryListItem>(items);
    })
    .toMiddleware(),
];
