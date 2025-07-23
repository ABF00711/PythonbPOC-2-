from django.contrib.auth import views as auth_views
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login
from django.http import HttpResponseRedirect
from django.urls import reverse
from .forms import CustomUserCreationForm, EmailAuthenticationForm, ProfileUpdateForm
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.db import connection

# Create your views here.

def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Registration successful! You can now log in.')
            return redirect('login')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = CustomUserCreationForm()
    return render(request, 'register.html', {'form': form})

# Custom login view to handle 'Remember me' and email login
def custom_login(request):
    from django.contrib.auth.views import LoginView
    class CustomLoginView(LoginView):
        template_name = 'login.html'
        authentication_form = EmailAuthenticationForm
        def form_valid(self, form):
            remember = self.request.POST.get('remember')
            if not remember:
                self.request.session.set_expiry(0)
            return super().form_valid(form)
    return CustomLoginView.as_view()(request)

def get_user_menus(user):
    from .models import UserRole, RoleMenu, Menu
    role_ids = UserRole.objects.filter(user=user).values_list('role_id', flat=True)
    menu_qs = Menu.objects.filter(
        id__in=RoleMenu.objects.filter(role_id__in=role_ids).values_list('menu_id', flat=True)
    ).order_by('order')
    parents = [m for m in menu_qs if m.parent_id is None and m.url not in ['/', '/about/', '/contact/']]
    menu_tree = []
    for parent in parents:
        children = [c for c in menu_qs if c.parent_id == parent.id]
        menu_tree.append({'menu': parent, 'children': children})
    return menu_tree

@login_required
def profile(request):
    if request.method == 'POST':
        form = ProfileUpdateForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            user = form.save(commit=False)
            password = form.cleaned_data.get('password')
            if password:
                user.set_password(password)
            user.save()
            messages.success(request, 'Profile updated successfully!')
            return redirect('home')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = ProfileUpdateForm(instance=request.user)
    return render(request, 'profile.html', {'form': form, 'user': request.user})

@login_required
def home(request):
    form = ProfileUpdateForm(instance=request.user)
    menu_tree = get_user_menus(request.user)
    return render(request, 'home.html', {'user': request.user, 'form': form, 'menu_tree': menu_tree})

@login_required
def about(request):
    form = ProfileUpdateForm(instance=request.user)
    menu_tree = get_user_menus(request.user)
    return render(request, 'about.html', {'user': request.user, 'form': form, 'menu_tree': menu_tree})

@login_required
def contact(request):
    form = ProfileUpdateForm(instance=request.user)
    menu_tree = get_user_menus(request.user)
    return render(request, 'contact.html', {'user': request.user, 'form': form, 'menu_tree': menu_tree})

@login_required
def dynamic_grid(request, form_name):
    # 1. Get form config
    form_cursor = connection.cursor()
    form_cursor.execute("SELECT * FROM forms WHERE FormName = %s", [form_name])
    form_row = form_cursor.fetchone()
    if not form_row:
        return render(request, 'dynamic_grid.html', {'error': 'Form not found.'})
    select_fields_raw = [f.strip() for f in form_row[2].split(',')]
    table_name = form_row[3]
    # 2. Get column config
    cursor = connection.cursor()
    cursor.execute("SELECT field_label, field_name FROM search_config WHERE table_name = %s", [table_name])
    columns_config = cursor.fetchall()  # list of (field_label, field_name)
    # Build select_fields and columns in the order of select_fields_raw, using field_name for SQL and field_label for header
    select_fields = []
    columns = []
    for field in select_fields_raw:
        if field.lower() == 'id':
            continue
        for label, name in columns_config:
            if name == field:
                select_fields.append(name)
                columns.append((label, name))
                break
    # Always keep ID in the SQL query for backend use
    sql_fields = [f.strip() for f in form_row[2].split(',')]
    sql = f"SELECT {', '.join(sql_fields)} FROM {table_name}"
    cursor.execute(sql)
    raw_data = cursor.fetchall()
    # Build a list of dicts for each row, mapping field_name to value
    data = []
    for row in raw_data:
        row_dict = dict(zip(sql_fields, row))
        data.append(row_dict)
    return render(request, 'dynamic_grid.html', {
        'columns': columns,  # list of (label, field_name) to display
        'data': data,        # list of dicts, field_name -> value
        'form_name': form_name,
        'table_name': table_name,
    })
