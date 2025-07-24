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
from core.views import api_delete
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
    path('<str:form_name>/', dynamic_grid, name='dynamic_grid'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
