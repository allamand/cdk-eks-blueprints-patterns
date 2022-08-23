import * as blueprints from '@aws-quickstart/eks-blueprints';
import {Construct} from 'constructs';

export const defaultProps: blueprints.addons.HelmAddOnProps = {
  chart: 'kube-ops-view',
  name: 'kube-ops-view',
  namespace: 'kube-ops-view',
  release: 'blueprints-addon-kube-ops-view',
  version: '1.2.4',
  repository: 'https://charts.helm.sh/stable',
};

export class KubeOpsViewAddOn extends blueprints.addons.HelmAddOn {
  constructor(props?: blueprints.addons.HelmAddOnProps) {
    super({...defaultProps, ...props});
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  @blueprints.utils.dependable(blueprints.SecretsStoreAddOn.name)
  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    const ns = blueprints.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    const values: blueprints.Values = {
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
