import { PlatformTeam } from '@aws-quickstart/eks-blueprints';

export class TeamPlatform extends PlatformTeam {
  constructor(accountID: string) {
    super({
      name: 'platform',
      //users: [new ArnPrincipal(`arn:aws:iam::${accountID}:user/superadmin`)],
      userRoleArn: `arn:aws:iam::${accountID}:role/demo3`,
    });
  }
}
