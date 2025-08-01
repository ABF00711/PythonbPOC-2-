"""
URL configuration for pythonpoc project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth_views
from core.views import register, custom_login, profile, home, about, contact, dynamic_grid
from core.views import api_fields, api_options, api_create, api_record, api_update 
from core.views import api_delete, api_gsearch, api_search
from core.views import api_search_patterns, api_save_search_pattern, api_delete_search_pattern, api_reset_grid
from core.views import api_grid_layouts, api_save_grid_layout, api_load_grid_layout, api_delete_grid_layout, api_set_default_layout
from core.views import api_tab_layouts, api_save_tab_layout, api_load_tab_layout, api_delete_tab_layout, api_set_default_tab_layout
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', home, name='home'),
    path('about/', about, name='about'),
    path('contact/', contact, name='contact'),
    path('admin/', admin.site.urls),
    path('login/', custom_login, name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),
    path('register/', register, name='register'),
    path('profile/', profile, name='profile'),
    path('api/fields/<str:table_name>/', api_fields, name='api_fields'),
    path('api/options/<str:table_name>/<str:field_name>/', api_options, name='api_options'),
    path('api/create/<str:table_name>/', api_create, name='api_create'),
    path('api/record/<str:table_name>/<int:record_id>/', api_record, name='api_record'),
    path('api/update/<str:table_name>/<int:record_id>/', api_update, name='api_update'),
    path('api/delete/<str:table_name>/', api_delete, name='api_delete'),
    path('api/gsearch/<str:table_name>/<str:field_name>/', api_gsearch, name='api_gsearch'),
    path('api/search/<str:table_name>/', api_search, name='api_search'),
    path('api/search-patterns/<str:table_name>/', api_search_patterns, name='api_search_patterns'),
    path('api/search-patterns/<str:table_name>/save/', api_save_search_pattern, name='api_save_search_pattern'),
    path('api/search-patterns/<str:table_name>/<int:pattern_id>/delete/', api_delete_search_pattern, name='api_delete_search_pattern'),
    path('api/reset-grid/<str:table_name>/', api_reset_grid, name='api_reset_grid'),
    path('api/layouts/<str:table_name>/', api_grid_layouts, name='api_grid_layouts'),
    path('api/layouts/<str:table_name>/save/', api_save_grid_layout, name='api_save_grid_layout'),
    path('api/layouts/<str:table_name>/<int:layout_id>/load/', api_load_grid_layout, name='api_load_grid_layout'),
    path('api/layouts/<str:table_name>/<int:layout_id>/delete/', api_delete_grid_layout, name='api_delete_grid_layout'),
    path('api/layouts/<str:table_name>/<int:layout_id>/set-default/', api_set_default_layout, name='api_set_default_layout'),
    path('api/tab-layouts/', api_tab_layouts, name='api_tab_layouts'),
    path('api/tab-layouts/save/', api_save_tab_layout, name='api_save_tab_layout'),
    path('api/tab-layouts/<int:layout_id>/load/', api_load_tab_layout, name='api_load_tab_layout'),
    path('api/tab-layouts/<int:layout_id>/delete/', api_delete_tab_layout, name='api_delete_tab_layout'),
    path('api/tab-layouts/<int:layout_id>/set-default/', api_set_default_tab_layout, name='api_set_default_tab_layout'),
    path('dynamic-grid/<str:form_name>/', dynamic_grid, name='dynamic_grid'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
