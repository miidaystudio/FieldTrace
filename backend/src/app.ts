import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { generateOpenApiDocument } from './lib/openapi.js';
import type { ModuleRouter } from './lib/route.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { agentRoutes } from './modules/agents/agent.routes.js';
import { analyticsRoutes, reportRoutes } from './modules/analytics/analytics.routes.js';
import { anomalyRoutes } from './modules/anomalies/anomaly.routes.js';
import { assignmentRoutes } from './modules/assignments/assignment.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { locationRoutes } from './modules/locations/location.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { routeRoutes } from './modules/routing/route.routes.js';
import { organizationRoutes } from './modules/organizations/organization.routes.js';
import { teamRoutes } from './modules/teams/team.routes.js';
import {
  fleetRoutes,
  shiftRoutes,
  telemetryRoutes,
  trackRoutes,
} from './modules/tracking/tracking.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import {
  geofenceEventRoutes,
  routeAnalysisRoutes,
  visitRoutes,
} from './modules/visits/visit.routes.js';

const modules: ModuleRouter[] = [
  healthRoutes,
  authRoutes,
  organizationRoutes,
  userRoutes,
  teamRoutes,
  agentRoutes,
  locationRoutes,
  assignmentRoutes,
  auditRoutes,
  shiftRoutes,
  telemetryRoutes,
  fleetRoutes,
  trackRoutes,
  visitRoutes,
  geofenceEventRoutes,
  routeAnalysisRoutes,
  anomalyRoutes,
  analyticsRoutes,
  reportRoutes,
  notificationRoutes,
  routeRoutes,
];

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );

  // API docs: Swagger UI needs inline styles/scripts, so it gets a relaxed CSP of its own.
  const openApiDocument = generateOpenApiDocument();
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'FieldTrace API' }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      exposedHeaders: [
        'X-Request-Id',
        'RateLimit',
        'RateLimit-Policy',
        'Retry-After',
        'Content-Disposition',
      ],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  for (const module of modules) api.use(module.basePath || '/', module.router);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
