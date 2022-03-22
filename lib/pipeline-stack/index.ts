import { InstanceType } from '@aws-cdk/aws-ec2';
import { CapacityType, KubernetesVersion } from '@aws-cdk/aws-eks';
import * as cdk from '@aws-cdk/core';
import { StackProps } from '@aws-cdk/core';
// SSP Lib
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import {
  ApplicationRepository,
  ArgoCDAddOnProps,
  GlobalResources,
  MngClusterProvider,
  NginxAddOnProps,
} from '@aws-quickstart/ssp-amazon-eks';
import { valueFromContext } from '@aws-quickstart/ssp-amazon-eks/dist/utils/context-utils';
import { getSecretValue } from '@aws-quickstart/ssp-amazon-eks/dist/utils/secrets-manager-utils';
import { KubecostAddOn } from '@kubecost/kubecost-ssp-addon';
import { KubeOpsViewAddOn } from '../apps/kube-ops-view';

import * as team from '../teams';
import * as c from './const';

const burnhamManifestDir = './lib/teams/team-burnham/';
const rikerManifestDir = './lib/teams/team-riker/';

const gitUrl = 'https://github.com/allamand/ssp-eks-workloads.git';
const SECRET_ARGO_ADMIN_PWD = 'argo-admin-secret';

export default class PipelineConstruct {
  async buildAsync(scope: cdk.Construct, id: string, props?: StackProps) {
    try {
      await getSecretValue('github-ssp', 'us-east-2');
      await getSecretValue('github-ssp', 'eu-west-1');
      await getSecretValue('github-ssp', 'eu-west-3');

      await getSecretValue('argo-admin-secret', 'us-east-2');
      await getSecretValue('argo-admin-secret', 'eu-west-1');
      await getSecretValue('argo-admin-secret', 'eu-west-3');
    } catch (error) {
      throw new Error(`github-token secret must be setup in AWS Secrets Manager for the GitHub pipeline.
            The GitHub Personal Access Token should have these scopes:
            * **repo** - to read the repository
            * * **admin:repo_hook** - if you plan to use webhooks (true by default)
            * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/GitHub-create-personal-token-CLI.html`);
    }

    const account = process.env.CDK_DEFAULT_ACCOUNT!;

    // Teams for the cluster.
    const teams: Array<ssp.Team> = [
      new team.TeamPlatform(account),
      new team.TeamTroiSetup(),
      new team.TeamRikerSetup(scope, rikerManifestDir),
      new team.TeamBurnhamSetup(scope, burnhamManifestDir),
    ];

    const devSubdomain: string = valueFromContext(scope, 'dev.subzone.name', 'dev.eks.demo3.allamand.com');
    const testSubdomain: string = valueFromContext(scope, 'test.subzone.name', 'test.eks.demo3.allamand.com');
    const prodSubdomain: string = valueFromContext(scope, 'prod.subzone.name', 'prod.eks.demo3.allamand.com');

    const parentDomain = valueFromContext(scope, 'parent.hostedzone.name', 'eks.demo3.allamand.com');

    const blueprint = ssp.EksBlueprint.builder()
      .account(account) // the supplied default will fail, but build and synth will pass
      .region('eu-west-1')
      .teams(...teams)
      .resourceProvider(GlobalResources.HostedZone, new ssp.LookupHostedZoneProvider(parentDomain))
      .clusterProvider(
        //ATTENTION only the last clusterProvider is applied actually
        new MngClusterProvider({
          desiredSize: 1,
          maxSize: 3,
          minSize: 1,
          version: KubernetesVersion.V1_20,
          nodeGroupCapacityType: CapacityType.ON_DEMAND,
          instanceTypes: [new InstanceType('m5.xlarge')],
        }),
      )
      .clusterProvider(
        //ATTENTION only the last clusterProvider is applied actually
        new MngClusterProvider({
          desiredSize: 3,
          maxSize: 20,
          minSize: 1,
          version: KubernetesVersion.V1_20,
          nodeGroupCapacityType: CapacityType.SPOT,
          instanceTypes: [
            //new InstanceType('m4.xlarge'),
            new InstanceType('m5.xlarge'),
            new InstanceType('m5a.xlarge'),
            new InstanceType('m5ad.xlarge'),
            new InstanceType('m5d.xlarge'),
            new InstanceType('t2.xlarge'),
            new InstanceType('t3.xlarge'),
            new InstanceType('t3a.xlarge'),
          ],
        }),
      )
      // .clusterProvider(
      //   new ssp.FargateClusterProvider({
      //     fargateProfiles,
      //     version: KubernetesVersion.V1_20,
      //   })
      // )
      .addOns(
        //new wego.WeaveGitOpsAddOn(bootstrapRepository, 'wego-system'),
        new ssp.AwsLoadBalancerControllerAddOn(),
        new ssp.AppMeshAddOn({
          enableTracing: true,
        }),
        new ssp.SSMAgentAddOn(), // this is added to deal with PVRE as it is adding correct role to the node group, otherwise stack destroy won't work

        new ssp.addons.ExternalDnsAddon({
          hostedZoneResources: [GlobalResources.HostedZone], // you can add more if you register resource providers
        }),
        new KubecostAddOn({
          kubecostToken: c.KUBECOST_TOKEN,
        }),
        new ssp.CalicoAddOn(),
        new ssp.MetricsServerAddOn(),
        //new ssp.ClusterAutoScalerAddOn(),
        new ssp.addons.KarpenterAddOn(),
        new ssp.ContainerInsightsAddOn(),
        new ssp.XrayAddOn(),
        new ssp.SecretsStoreAddOn(),
        new KubeOpsViewAddOn(),
      );

    const bootstrapRepo = {
      repoUrl: gitUrl,
      targetRevision: 'main',
      credentialsSecretName: 'github-ssp',
      credentialsType: 'TOKEN',
    };
    const devbootstrapRepo = {
      ...bootstrapRepo,
      path: 'envs/dev',
    };
    const argoCDAddOnProps: ArgoCDAddOnProps = {
      namespace: 'argocd',
      adminPasswordSecretName: SECRET_ARGO_ADMIN_PWD,
    };
    const devArgoCDAddOnProps = {
      ...argoCDAddOnProps,
      ...{ ...bootstrapRepo, ...{ path: 'envs/dev' } },
    };

    const testArgoCDAddOnProps = {
      ...argoCDAddOnProps,
      ...{ ...bootstrapRepo, ...{ path: 'envs/test' } },
    };

    const prodArgoCDAddOnProps = {
      ...argoCDAddOnProps,
      ...{ ...bootstrapRepo, ...{ path: 'envs/prod' } },
    };

    const nginxAddOnProps: NginxAddOnProps = {
      internetFacing: true,
      backendProtocol: 'tcp',
      // externalDnsHostname: devSubdomain,
      crossZoneEnabled: false,
      // certificateResourceName: GlobalResources.Certificate,
      values: {
        controller: {
          service: {
            httpsPort: {
              targetPort: 'http',
            },
          },
        },
      },
    };

    ssp.CodePipelineStack.builder()
      .name('ssp-eks-pipeline')
      .owner('allamand')
      .repository({
        repoUrl: 'ssp-eks-patterns',
        credentialsSecretName: 'github-token',
        targetRevision: 'main',
      })
      .stage({
        id: 'ssp-dev',
        stackBuilder: blueprint
          .clone('eu-west-3')
          .resourceProvider(
            GlobalResources.Certificate,
            new ssp.CreateCertificateProvider('wildcard-cert', `*.${devSubdomain}`, GlobalResources.HostedZone),
          )
          .addOns(
            new ssp.ArgoCDAddOn({
              //...argoCDAddOnProps,
              //...devbootstrapRepo,
              // namespace: 'argocd',
              // adminPasswordSecretName: SECRET_ARGO_ADMIN_PWD,
              // bootstrapRepo: {
              //   repoUrl: gitUrl,
              //   targetRevision: 'main',
              //   path: 'envs/dev',
              //   credentialsSecretName: 'github-ssp',
              //   credentialsType: 'TOKEN',
              // },
            }),
            new ssp.NginxAddOn({
              // ...nginxAddOnProps,
              internetFacing: true,
              backendProtocol: 'tcp',
              crossZoneEnabled: false,
              values: {
                controller: {
                  service: {
                    httpsPort: {
                      targetPort: 'http',
                    },
                  },
                },
              },
              externalDnsHostname: devSubdomain,
              certificateResourceName: GlobalResources.Certificate,
            }),
          ),
      })

      .stage({
        id: 'ssp-test',
        stackBuilder: blueprint
          .clone('us-east-2')
          .resourceProvider(
            GlobalResources.Certificate,
            new ssp.CreateCertificateProvider('wildcard-cert', `*.${testSubdomain}`, GlobalResources.HostedZone),
          )
          .addOns(
            new ssp.ArgoCDAddOn(testArgoCDAddOnProps),
            new ssp.NginxAddOn({
              ...nginxAddOnProps,
              externalDnsHostname: testSubdomain,
              certificateResourceName: GlobalResources.Certificate,
            }),
          ),
        stageProps: {
          pre: [new ssp.pipelines.cdkpipelines.ManualApprovalStep('manual-approval')],
        },
      })

      .stage({
        id: 'ssp-prod',
        stackBuilder: blueprint
          .clone('eu-west-1')
          .resourceProvider(
            GlobalResources.Certificate,
            new ssp.CreateCertificateProvider('wildcard-cert', `*.${prodSubdomain}`, GlobalResources.HostedZone),
          )
          .addOns(
            new ssp.ArgoCDAddOn(prodArgoCDAddOnProps),
            new ssp.NginxAddOn({
              ...nginxAddOnProps,
              values: {
                controller: {
                  service: {
                    httpsPort: {
                      targetPort: 'http',
                    },
                  },
                },
              },
              externalDnsHostname: prodSubdomain,
              certificateResourceName: GlobalResources.Certificate,
            }),
          ),
        stageProps: {
          pre: [new ssp.pipelines.cdkpipelines.ManualApprovalStep('manual-approval')],
        },
      })
      .build(scope, 'ssp-pipeline-stack', props);
  }
}
