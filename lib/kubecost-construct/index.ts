import { Construct } from 'constructs';
import { EksBlueprint } from '@aws-quickstart/eks-blueprints';
import { KubecostAddOn } from '@kubecost/kubecost-eks-blueprints-addon';


export default class KubecostConstruct {
    constructor(scope: Construct, id: string) {
        // AddOns for the cluster
        const stackId = `${id}-blueprint`;

        EksBlueprint.builder()
          .account(process.env.CDK_DEFAULT_ACCOUNT!)
          .region(process.env.CDK_DEFAULT_REGION)
          .addOns(
            new KubecostAddOn({
              kubecostToken: "c2FsbGFtYW5AYW1hem9uLmZyxm343yadf98",
            }),
          )
          .build(scope, stackId);
    }
}
