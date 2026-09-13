from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    path("admin/", admin.site.urls),
    path("anislot/", include("anislot.urls")),
    path("prediction-market/", include("prediction_market.urls")),
    path("", include("dashboard.urls")),
]
