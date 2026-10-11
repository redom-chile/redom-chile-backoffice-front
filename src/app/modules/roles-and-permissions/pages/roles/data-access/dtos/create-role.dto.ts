import { RoleDto } from './role.dto';

export type CreateRoleDto = Readonly<
  Pick<RoleDto, 'code' | 'name'> & {
    /** Copia los permisos de ese rol (solo los que el usuario puede dar). */
    copyFromRoleId?: number;
  }
>;
