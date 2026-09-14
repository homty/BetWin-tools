from django.urls import path

from . import views

app_name = 'api_gateway'

urlpatterns = [
    path('health/', views.health, name='health'),
    path('pipeline/', views.pipeline, name='pipeline'),
]
