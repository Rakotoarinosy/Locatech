from rest_framework.permissions import BasePermission

STAFF_ROLES = ('admin', 'staff')


def est_staff(user) -> bool:
    return bool(
        user and user.is_authenticated
        and (user.is_superuser or getattr(user, 'role', None) in STAFF_ROLES)
    )


class IsStaffUser(BasePermission):
    """Réservé à l'équipe LocaTech (back-office). Les comptes clients sont refusés."""

    def has_permission(self, request, view):
        return est_staff(request.user)


class IsAdminRole(BasePermission):
    """Réservé aux administrateurs LocaTech."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or user.role == 'admin'))
