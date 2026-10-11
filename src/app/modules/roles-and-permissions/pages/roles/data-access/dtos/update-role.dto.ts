import { RoleDto } from './role.dto';

export type UpdateRoleDto = Readonly<
  Pick<RoleDto, 'id'> & {
    code: string;
    name: string;
  }
>;
