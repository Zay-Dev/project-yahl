import { Middlewares } from '@omni-infra/express';

import type { TResponseNixeryListItem } from '../-api-types';
import { listNixeryDefIds, readNixeryDef } from '../-read-nixery-def';
import { nixeryIndexRelativePath } from '../-nixery-root';

export const listNixery = [
  Middlewares.Chainable
    .next(async (express) => {
      const ids = await listNixeryDefIds();
      const items: TResponseNixeryListItem[] = [];

      for (const id of ids) {
        try {
          const { def } = await readNixeryDef(id);

          items.push({
            description: def.description,
            id,
            path: nixeryIndexRelativePath(id),
          });
        } catch {
          continue;
        }
      }

      express.respondMany<TResponseNixeryListItem>(items);
    })
    .toMiddleware(),
];
