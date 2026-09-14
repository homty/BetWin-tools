import json

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .models import CodeSubmission, Product
from .pipeline_client import ModelPipelineClient, PipelineError


@require_GET
def health(request):
    client = ModelPipelineClient()
    return JsonResponse({'status': 'ok', 'pipelineConfigured': client.is_configured})


@require_POST
def pipeline(request):
    try:
        payload = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Request body must be valid JSON.'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'error': 'Request body must be a JSON object.'}, status=400)

    try:
        return JsonResponse(ModelPipelineClient().forward(payload))
    except PipelineError as error:
        return JsonResponse({'error': str(error)}, status=error.status_code)


@require_GET
def products(request):
    data = [
        {
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'githubUrl': product.github_url,
        }
        for product in Product.objects.all()
    ]
    return JsonResponse({'products': data})


@require_GET
def product_detail(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found.'}, status=404)

    return JsonResponse({
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'githubUrl': product.github_url,
    })


@require_POST
def submit_code(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found.'}, status=404)

    try:
        payload = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Request body must be valid JSON.'}, status=400)

    code = payload.get('code') if isinstance(payload, dict) else None
    if not isinstance(code, str) or not code.strip():
        return JsonResponse({'error': 'The code field is required.'}, status=400)

    submission = CodeSubmission.objects.create(product=product, code=code)
    pipeline_payload = {
        'task': 'analyze_code',
        'product': {'id': product.id, 'name': product.name},
        'code': code,
    }

    try:
        result = ModelPipelineClient().forward(pipeline_payload)
    except PipelineError as error:
        return JsonResponse({'error': str(error), 'submissionId': submission.id}, status=error.status_code)

    submission.result = result
    submission.save(update_fields=['result'])
    return JsonResponse({'submissionId': submission.id, 'result': result})
