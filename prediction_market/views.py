from django.shortcuts import render


def home(request):
    return render(request, "prediction_market/home.html")
