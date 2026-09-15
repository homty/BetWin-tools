from django.urls import path

from . import views

app_name = 'api_gateway'

urlpatterns = [
    path('health/', views.health, name='health'),
    path('pipeline/', views.pipeline, name='pipeline'),
    path('anislot/generate/', views.anislot_generate, name='anislot_generate'),
    path('anislot/jobs/<str:item_id>/', views.anislot_job, name='anislot_job'),
    path('anislot/results/<str:item_id>/', views.anislot_result, name='anislot_result'),
    path('anislot/images/<str:image_name>/', views.anislot_image, name='anislot_image'),
    path('products/', views.products, name='products'),
    path('setup/', views.setup, name='setup'),
    path('setup/status/', views.setup_status, name='setup_status'),
]
