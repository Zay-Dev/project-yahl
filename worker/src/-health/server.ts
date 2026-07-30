import http from 'node:http';

import { config } from '../config.js';

let lastPollOkAt = Date.now();

type TWhatsAppHealth = {
  enabled: boolean;
  ready: boolean;
};

let getWhatsAppHealth: () => TWhatsAppHealth = () => ({
  enabled: false,
  ready: true,
});

export const configureWhatsAppHealth = (fn: () => TWhatsAppHealth): void => {
  getWhatsAppHealth = fn;
};

export const markPollSucceeded = () => {
  lastPollOkAt = Date.now();
};

export const isPollFresh = () => Date.now() - lastPollOkAt <= config.pollIntervalMs * 2;

export const getHealthStatus = () => {
  const pollFresh = isPollFresh();
  const whatsapp = getWhatsAppHealth();
  const whatsappOk = !whatsapp.enabled || whatsapp.ready;

  return {
    ok: pollFresh && whatsappOk,
    pollFresh,
    whatsappEnabled: whatsapp.enabled,
    whatsappReady: whatsapp.ready,
  };
};

export const startHealthServer = () => {
  const server = http.createServer((req, res) => {
    const path = req.url?.split('?')[0] ?? '';

    if (path !== '/health' && path !== '/') {
      res.writeHead(404).end();
      return;
    }

    const status = getHealthStatus();

    res.writeHead(status.ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  });

  server.listen(config.healthPort, '127.0.0.1', () => {
    console.log(`[worker] health listening on 127.0.0.1:${config.healthPort}`);
  });
};
