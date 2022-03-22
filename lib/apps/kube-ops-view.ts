import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { Construct } from '@aws-cdk/core';
import { ServiceAccount } from '@aws-cdk/aws-eks';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';

// helm repo add stable https://charts.helm.sh/stable
// helm install kube-ops-view \
// stable/kube-ops-view \
// --set service.type=LoadBalancer \
// --set rbac.create=True
export const defaultProps: ssp.addons.HelmAddOnProps = {
  chart: 'kube-ops-view',
  name: 'kube-ops-view',
  namespace: 'kube-ops-view',
  release: 'ssp-addon-kube-ops-view',
  version: '1.2.4',
  repository: 'https://charts.helm.sh/stable',
  values: {},
};

export class KubeOpsViewAddOn extends ssp.addons.HelmAddOn {
  constructor(props?: ssp.addons.HelmAddOnProps) {
    super({ ...defaultProps, ...props });
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  @ssp.utils.dependable(ssp.SecretsStoreAddOn.name)
  deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {
    const ns = ssp.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    // const serviceAccountName = 'aws-for-fluent-bit-sa';
    // const sa = clusterInfo.cluster.addServiceAccount('my-aws-for-fluent-bit-sa', {
    //     name: serviceAccountName,
    //     namespace: this.props.namespace
    // });

    // sa.node.addDependency(ns); // signal provisioning to wait for namespace creation to complete
    //                            // before the service account creation is attempted (otherwise can fire in parallel)

    // Cloud Map Full Access policy.
    // const cloudWatchAgentPolicy = ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy");
    // sa.role.addManagedPolicy(cloudWatchAgentPolicy);

    // --set service.type=LoadBalancer \
    // --set rbac.create=True
    const values: ssp.Values = {
      rbac: {
        create: true,
      },
      service: {
        type: 'LoadBalancer',
      },
      // serviceAccount: {
      //     create: false,
      //     name: serviceAccountName
      // },
      // cloudWatch: {
      //     region: this.options.cloudWatchRegion
      // }
    };

    // let secretProviderClass : ssp.addons.SecretProviderClass | undefined;
    // if(this.options.licenseKeySecret) {
    //     secretProviderClass = this.setupSecretProviderClass(clusterInfo, sa);
    //     this.addSecretVolumeAndMount(values);
    // }

    const chart = this.addHelmChart(clusterInfo, values);
    //chart.node.addDependency(sa);

    // if(secretProviderClass) { // if secret provider class must be created before the helm chart is applied, add dependenncy to enforce the order
    //     secretProviderClass.addDependent(chart);
    // }

    return Promise.resolve(chart); // returning this promise will enable other add-ons to declare dependency on this addon.
  }
}
