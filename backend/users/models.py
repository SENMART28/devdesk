from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        CLIENT = 'client', 'Клиент'
        SUPPORT = 'support', 'Сотрудник поддержки'
        ADMIN = 'admin', 'Администратор'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CLIENT,
        db_index=True,
    )

    def is_support(self):
        return self.role in [self.Role.SUPPORT, self.Role.ADMIN]

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"