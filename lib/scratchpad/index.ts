import * as cdk from '@aws-cdk/core';
import {KubernetesVersion}  from '@aws-cdk/aws-eks';

// SSP Lib
import * as ssp from '@aws-quickstart/ssp-amazon-eks';
import { MngClusterProvider } from '@aws-quickstart/ssp-amazon-eks';


export default class ScratchpadConstruct extends cdk.Construct {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);
        // AddOns for the cluster.
        const addOns: Array<ssp.ClusterAddOn> = [
            new ssp.AwsLoadBalancerControllerAddOn,
            new ssp.NginxAddOn,
            new ssp.MetricsServerAddOn,
            new ssp.ClusterAutoScalerAddOn
        ];

        const stackID = `${id}-blueprint`;

        const clusterProvider = new MngClusterProvider( {
            desiredSize: 3,
            maxSize: 3,
            version: KubernetesVersion.V1_20
        });

        new ssp.EksBlueprint(scope, { id: stackID, addOns, clusterProvider }, {
            env: {
                region: 'us-east-2',
            },
        });
    }
}
