import json

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

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
