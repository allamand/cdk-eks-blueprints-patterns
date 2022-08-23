import * as blueprints from '@aws-quickstart/eks-blueprints';
import { DelegatingHostedZoneProvider, GlobalResources, utils } from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import { prevalidateSecrets } from '../common/construct-utils';
import { SECRET_ARGO_ADMIN_PWD } from '../multi-region-construct';
import * as team from '../teams';

const burnhamManifestDir = './lib/teams/team-burnham/'
const rikerManifestDir = './lib/teams/team-riker/'
const teamManifestDirList = [burnhamManifestDir, rikerManifestDir]

const accountID = process.env.CDK_DEFAULT_ACCOUNT!;
const gitUrl = 'https://github.com/allamand/ssp-eks-workloads.git';

/**
 * See docs/patterns/nginx.md for mode details on the setup.
 */
export default class NginxIngressConstruct {

    async buildAsync(scope: Construct, id: string) {

        await prevalidateSecrets(NginxIngressConstruct.name, undefined, SECRET_ARGO_ADMIN_PWD);

        const teams: Array<blueprints.Team> = [
            new team.TeamPlatform(accountID),
            new team.TeamTroiSetup,
            new team.TeamRikerSetup(scope, teamManifestDirList[1]),
            new team.TeamBurnhamSetup(scope, teamManifestDirList[0])
        ];

        const subdomain : string = valueFromContext(scope, "qua1.subzone.name", "qua1.eks.demo3.allamand.com");
        //const parentDnsAccountId = this.node.tryGetContext("parent.dns.account")!;
        const parentDomain = valueFromContext(this, "parent.hostedzone.name", "eks.demo3.allamand.com");

        blueprints.EksBlueprint.builder()
            .account(process.env.CDK_DEFAULT_ACCOUNT)
            .region(process.env.CDK_DEFAULT_REGION)
            .teams(...teams)
            .resourceProvider(GlobalResources.HostedZone, new blueprints.LookupHostedZoneProvider(parentDomain))       
            .resourceProvider(GlobalResources.Certificate, new blueprints.CreateCertificateProvider('wildcard-cert', `*.${subdomain}`, GlobalResources.HostedZone))
            .addOns(
                new blueprints.VpcCniAddOn(),
                new blueprints.CoreDnsAddOn(),
                new blueprints.CalicoAddOn,
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
                        targetRevision: "main",
                        path: 'envs/qua1'
                    },
                    adminPasswordSecretName: SECRET_ARGO_ADMIN_PWD,
                }),
                new blueprints.AppMeshAddOn,
                new blueprints.MetricsServerAddOn,
                new blueprints.ClusterAutoScalerAddOn,
                new blueprints.ContainerInsightsAddOn,
                new blueprints.XrayAddOn)
            .buildAsync(scope, `${id}-blueprint`);
    }
}


