import { ApplicationRepository, ArgoCDAddOnProps, NginxAddOnProps } from '@aws-quickstart/eks-blueprints';

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

export const karpenterAddonProp = {
  // provisionerSpecs: {
  //   'node.kubernetes.io/instance-type': ['m5.2xlarge'],
  //   'topology.kubernetes.io/zone': ['us-east-1c'],
  //   'kubernetes.io/arch': ['amd64','arm64'],
  //   'karpenter.sh/capacity-type': ['spot','on-demand'],
  // },
  subnetTags: {
    'kubernetes.io/cluster/blueprints-dev-blueprint': '1',
  },
  securityGroupTags: {
    'kubernetes.io/cluster/blueprints-dev-blueprint': 'owned',
  },
};
