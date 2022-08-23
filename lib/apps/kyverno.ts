// import * as blueprints from '@aws-quickstart/eks-blueprints';
import {Construct} from 'constructs';

export const defaultProps: blueprints.addons.HelmAddOnProps = {
  chart: 'kyverno',
  name: 'kyverno',
  namespace: 'kyverno',
  release: 'blueprints-addon-kyverno',
  version: '2.3.2',
  repository: 'https://kyverno.github.io/kyverno/',
};

export class KyvernoAddOn extends blueprints.addons.HelmAddOn {
  constructor(props?: blueprints.addons.HelmAddOnProps) {
    super({...defaultProps, ...props});
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  //@blueprints.utils.dependable(blueprints.SecretsStoreAddOn.name)
  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    const ns = blueprints.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    const values: blueprints.Values = {};

    const chart = this.addHelmChart(clusterInfo, values);

    return Promise.resolve(chart); // returning this promise will enable other add-ons to declare dependency on this addon.
  }
}

export const policiesProps: blueprints.addons.HelmAddOnProps = {
  chart: 'kyverno-policies',
  name: 'kyverno-policies',
  namespace: 'kyverno',
  release: 'blueprints-addon-kyverno-policies',
  version: '2.3.2',
  repository: 'https://kyverno.github.io/kyverno/',
};

export class KyvernoPoliciesAddOn extends blueprints.addons.HelmAddOn {
  constructor(props?: blueprints.addons.HelmAddOnProps) {
    super({...policiesProps, ...props});
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  //@blueprints.utils.dependable(blueprints.SecretsStoreAddOn.name)
  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    // const ns = blueprints.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    const values: blueprints.Values = {};

    const chart = this.addHelmChart(clusterInfo, values);

    return Promise.resolve(chart); // returning this promise will enable other add-ons to declare dependency on this addon.
  }
}
