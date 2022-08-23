import {InstanceType} from '@aws-cdk/aws-ec2';
import {CapacityType, KubernetesVersion} from '@aws-cdk/aws-eks';
import * as cdk from '@aws-cdk/core';
import {StackProps} from '@aws-cdk/core';
// SSP Lib
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import {AwsNodeTerminationHandlerAddOn, GlobalResources, MngClusterProvider} from '@aws-quickstart/ssp-amazon-eks';
import {valueFromContext} from '@aws-quickstart/ssp-amazon-eks/dist/utils/context-utils';
import {getSecretValue} from '@aws-quickstart/ssp-amazon-eks/dist/utils/secrets-manager-utils';
import {KubecostAddOn} from '@kubecost/kubecost-ssp-addon';
import {KubeOpsViewAddOn} from '../apps/kube-ops-view';
import { KyvernoAddOn, KyvernoPoliciesAddOn } from '../apps/kyverno';
import * as team from '../teams';
import * as c from './const';
import {argoCDAddOnProps, devbootstrapRepo, nginxAddOnProps, prodbootstrapRepo, testbootstrapRepo} from './const';

const burnhamManifestDir = './lib/teams/team-burnham/';
const rikerManifestDir = './lib/teams/team-riker/';

export default class PipelineConstruct {
  async buildAsync(scope: cdk.Construct, id: string, props?: StackProps) {
    try {
      await getSecretValue('github-ssp', 'us-east-2');
      await getSecretValue('github-ssp', 'eu-west-1');
      await getSecretValue('github-ssp', 'eu-west-3');

<<<<<<< HEAD
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
      .account(account)
      .region('eu-west-1')
      .teams(...teams)
      .resourceProvider(GlobalResources.HostedZone, new ssp.LookupHostedZoneProvider(parentDomain))
      .clusterProvider(
        new MngClusterProvider({
          id: 'updated-node-group-Spot',
          desiredSize: 3,
          maxSize: 15,
          minSize: 3,
          version: KubernetesVersion.V1_20,
          nodeGroupCapacityType: CapacityType.SPOT,
          instanceTypes: [
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
      .addOns(
        new ssp.AwsLoadBalancerControllerAddOn(),
        new ssp.AppMeshAddOn({
          enableTracing: true,
        }),
        new ssp.SSMAgentAddOn(),
        new ssp.addons.ExternalDnsAddon({
          hostedZoneResources: [GlobalResources.HostedZone], // you can add more if you register resource providers
        }),
        new KubecostAddOn({
          kubecostToken: c.KUBECOST_TOKEN,
        }),
        new ssp.CalicoAddOn(),
        new ssp.MetricsServerAddOn(),
        new ssp.ContainerInsightsAddOn(),
        new ssp.XrayAddOn(),
        new ssp.SecretsStoreAddOn(),
        new KubeOpsViewAddOn(),
        new KyvernoAddOn(),
        new KyvernoPoliciesAddOn(),
      );

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
              ...argoCDAddOnProps,
              ...{bootstrapRepo: devbootstrapRepo},
            }),
            new ssp.addons.KarpenterAddOn(),
            new ssp.NginxAddOn({
              ...nginxAddOnProps,
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
            new ssp.ArgoCDAddOn({
              ...argoCDAddOnProps,
              ...{bootstrapRepo: testbootstrapRepo},
            }),
            //ERROR Values are not supported by the add-on
            new ssp.ClusterAutoScalerAddOn({values: {extraArgs: {'scale-down-unneeded-time': '10s'}}}),
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
            new ssp.ArgoCDAddOn({
              ...argoCDAddOnProps,
              ...{bootstrapRepo: prodbootstrapRepo},
            }),
            new ssp.addons.KarpenterAddOn(),
            new ssp.NginxAddOn({
              ...nginxAddOnProps,
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
=======
    async buildAsync(scope: Construct, props?: StackProps) {
    
        await this.prevalidateSecrets();

        const account = process.env.CDK_DEFAULT_ACCOUNT!;
        const blueprint = blueprints.EksBlueprint.builder()
            .account(account) // the supplied default will fail, but build and synth will pass
            .region('us-west-1')
            .addOns(
                new blueprints.AwsLoadBalancerControllerAddOn, 
                new blueprints.NginxAddOn,
                new blueprints.ArgoCDAddOn,
                new blueprints.AppMeshAddOn( {
                    enableTracing: true
                }),
                new blueprints.SSMAgentAddOn, // this is added to deal with PVRE as it is adding correct role to the node group, otherwise stack destroy won't work
                new blueprints.CalicoAddOn,
                new blueprints.MetricsServerAddOn,
                new blueprints.ClusterAutoScalerAddOn,
                new blueprints.ContainerInsightsAddOn,
                new blueprints.XrayAddOn,
                new blueprints.SecretsStoreAddOn)
            .teams(
                new team.TeamRikerSetup(scope, teamManifestDirList[1]),
                new team.TeamBurnhamSetup(scope, teamManifestDirList[0])
            );

        blueprints.CodePipelineStack.builder()
            .name("blueprints-eks-pipeline")
            .owner("aws-samples")
            .repository({
                repoUrl: 'cdk-eks-blueprints-patterns',
                credentialsSecretName: 'github-token',
                targetRevision: 'main'
            })
            .stage({
                id: 'us-west-1-sandbox',
                stackBuilder: blueprint.clone('us-west-1')
            })
            .wave( {
                id: "dev",
                stages: [
                    { id: "dev-west-1", stackBuilder: blueprint.clone('us-west-1')},
                    { id: "dev-east-2", stackBuilder: blueprint.clone('us-east-2')},
                ]
            })
            .stage({
                id: 'us-east-2-uat',
                stackBuilder: blueprint.clone('us-east-2'),
                stageProps: {
                    pre: [new blueprints.pipelines.cdkpipelines.ManualApprovalStep('manual-approval')]
                }
            })
            .wave( {
                id: "prod",
                stages: [
                    { id: "prod-west-1", stackBuilder: blueprint.clone('us-west-1')},
                    { id: "prod-east-2", stackBuilder: blueprint.clone('us-east-2')},
                ]
            })
            .build(scope, "pipeline", props);
    }

    async prevalidateSecrets() {
        try {
            await blueprints.utils.validateSecret('github-token', 'us-east-2');
            await blueprints.utils.validateSecret('github-token', 'us-west-1');
        }
        catch(error) {
            throw new Error(`github-token secret must be setup in AWS Secrets Manager for the GitHub pipeline.
            The GitHub Personal Access Token should have these scopes:
            * **repo** - to read the repository
            * * **admin:repo_hook** - if you plan to use webhooks (true by default)
            * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/GitHub-create-personal-token-CLI.html`);
        }
    }
 }
>>>>>>> 2299c0d3615b1aad8faca5688535910a113b2f1f
