from rest_framework import permissions


class IsTicketParticipantOrSupport(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_support():
            return True
        return obj.author == request.user


class IsSupportUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user 
            and request.user.is_authenticated 
            and request.user.is_support()
        )