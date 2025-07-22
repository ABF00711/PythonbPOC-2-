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
