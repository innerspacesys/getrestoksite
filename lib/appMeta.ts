export const APP_NAME = "Restok";
export const APP_VERSION = "0.1.0";
export const APP_RELEASE_DATE = "2026-04-29";
export const APP_DISPLAY_VERSION = `v${APP_VERSION}`;

export function getDeploymentSignature() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    APP_VERSION
  );
}

export function getPublicAppMeta() {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    displayVersion: APP_DISPLAY_VERSION,
    releaseDate: APP_RELEASE_DATE,
    deploymentSignature: getDeploymentSignature(),
  };
}
