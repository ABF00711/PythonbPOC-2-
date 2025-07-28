from django.contrib import admin
from .models import CustomUser, Role, UserRole, Menu, RoleMenu, SearchPattern

admin.site.register(CustomUser)
admin.site.register(Role)
admin.site.register(UserRole)
admin.site.register(Menu)
admin.site.register(RoleMenu)
admin.site.register(SearchPattern)
