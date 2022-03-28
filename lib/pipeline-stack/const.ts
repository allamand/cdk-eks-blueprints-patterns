import {ApplicationRepository, ArgoCDAddOnProps, NginxAddOnProps} from '@aws-quickstart/ssp-amazon-eks';

export const KUBECOST_TOKEN = 'c2FsbGFtYW5AYW1hem9uLmZyxm343yadf98';

const gitUrl = 'https://github.com/allamand/ssp-eks-workloads.git';
const SECRET_ARGO_ADMIN_PWD = 'argo-admin-secret';

export const bootstrapRepo: ApplicationRepository = {
  repoUrl: gitUrl,
  targetRevision: 'main',
  credentialsSecretName: 'github-ssp',
  credentialsType: 'TOKEN',
};
export const devbootstrapRepo: ApplicationRepository = {
  ...bootstrapRepo,
  path: 'envs/dev',
};
export const testbootstrapRepo: ApplicationRepository = {
  ...bootstrapRepo,
  path: 'envs/test',
};
export const prodbootstrapRepo: ApplicationRepository = {
  ...bootstrapRepo,
  path: 'envs/prod',
};
export const argoCDAddOnProps: ArgoCDAddOnProps = {
  namespace: 'argocd',
  adminPasswordSecretName: SECRET_ARGO_ADMIN_PWD,
  values: {
    server: {
      extraArgs: ['--insecure'],
    },
  },
};

export const nginxAddOnProps: NginxAddOnProps = {
  internetFacing: true,
  backendProtocol: 'tcp',
  crossZoneEnabled: false,
};
