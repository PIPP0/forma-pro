import type { DB, Project, Role, User } from './model';

export type Permission = 'view' | 'comment' | 'edit' | 'runStudy' | 'publish' | 'manageMembers' | 'delete';

const MATRIX: Record<Role, Permission[]> = {
  owner: ['view', 'comment', 'edit', 'runStudy', 'publish', 'manageMembers', 'delete'],
  editor: ['view', 'comment', 'edit', 'runStudy', 'publish'],
  viewer: ['view', 'comment'],
};

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', editor: 'Editor', viewer: 'Lector' };

export const PERMISSION_LABEL: Record<Permission, string> = {
  view: 'Ver diseño y resultados',
  comment: 'Comentar',
  edit: 'Editar sistema y pantallas',
  runStudy: 'Crear y cerrar estudios',
  publish: 'Guardar versiones y publicar biblioteca',
  manageMembers: 'Gestionar personas y roles',
  delete: 'Eliminar el proyecto',
};

export const can = (role: Role | undefined, perm: Permission) => !!role && MATRIX[role].includes(perm);

export function roleFor(db: DB, project: Project, user: User | undefined): Role | undefined {
  if (!user) return undefined;
  if (project.owner === user.id) return 'owner';
  const m = db.memberships.find(
    (x) => x.subjectType === 'project' && x.subjectId === project.id && x.email.toLowerCase() === user.email.toLowerCase(),
  );
  return m?.role;
}
