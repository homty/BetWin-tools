from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie

from api_gateway.clone_service import existing_repository_matches, repository_destination
from api_gateway.models import Product


def anislot_is_configured():
    try:
        product = Product.objects.get(name='AniSlot')
    except Product.DoesNotExist:
        return False

    return bool(
        product.github_url
        and existing_repository_matches(
            repository_destination(product.name),
            product.github_url,
        )
    )


def landing(request):
    return render(request, 'dashboard/landing.html')


def home(request):
    return render(request, 'dashboard/home.html')


@ensure_csrf_cookie
def anislot(request):
    if anislot_is_configured():
        return redirect('dashboard:anislot_core')
    return render(request, 'dashboard/anislot.html')


@ensure_csrf_cookie
def anislot_core(request):
    if not anislot_is_configured():
        return redirect('dashboard:anislot')
    return render(request, 'dashboard/anislot_core.html')
