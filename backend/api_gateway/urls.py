from django.urls import path

from . import views

app_name = 'api_gateway'

urlpatterns = [
    path('health/', views.health, name='health'),
    path('pipeline/', views.pipeline, name='pipeline'),
    path('products/', views.products, name='products'),
    path('products/<int:product_id>/', views.product_detail, name='product_detail'),
    path('products/<int:product_id>/submit-code/', views.submit_code, name='submit_code'),
]
