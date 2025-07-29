from django.contrib import admin
from .models import CustomUser, Role, UserRole, Menu, RoleMenu, SearchPattern, GridLayout

admin.site.register(CustomUser)
admin.site.register(Role)
admin.site.register(UserRole)
admin.site.register(Menu)
admin.site.register(RoleMenu)

@admin.register(SearchPattern)
class SearchPatternAdmin(admin.ModelAdmin):
    list_display = ('username', 'tablename', 'searchname', 'created_at', 'updated_at')
    list_filter = ('tablename', 'username')
    search_fields = ('username', 'tablename', 'searchname')

@admin.register(GridLayout)
class GridLayoutAdmin(admin.ModelAdmin):
    list_display = ('username', 'table_name', 'layout_name', 'is_default', 'created_at', 'updated_at')
    list_filter = ('table_name', 'username', 'is_default')
    search_fields = ('username', 'table_name', 'layout_name')
