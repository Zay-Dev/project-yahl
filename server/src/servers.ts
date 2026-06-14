import config from '@/config';

import http from 'http';
import { Response } from 'express';

import { Manager, Servers } from '@omni-infra/express';

export type TServerType = typeof serverTypes[number];

const requestTimeoutInSeconds = config.requestTimeoutInSeconds;
const serverTypes = ['exposed'] as const;

const {
  getOrCreateRouter,
  getRouter,
} = Manager.initialize(serverTypes);

export const [exposedRoute] =
  serverTypes.map(type => (path: string) => getOrCreateRouter(type, path));

const startServer = (serverType: TServerType) => {
  const port = config.servers.get(serverType)!.port;

  if (!serverType || !serverTypes.includes(serverType)) {
    throw getThrowable(`invalid serverType (received '${serverType}')`);
  }

  const { app } = Servers.prepareApp({
    cookieParser: { secret: config.cookieParser.secret },
    cors: {
      credentials: true,
      origin: config.corsOrigin,
    },
    doubleCsrf: false,
    frontingMiddlewares: [],
    getRouters: () => [getRouter(serverType)],
    hideErrorStack: config.hideErrorStack || undefined,
    serverType,
    uncaughtRouterErrorHandler: { requestTimeoutInSeconds },
  });

  if (!app) {
    throw getThrowable('null reference to app');
  }

  if (!port) {
    throw getThrowable(`invalid port (received '${port}')`);
  }

  return http.createServer(app)
    .listen(port, () => {
      logger.info(`listening on port ${port}`, { tags: serverType });
    });
};

export const startAll = () => {
  return serverTypes.map(serverType => ({
    server: startServer(serverType),
    serverType,
  }));
};

exposedRoute('__')
  .get('/ping', (_, res: Response) => {
    res.json({ message: 'pong', locals: res.locals });
  });
