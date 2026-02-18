import { boot } from 'quasar/wrappers';
import { createAuth0 } from '@auth0/auth0-vue';

export default boot(({ app }) => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isSecureOrigin = window.location.protocol === 'https:' || isLocalhost;

  if (!isSecureOrigin) {
    console.warn(
      '[Auth0] Skipping Auth0 init on insecure origin:',
      window.location.origin
    );
    return;
  }

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    console.warn('Auth0 configuration missing. Skipping Auth0 init.');
    console.warn('Required environment variables:');
    console.warn('- VITE_AUTH0_DOMAIN');
    console.warn('- VITE_AUTH0_CLIENT_ID');
    if (!import.meta.env.DEV) {
      throw new Error('Auth0 domain and client ID must be set in .env file');
    }
    return;
  }

  app.use(
    createAuth0({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        scope: 'openid email profile',
        ...(audience ? { audience } : {}),
      },
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
    })
  );
});
