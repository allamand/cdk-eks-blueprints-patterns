import {ManagedPolicy} from '@aws-cdk/aws-iam';
import {Construct} from '@aws-cdk/core';
import {ServiceAccount} from '@aws-cdk/aws-eks';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';

export const defaultProps: ssp.addons.HelmAddOnProps = {
  chart: 'kube-ops-view',
  name: 'kube-ops-view',
  namespace: 'kube-ops-view',
  release: 'ssp-addon-kube-ops-view',
  version: '1.2.4',
  repository: 'https://charts.helm.sh/stable',
};

export class KubeOpsViewAddOn extends ssp.addons.HelmAddOn {
  constructor(props?: ssp.addons.HelmAddOnProps) {
    super({...defaultProps, ...props});
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  @ssp.utils.dependable(ssp.SecretsStoreAddOn.name)
  deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {
    const ns = ssp.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    const values: ssp.Values = {
      rbac: {
        create: true,
      },
      service: {
        type: 'ClusterIP',
      },
      image: {
        repository: 'public.ecr.aws/seb-demo/kube-ops-view',
        tag: '20.4.0-color',
      },
    };


    const chart = this.addHelmChart(clusterInfo, values);
    return Promise.resolve(chart); // returning this promise will enable other add-ons to declare dependency on this addon.
  }
}
