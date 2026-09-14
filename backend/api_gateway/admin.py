from django.contrib import admin

from .models import CodeSubmission, Product, SetupJob

admin.site.register(Product)
admin.site.register(CodeSubmission)
admin.site.register(SetupJob)
