import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

/** Global registry. Routes register themselves here when their module is imported. */
export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Short-lived access token from /auth/login, /auth/register or /auth/refresh.',
});

registry.registerComponent('securitySchemes', 'refreshCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'ft_refresh',
  description: 'httpOnly refresh-token cookie, scoped to /api/v1/auth.',
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'FieldTrace API',
      version: '0.1.0',
      description:
        'Real-time fleet & field staff location auditing API. See docs/api-conventions.md for ' +
        'envelope, error, pagination and authentication conventions.',
    },
    servers: [{ url: '/' }],
  });
}
