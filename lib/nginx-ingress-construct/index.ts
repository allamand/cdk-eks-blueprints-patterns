import * as blueprints from '@aws-quickstart/eks-blueprints';
import { GlobalResources, utils } from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import { prevalidateSecrets } from '../common/construct-utils';
import { SECRET_ARGO_ADMIN_PWD } from '../multi-region-construct';
import * as team from '../teams';

const burnhamManifestDir = './lib/teams/team-burnham/';
const rikerManifestDir = './lib/teams/team-riker/';
const teamManifestDirList = [burnhamManifestDir, rikerManifestDir];

const accountID = process.env.CDK_DEFAULT_ACCOUNT!;
//const gitUrl = 'https://github.com/aws-samples/eks-blueprints-workloads.git';
const gitUrl = 'https://github.com/allamand/ssp-eks-workloads.git';

/**
 * See docs/patterns/nginx.md for mode details on the setup.
 */
export default class NginxIngressConstruct {
  async buildAsync(scope: Construct, id: string) {
    await prevalidateSecrets(NginxIngressConstruct.name, undefined, SECRET_ARGO_ADMIN_PWD);

    const teams: Array<blueprints.Team> = [
      new team.TeamPlatform(accountID),
      new team.TeamTroiSetup(),
      new team.TeamRikerSetup(scope, teamManifestDirList[1]),
      new team.TeamBurnhamSetup(scope, teamManifestDirList[0]),
    ];

    const subdomain: string = utils.valueFromContext(scope, 'qua1.subzone.name', 'qua1.eks.demo3.allamand.com');
    const parentDnsAccountId = scope.node.tryGetContext("parent.dns.account")!;
    const parentDomain = utils.valueFromContext(scope, 'parent.hostedzone.name', 'eks.demo3.allamand.com');

        blueprints.HelmAddOn.validateHelmVersions = true;

        await blueprints.EksBlueprint.builder()
            .account(process.env.CDK_DEFAULT_ACCOUNT)
            .region(process.env.CDK_DEFAULT_REGION)
            .teams(...teams)
            .resourceProvider(GlobalResources.HostedZone, 
                //new blueprints.LookupHostedZoneProvider(parentDomain),
                new DelegatingHostedZoneProvider({
                parentDomain,
                subdomain,
                parentDnsAccountId,
                delegatingRoleName: 'DomainOperatorRole',
                wildcardSubdomain: true
            }))
            .resourceProvider(GlobalResources.Certificate, new blueprints.CreateCertificateProvider('wildcard-cert', `*.${subdomain}`, GlobalResources.HostedZone))
            .addOns(
                new blueprints.VpcCniAddOn(),
                new blueprints.CoreDnsAddOn(),
                new blueprints.CalicoOperatorAddOn,
                new blueprints.CertManagerAddOn,
                new blueprints.AdotCollectorAddOn,
                new blueprints.AwsLoadBalancerControllerAddOn,
                new blueprints.ExternalDnsAddOn({
                    hostedZoneResources: [blueprints.GlobalResources.HostedZone] // you can add more if you register resource providers
                }),
                new blueprints.NginxAddOn({
                    internetFacing: true,
                    backendProtocol: "tcp",
                    externalDnsHostname: subdomain,
                    crossZoneEnabled: false,
                    certificateResourceName: GlobalResources.Certificate
                }),
                new blueprints.SecretsStoreAddOn({ rotationPollInterval: "120s" }),
                new blueprints.ArgoCDAddOn({
                    bootstrapRepo: {
                        repoUrl: gitUrl,
                        targetRevision: "deployable",
                        path: 'envs/dev'
                    },
                    adminPasswordSecretName: SECRET_ARGO_ADMIN_PWD,
                }),
                new blueprints.AppMeshAddOn,
                new blueprints.MetricsServerAddOn,
                new blueprints.ClusterAutoScalerAddOn,
                new blueprints.CloudWatchAdotAddOn,
                new blueprints.XrayAdotAddOn)
            .buildAsync(scope, `${id}-blueprint`);

            blueprints.HelmAddOn.validateHelmVersions = false;
    }
}
