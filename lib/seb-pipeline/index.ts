import * as blueprints from '@aws-quickstart/eks-blueprints';
import { utils } from '@aws-quickstart/eks-blueprints';
import { KubecostAddOn } from '@kubecost/kubecost-eks-blueprints-addon';
import { StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from 'constructs';
import { KubeOpsViewAddOn } from '../apps/kube-ops-view';
import { KyvernoAddOn, KyvernoPoliciesAddOn } from '../apps/kyverno';
// Team implementations
import * as team from '../teams';
import * as c from './const';
import { argoCDAddOnProps, devbootstrapRepo, nginxAddOnProps, prodbootstrapRepo, testbootstrapRepo } from './const';

const burnhamManifestDir = './lib/teams/team-burnham/';
const rikerManifestDir = './lib/teams/team-riker/';

export default class PipelineConstruct {
  async buildAsync(scope: Construct, props?: StackProps) {
    // await _prevalidateSecrets();

    const account = process.env.CDK_DEFAULT_ACCOUNT!;

    // Teams for the cluster.
    const teams: Array<blueprints.Team> = [
      new team.TeamPlatform(account),
      new team.TeamTroiSetup(),
      new team.TeamRikerSetup(scope, rikerManifestDir),
      new team.TeamBurnhamSetup(scope, burnhamManifestDir),
    ];

    const devSubdomain: string = utils.valueFromContext(scope, 'dev.subzone.name', 'dev.eks.demo3.allamand.com');
    const testSubdomain: string = utils.valueFromContext(scope, 'test.subzone.name', 'test.eks.demo3.allamand.com');
    const prodSubdomain: string = utils.valueFromContext(scope, 'prod.subzone.name', 'prod.eks.demo3.allamand.com');
    const parentDomain = utils.valueFromContext(scope, 'parent.hostedzone.name', 'eks.demo3.allamand.com');

    const clusterVersion = eks.KubernetesVersion.V1_21;

    const blueMNG = new blueprints.MngClusterProvider({
      id: 'primary-mng-blue',
      version: clusterVersion,
      minSize: 1,
      maxSize: 100,
      nodeGroupCapacityType: eks.CapacityType.SPOT,
      instanceTypes: [
        new ec2.InstanceType('m5.2xlarge'),
        new ec2.InstanceType('m5a.2xlarge'),
        new ec2.InstanceType('m5ad.2xlarge'),
        new ec2.InstanceType('m5d.2xlarge'),
      ],
    });
    blueMNG; // to avoid declre but not used issue
    const greenMNG = new blueprints.MngClusterProvider({
      id: 'primary-mng-green',
      version: clusterVersion,
      minSize: 1,
      maxSize: 100,
      nodeGroupCapacityType: eks.CapacityType.SPOT,
      instanceTypes: [
        new ec2.InstanceType('m5.xlarge'),
        new ec2.InstanceType('m5a.xlarge'),
        new ec2.InstanceType('m5ad.xlarge'),
        new ec2.InstanceType('m5d.xlarge'),
      ],
    });
    greenMNG; // to avoid declre but not used issue

    const blueprint = blueprints.EksBlueprint.builder()
      .account(account)
      .region('eu-west-1')
      .teams(...teams)
      .resourceProvider(blueprints.GlobalResources.HostedZone, new blueprints.LookupHostedZoneProvider(parentDomain))
      .clusterProvider(
        // blueMNG,
        greenMNG,
      )
      .addOns(
        new blueprints.VpcCniAddOn(),
        new blueprints.CoreDnsAddOn(),
        new blueprints.AwsLoadBalancerControllerAddOn(),
        new blueprints.AppMeshAddOn({
          enableTracing: true,
        }),
        new blueprints.SSMAgentAddOn(),
        new blueprints.ExternalDnsAddOn({
          hostedZoneResources: [blueprints.GlobalResources.HostedZone], // you can add more if you register resource providers
        }),
        new KubecostAddOn({
          kubecostToken: c.KUBECOST_TOKEN,
        }),
        //new blueprints.SecretsStoreAddOn({rotationPollInterval: '120s'}),
        new blueprints.CalicoAddOn(),
        new blueprints.MetricsServerAddOn(),
        new blueprints.ContainerInsightsAddOn(),
        new blueprints.XrayAddOn(),
        new blueprints.SecretsStoreAddOn(),
        new KubeOpsViewAddOn(),
        new KyvernoAddOn(),
        new KyvernoPoliciesAddOn(),
      );

    blueprints.CodePipelineStack.builder()
      .name('blueprints-eks-pipeline')
      .owner('allamand')
      .repository({
        repoUrl: 'blueprints-eks-patterns',
        credentialsSecretName: 'github-token',
        targetRevision: 'main',
      })
      .stage({
        id: 'blueprints-dev',
        stackBuilder: blueprint
          .clone('eu-west-3')
          .resourceProvider(
            blueprints.GlobalResources.Certificate,
            new blueprints.CreateCertificateProvider(
              'wildcard-cert',
              `*.${devSubdomain}`,
              blueprints.GlobalResources.HostedZone,
            ),
          )
          .addOns(
            new blueprints.ArgoCDAddOn({
              ...argoCDAddOnProps,
              ...{ bootstrapRepo: devbootstrapRepo },
            }),
            new blueprints.addons.KarpenterAddOn(),
            new blueprints.NginxAddOn({
              ...nginxAddOnProps,
              externalDnsHostname: devSubdomain,
              certificateResourceName: blueprints.GlobalResources.Certificate,
            }),
          ),
      })

      .stage({
        id: 'blueprints-test',
        stackBuilder: blueprint
          .clone('us-east-2')
          .resourceProvider(
            blueprints.GlobalResources.Certificate,
            new blueprints.CreateCertificateProvider(
              'wildcard-cert',
              `*.${testSubdomain}`,
              blueprints.GlobalResources.HostedZone,
            ),
          )
          .addOns(
            new blueprints.ArgoCDAddOn({
              ...argoCDAddOnProps,
              ...{ bootstrapRepo: testbootstrapRepo },
            }),
            //ERROR Values are not supported by the add-on
            new blueprints.ClusterAutoScalerAddOn({ values: { extraArgs: { 'scale-down-unneeded-time': '10s' } } }),
            new blueprints.NginxAddOn({
              ...nginxAddOnProps,
              externalDnsHostname: testSubdomain,
              certificateResourceName: blueprints.GlobalResources.Certificate,
            }),
          ),
        stageProps: {
          pre: [new blueprints.pipelines.cdkpipelines.ManualApprovalStep('manual-approval')],
        },
      })

      .stage({
        id: 'blueprints-prod',
        stackBuilder: blueprint
          .clone('eu-west-1')
          .resourceProvider(
            blueprints.GlobalResources.Certificate,
            new blueprints.CreateCertificateProvider(
              'wildcard-cert',
              `*.${prodSubdomain}`,
              blueprints.GlobalResources.HostedZone,
            ),
          )
          .addOns(
            new blueprints.ArgoCDAddOn({
              ...argoCDAddOnProps,
              ...{ bootstrapRepo: prodbootstrapRepo },
            }),
            new blueprints.addons.KarpenterAddOn(),
            new blueprints.NginxAddOn({
              ...nginxAddOnProps,
              externalDnsHostname: prodSubdomain,
              certificateResourceName: blueprints.GlobalResources.Certificate,
            }),
          ),
        stageProps: {
          pre: [new blueprints.pipelines.cdkpipelines.ManualApprovalStep('manual-approval')],
        },
      })
      //.build(scope, 'ssp-pipeline-stack', props);
      .build(scope, 'blueprints-pipeline-stack', props);
  }

  async _prevalidateSecrets() {
    try {
      //await blueprints.utils.validateSecret('github-token', 'us-east-2');
      //await blueprints.utils.validateSecret('github-token', 'us-west-1');

      await blueprints.utils.validateSecret('github-blueprints', 'us-east-2');
      await blueprints.utils.validateSecret('github-blueprints', 'eu-west-1');
      await blueprints.utils.validateSecret('github-blueprints', 'eu-west-3');

      await blueprints.utils.validateSecret('argo-admin-secret', 'us-east-2');
      await blueprints.utils.validateSecret('argo-admin-secret', 'eu-west-1');
      await blueprints.utils.validateSecret('argo-admin-secret', 'eu-west-3');
    } catch (error) {
      throw new Error(`github-token secret must be setup in AWS Secrets Manager for the GitHub pipeline.
            The GitHub Personal Access Token should have these scopes:
            * **repo** - to read the repository
            * * **admin:repo_hook** - if you plan to use webhooks (true by default)
            * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/GitHub-create-personal-token-CLI.html`);
    }
  }
}
