import { exposedRoute } from '@/servers';

import {
  createCronJob,
  listCronJobs,
} from './use-cases/cron-write';
import {
  approveProposal,
  createNotificationProposal,
  createSettingProposal,
  listPendingProposals,
  rejectProposal,
} from './use-cases/proposal-write';
import {
  applySettingProposal,
  listPendingWork,
  markNotificationDone,
  markSettingDone,
} from './use-cases/work-read';

exposedRoute('/api/platform/proposals/notifications')
  .post('/', createNotificationProposal);

exposedRoute('/api/platform/proposals/settings')
  .post('/', createSettingProposal)
  .post('/:id/apply', applySettingProposal);

exposedRoute('/api/platform/proposals')
  .get('/pending', listPendingProposals)
  .post('/:proposalId/approve', approveProposal)
  .post('/:proposalId/reject', rejectProposal);

exposedRoute('/api/platform/work')
  .get('/pending', listPendingWork);

exposedRoute('/api/platform/work/notification')
  .post('/:id/done', markNotificationDone);

exposedRoute('/api/platform/work/setting')
  .post('/:id/done', markSettingDone);

exposedRoute('/api/platform/cron/jobs')
  .get('/', listCronJobs)
  .post('/', createCronJob);
