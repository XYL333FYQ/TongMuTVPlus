import { isAdminRole, isOwnerRole, isPrivilegedRole, rankOf } from './roles';

describe('roles', () => {
  it('站长、管理员、其他角色分得开', () => {
    expect(isOwnerRole('owner')).toBe(true);
    expect(isOwnerRole('admin')).toBe(false);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('owner')).toBe(false);
  });

  it('管理员或站长才算有特权；没登录、普通成员、房间成员都没有', () => {
    expect(isPrivilegedRole('owner')).toBe(true);
    expect(isPrivilegedRole('admin')).toBe(true);
    for (const role of ['user', 'member', 'none', '', null, undefined]) {
      expect(isPrivilegedRole(role)).toBe(false);
    }
  });

  it('不认识的角色等级是 0', () => {
    expect(rankOf('superuser')).toBe(0);
    expect(rankOf('owner')).toBeGreaterThan(rankOf('admin'));
  });
});
