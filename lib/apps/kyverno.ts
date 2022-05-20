import { Construct } from '@aws-cdk/core';
import * as ssp from '@aws-quickstart/ssp-amazon-eks';

export const defaultProps: ssp.addons.HelmAddOnProps = {
  chart: 'kyverno',
  name: 'kyverno',
  namespace: 'kyverno',
  release: 'ssp-addon-kyverno',
  version: '2.3.2',
  repository: 'https://kyverno.github.io/kyverno/',
};

export class KyvernoAddOn extends ssp.addons.HelmAddOn {
  constructor(props?: ssp.addons.HelmAddOnProps) {
    super({...defaultProps, ...props});
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  //@ssp.utils.dependable(ssp.SecretsStoreAddOn.name)
  deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {
    const ns = ssp.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    const values: ssp.Values = {};

    const chart = this.addHelmChart(clusterInfo, values);

    return Promise.resolve(chart); // returning this promise will enable other add-ons to declare dependency on this addon.
  }
}

export const policiesProps: ssp.addons.HelmAddOnProps = {
  chart: 'kyverno-policies',
  name: 'kyverno-policies',
  namespace: 'kyverno',
  release: 'ssp-addon-kyverno-policies',
  version: '2.3.2',
  repository: 'https://kyverno.github.io/kyverno/',
};

export class KyvernoPoliciesAddOn extends ssp.addons.HelmAddOn {
  constructor(props?: ssp.addons.HelmAddOnProps) {
    super({...policiesProps, ...props});
  }

  // Declares dependency on secret store add-on if secrets are needed.
  // Customers will have to explicitly add this add-on to the blueprint.
  //@ssp.utils.dependable(ssp.SecretsStoreAddOn.name)
  deploy(clusterInfo: ssp.ClusterInfo): Promise<Construct> {
    const ns = ssp.utils.createNamespace(this.props.namespace!, clusterInfo.cluster, true);

    const values: ssp.Values = {};

    const chart = this.addHelmChart(clusterInfo, values);

    return Promise.resolve(chart); // returning this promise will enable other add-ons to declare dependency on this addon.
  }
}
