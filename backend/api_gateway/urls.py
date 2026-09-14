from django.urls import path

from . import views

app_name = 'api_gateway'

urlpatterns = [
    path('health/', views.health, name='health'),
    path('pipeline/', views.pipeline, name='pipeline'),
    path('products/', views.products, name='products'),
    path('setup/', views.setup, name='setup'),
    path('setup/status/', views.setup_status, name='setup_status'),
]
