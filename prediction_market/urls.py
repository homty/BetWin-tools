from django.urls import path

from . import views


app_name = "prediction_market"

urlpatterns = [
    path("", views.home, name="home"),
]

