from django.contrib.auth import views as auth_views
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login
from django.http import HttpResponseRedirect
from django.urls import reverse
from .forms import CustomUserCreationForm, EmailAuthenticationForm
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

@login_required
def profile(request):
    return render(request, 'profile.html', {
        'user': request.user,
    })
