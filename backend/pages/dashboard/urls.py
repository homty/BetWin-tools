from django.urls import path

from . import views

app_name = 'dashboard'

urlpatterns = [
    path('', views.landing, name='landing'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('products/', views.home, name='home'),
    path('anislot/', views.anislot, name='anislot'),
    path('anislot/core/', views.anislot_core, name='anislot_core'),
]
