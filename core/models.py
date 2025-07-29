from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

# Create your models here.

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    def __str__(self):
        return self.username

class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    def __str__(self):
        return self.name

class UserRole(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    class Meta:
        unique_together = ('user', 'role')
    def __str__(self):
        return f"{self.user.username} - {self.role.name}"

class Menu(models.Model):
    title = models.CharField(max_length=100)
    url = models.CharField(max_length=200)
    icon = models.CharField(max_length=50, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    parent = models.ForeignKey('self', null=True, blank=True, related_name='children', on_delete=models.CASCADE)
    def __str__(self):
        return self.title

class RoleMenu(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE)
    class Meta:
        unique_together = ('role', 'menu')
    def __str__(self):
        return f"{self.role.name} - {self.menu.title}"

class SearchPattern(models.Model):
    tablename = models.CharField(max_length=100)
    username = models.CharField(max_length=100)
    searchname = models.CharField(max_length=100)
    searchdata = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tablename', 'username', 'searchname')

    def __str__(self):
        return f"{self.username} - {self.tablename} - {self.searchname}"

class GridLayout(models.Model):
    username = models.CharField(max_length=100)
    table_name = models.CharField(max_length=100)
    layout_name = models.CharField(max_length=100)
    layout_json = models.JSONField()
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('username', 'table_name', 'layout_name')

    def __str__(self):
        return f"{self.username} - {self.table_name} - {self.layout_name}"

    def save(self, *args, **kwargs):
        # Ensure only one default layout per user per table
        if self.is_default:
            GridLayout.objects.filter(
                username=self.username,
                table_name=self.table_name,
                is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)
