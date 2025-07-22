from django.db import migrations

def create_sample_data(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    Menu = apps.get_model('core', 'Menu')
    RoleMenu = apps.get_model('core', 'RoleMenu')

    # Create roles
    admin = Role.objects.create(name='admin')
    clerk = Role.objects.create(name='clerk')
    user = Role.objects.create(name='user')

    # Create menus
    home = Menu.objects.create(title='Home', url='/', icon='bi-house', order=1)
    about = Menu.objects.create(title='About', url='/about/', icon='bi-info-circle', order=2)
    contact = Menu.objects.create(title='Contact', url='/contact/', icon='bi-envelope', order=3)
    customers = Menu.objects.create(title='Customers', url='/customers/', icon='bi-people', order=4)
    reports = Menu.objects.create(title='Reports', url='/reports/', icon='bi-bar-chart', order=5)
    admin_panel = Menu.objects.create(title='Admin Panel', url='/admin/', icon='bi-gear', order=6)

    # Assign menus to roles
    for menu in [home, about, contact]:
        RoleMenu.objects.create(role=admin, menu=menu)
        RoleMenu.objects.create(role=clerk, menu=menu)
        RoleMenu.objects.create(role=user, menu=menu)
    RoleMenu.objects.create(role=admin, menu=customers)
    RoleMenu.objects.create(role=admin, menu=reports)
    RoleMenu.objects.create(role=admin, menu=admin_panel)
    RoleMenu.objects.create(role=clerk, menu=customers)
    RoleMenu.objects.create(role=clerk, menu=reports)

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0003_menu_role_userrole_rolemenu'),
    ]
    operations = [
        migrations.RunPython(create_sample_data),
    ] 