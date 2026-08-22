import { exposedRoute } from '@/servers';

import { getCronJob, listCronJobs } from './use-cases/cron-read';
import { createCronJob, deleteCronJob, updateCronJob } from './use-cases/cron-write';
import { getKnowledgeManagerInstruction } from './use-cases/knowledge-instruction-read';
import { putKnowledgeManagerInstruction } from './use-cases/knowledge-instruction-write';
import {
  approveProposal,
  createKnowledgeTransferProposal,
  createNotificationProposal,
  createSettingProposal,
  listPendingProposals,
  rejectProposal,
} from './use-cases/proposal-write';
import {
  applySettingProposal,
  listPendingWork,
  markKnowledgeTransferDone,
  markNotificationDone,
  markSettingDone,
} from './use-cases/work-read';
import { getWhatsAppChannel } from './use-cases/channel-whatsapp-read';
import { putWhatsAppChannel } from './use-cases/channel-whatsapp-write';

exposedRoute('/api/platform/proposals/notifications')
  .post('/', createNotificationProposal);

exposedRoute('/api/platform/proposals/settings')
  .post('/', createSettingProposal)
  .post('/:id/apply', applySettingProposal);

exposedRoute('/api/platform/proposals/knowledge-transfers')
  .post('/', createKnowledgeTransferProposal);

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

exposedRoute('/api/platform/work/knowledge-transfer')
  .post('/:id/done', markKnowledgeTransferDone);

exposedRoute('/api/platform/cron/jobs')
  .get('/', listCronJobs)
  .post('/', createCronJob)
  .get('/:id', getCronJob)
  .patch('/:id', updateCronJob)
  .delete('/:id', deleteCronJob);

exposedRoute('/api/platform/knowledge-manager-instruction')
  .get('/', getKnowledgeManagerInstruction)
  .put('/', putKnowledgeManagerInstruction);

exposedRoute('/api/platform/channels')
  .get('/whatsapp', getWhatsAppChannel);

exposedRoute('/api/platform/internal')
  .put('/whatsapp', putWhatsAppChannel);
