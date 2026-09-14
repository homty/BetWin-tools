from django.contrib import admin

from .models import CodeSubmission, Product

admin.site.register(Product)
admin.site.register(CodeSubmission)
