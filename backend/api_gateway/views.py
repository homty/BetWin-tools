import json

from django.http import HttpResponse, JsonResponse
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST

from .clone_service import clone_repository, existing_repository_matches, repository_destination
from .invoke_client import InvokeClient, InvokeError
from .models import CodeSubmission, Product
from .pipeline_client import ModelPipelineClient, PipelineError
from .workflow_builder import AniSlotWorkflowBuilder, WorkflowBuildError


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


@require_POST
def anislot_generate(request):
    """Upload the source image and optional slot concept, then queue InvokeAI."""
    image = request.FILES.get('image')
    if image is None:
        return JsonResponse({'error': 'An image file is required.'}, status=400)

    try:
        seed = _optional_integer(request.POST.get('seed'), 'seed')
        width = _optional_integer(request.POST.get('width'), 'width')
        runs = _optional_integer(request.POST.get('runs'), 'runs') or 1
        if seed is not None and seed < 0:
            raise ValueError('seed must be a non-negative integer.')
        if width is not None and width < 64:
            raise ValueError('width must be an integer of at least 64.')
        if not 1 <= runs <= 4:
            raise ValueError('runs must be between 1 and 4.')

        client = InvokeClient()
        uploaded_image = client.upload_image(
            image.read(),
            image.name,
            image.content_type,
        )
        image_name = uploaded_image.get('image_name')
        if not isinstance(image_name, str) or not image_name:
            raise InvokeError('InvokeAI uploaded the image but did not return image_name.')

        slot_concept = request.FILES.get('slotConceptImage')
        slot_concept_image_name = None
        if slot_concept is not None:
            uploaded_concept = client.upload_image(
                slot_concept.read(),
                slot_concept.name,
                slot_concept.content_type,
            )
            slot_concept_image_name = uploaded_concept.get('image_name')
            if not isinstance(slot_concept_image_name, str) or not slot_concept_image_name:
                raise InvokeError('InvokeAI uploaded the slot concept but did not return image_name.')

        graph = AniSlotWorkflowBuilder().build(
            image_name=image_name,
            slot_concept_image_name=slot_concept_image_name,
            slot_concept_prompt=_optional_text(request.POST.get('slotConceptPrompt')),
            positive_prompt=_optional_text(request.POST.get('positivePrompt')),
            negative_prompt=_optional_text(request.POST.get('negativePrompt')),
            seed=seed,
            width=width,
        )
        queued = client.enqueue_graph(graph, runs=runs)
        item_ids = queued['item_ids']
        item_id = item_ids[0]
    except (InvokeError, WorkflowBuildError) as error:
        return JsonResponse({'error': str(error)}, status=error.status_code)
    except ValueError as error:
        return JsonResponse({'error': str(error)}, status=400)

    return JsonResponse({
        'status': 'queued',
        'itemId': item_id,
        'itemIds': item_ids,
    }, status=202)


@require_GET
def anislot_job(request, item_id):
    """Return a normalized status for one InvokeAI queue item."""
    try:
        item = InvokeClient().queue_item(item_id)
    except InvokeError as error:
        return JsonResponse({'error': str(error)}, status=error.status_code)

    status = item.get('status')
    if not isinstance(status, str):
        return JsonResponse({'error': 'InvokeAI returned a job without a status.'}, status=502)

    response = {'itemId': item_id, 'status': status}
    if status in {'failed', 'canceled'}:
        response['error'] = item.get('error_message') or f'InvokeAI job {status}.'
    elif status == 'completed':
        session = item.get('session')
        results = session.get('results') if isinstance(session, dict) else None
        image_names = InvokeClient.image_names_from_results(results)
        if image_names:
            image_name = image_names[-1]
            response['imageName'] = image_name
            response['imageUrl'] = reverse('api_gateway:anislot_image', args=[image_name])
        else:
            response['error'] = 'InvokeAI completed the job but returned no image output.'

    return JsonResponse(response)


@require_GET
def anislot_image(request, image_name):
    """Proxy a generated InvokeAI image through Django for the frontend."""
    try:
        content, content_type = InvokeClient().download_image(image_name)
    except InvokeError as error:
        return JsonResponse({'error': str(error)}, status=error.status_code)
    return HttpResponse(content, content_type=content_type)


def _optional_text(value):
    if value is None:
        return None
    value = value.strip()
    return value or None


def _optional_integer(value, field_name):
    if value is None or not value.strip():
        return None
    try:
        return int(value)
    except ValueError as error:
        raise ValueError(f'{field_name} must be an integer.') from error


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


@require_POST
def setup(request):
    try:
        payload = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Request body must be valid JSON.'}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({'error': 'Request body must be a JSON object.'}, status=400)

    repository_url = payload.get('repositoryUrl')
    product_id = payload.get('productId')
    if not isinstance(repository_url, str) or not repository_url.strip():
        return JsonResponse({'error': 'repositoryUrl is required.'}, status=400)
    if not isinstance(product_id, int):
        return JsonResponse({'error': 'productId is required.'}, status=400)

    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found.'}, status=404)

    repository_url = repository_url.strip()

    try:
        clone_repository(repository_url, product.name)
    except (ValueError, FileExistsError, RuntimeError) as error:
        return JsonResponse({
            'status': 'failed',
            'error': str(error),
        }, status=400)

    if product.github_url != repository_url:
        product.github_url = repository_url
        product.save(update_fields=['github_url'])

    return JsonResponse({
        'status': 'ready',
        'githubUrl': product.github_url,
    }, status=201)


@require_GET
def setup_status(request):
    try:
        product_id = int(request.GET.get('productId', ''))
    except ValueError:
        return JsonResponse({'error': 'A valid productId is required.'}, status=400)

    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found.'}, status=404)

    destination = repository_destination(product.name)
    if product.github_url and existing_repository_matches(destination, product.github_url):
        return JsonResponse({
            'configured': True,
            'status': 'ready',
            'githubUrl': product.github_url,
        })

    return JsonResponse({'configured': False, 'status': 'not_configured'})


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
