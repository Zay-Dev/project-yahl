import { exposedRoute } from '@/servers';

import { getNixery } from './use-cases/get-nixery';
import { listNixery } from './use-cases/list-nixery';

exposedRoute('/api/nixery')
  .get('/', listNixery)
  .get('/:defId', getNixery);
