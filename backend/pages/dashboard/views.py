from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


def landing(request):
    return render(request, 'dashboard/landing.html')


def home(request):
    return render(request, 'dashboard/home.html')


@ensure_csrf_cookie
def anislot(request):
    return render(request, 'dashboard/anislot.html')
