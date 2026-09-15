"""Build an executable InvokeAI graph from the AniSlot editor workflow."""

import json
import os
import uuid
from collections.abc import Mapping
from pathlib import Path


class WorkflowBuildError(Exception):
    """The AniSlot workflow cannot be loaded or converted into a graph."""


class AniSlotWorkflowBuilder:
    """Apply AniSlot job inputs and convert its Invoke editor JSON to a graph."""

    SOURCE_IMAGE_NODE = 'a0b3fc80-5641-4b8f-8011-3939560cd422'
    WIDTH_NODE = '15ec22c8-a8bc-41ae-b317-7f54d6a98eb0'
    POSITIVE_PROMPT_NODE = '130589cd-5fd0-4261-a13c-f9dc0ca7dd66'
    NEGATIVE_PROMPT_NODE = '95eda4be-f9da-4591-9de9-f3647f80ba81'
    SEED_NODE = 'e37fd4f1-5c44-428e-99a3-6ed57ec56f89'

    def __init__(self, workflow_path: str | Path | None = None):
        repository_root = Path(__file__).resolve().parents[2]
        default_path = repository_root / 'workspaces' / 'anislot' / 'workflow' / 'Workflow.json'
        self.workflow_path = Path(
            workflow_path or os.environ.get('ANISLOT_WORKFLOW_PATH', default_path)
        )

    def build(
        self,
        *,
        image_name: str,
        positive_prompt: str | None = None,
        negative_prompt: str | None = None,
        seed: int | None = None,
        width: int | None = None,
    ) -> dict:
        """Return a queue-ready graph with the supplied job values."""
        if not image_name:
            raise ValueError('image_name is required.')
        if seed is not None and (not isinstance(seed, int) or seed < 0):
            raise ValueError('seed must be a non-negative integer.')
        if width is not None and (not isinstance(width, int) or width < 64):
            raise ValueError('width must be an integer of at least 64.')

        workflow = self._load_workflow()
        nodes = self._node_index(workflow)

        self._set_input(nodes, self.SOURCE_IMAGE_NODE, 'image', {'image_name': image_name})
        if positive_prompt is not None:
            self._set_input(nodes, self.POSITIVE_PROMPT_NODE, 'value', positive_prompt)
        if negative_prompt is not None:
            self._set_input(nodes, self.NEGATIVE_PROMPT_NODE, 'value', negative_prompt)
        if seed is not None:
            self._set_input(nodes, self.SEED_NODE, 'seed', seed)
        disconnected_inputs: set[tuple[str, str]] = set()
        if width is not None:
            self._set_input(nodes, self.WIDTH_NODE, 'value', width)
            # The editor workflow normally sets this field to source-image-width / 2.
            # An explicit BetWin width intentionally replaces that automatic value.
            disconnected_inputs.add((self.WIDTH_NODE, 'value'))

        return self._to_graph(workflow, disconnected_inputs)

    def _load_workflow(self) -> dict:
        try:
            raw = self.workflow_path.read_text(encoding='utf-8')
        except OSError as error:
            raise WorkflowBuildError(f'AniSlot workflow was not found at {self.workflow_path}.') from error
        try:
            workflow = json.loads(raw)
        except json.JSONDecodeError as error:
            raise WorkflowBuildError('AniSlot Workflow.json is not valid JSON.') from error
        if not isinstance(workflow, dict) or not isinstance(workflow.get('nodes'), list):
            raise WorkflowBuildError('AniSlot Workflow.json does not contain a nodes list.')
        if not isinstance(workflow.get('edges'), list):
            raise WorkflowBuildError('AniSlot Workflow.json does not contain an edges list.')
        return workflow

    @staticmethod
    def _node_index(workflow: Mapping) -> dict[str, dict]:
        indexed = {
            node['id']: node
            for node in workflow['nodes']
            if isinstance(node, dict) and isinstance(node.get('id'), str)
        }
        if not indexed:
            raise WorkflowBuildError('AniSlot Workflow.json contains no usable nodes.')
        return indexed

    @staticmethod
    def _set_input(nodes: Mapping[str, dict], node_id: str, field: str, value: object) -> None:
        node = nodes.get(node_id)
        inputs = node.get('data', {}).get('inputs') if node else None
        if not isinstance(inputs, dict) or field not in inputs:
            raise WorkflowBuildError(f'Workflow input {node_id}.{field} is missing.')
        inputs[field]['value'] = value

    def _to_graph(self, workflow: Mapping, disconnected_inputs: set[tuple[str, str]]) -> dict:
        nodes_by_id = self._node_index(workflow)
        invocation_nodes = {
            node_id: node
            for node_id, node in nodes_by_id.items()
            if node.get('type') == 'invocation' and isinstance(node.get('data'), dict)
        }
        graph_nodes = {
            node_id: self._to_graph_node(node)
            for node_id, node in invocation_nodes.items()
        }

        graph_edges = []
        for edge in workflow['edges']:
            if not isinstance(edge, dict) or edge.get('type') != 'default':
                continue
            target = edge.get('target')
            target_field = edge.get('targetHandle')
            if target not in invocation_nodes or not isinstance(target_field, str):
                continue
            if (target, target_field) in disconnected_inputs:
                continue
            source = self._resolve_source(edge.get('source'), edge.get('sourceHandle'), nodes_by_id, workflow['edges'])
            if source is None:
                continue
            source_node, source_field = source
            graph_edges.append({
                'source': {'node_id': source_node, 'field': source_field},
                'destination': {'node_id': target, 'field': target_field},
            })

        for edge in graph_edges:
            graph_nodes[edge['destination']['node_id']].pop(edge['destination']['field'], None)

        return {'id': str(uuid.uuid4()), 'nodes': graph_nodes, 'edges': graph_edges}

    @staticmethod
    def _to_graph_node(node: Mapping) -> dict:
        data = node['data']
        node_type = data.get('type')
        if not isinstance(node_type, str):
            raise WorkflowBuildError(f"Invocation node {node['id']} has no type.")

        graph_node = {
            'id': node['id'],
            'type': node_type,
            'is_intermediate': bool(data.get('isIntermediate', False)),
            'use_cache': bool(data.get('useCache', True)),
        }
        for field, input_data in data.get('inputs', {}).items():
            if not isinstance(input_data, dict) or 'value' not in input_data:
                continue
            value = input_data['value']
            # "auto" is a UI-only board choice. Omitting it lets InvokeAI use no board.
            if field == 'board' and value == 'auto':
                continue
            graph_node[field] = value
        return graph_node

    def _resolve_source(self, node_id: object, field: object, nodes_by_id: Mapping[str, dict], edges: list):
        """Resolve connector nodes to the invocation field that feeds them."""
        if not isinstance(node_id, str) or not isinstance(field, str):
            return None
        node = nodes_by_id.get(node_id)
        if node is None:
            return None
        if node.get('type') == 'invocation':
            return node_id, field
        if node.get('type') != 'connector':
            return None

        incoming = [
            edge for edge in edges
            if isinstance(edge, dict) and edge.get('type') == 'default' and edge.get('target') == node_id
        ]
        if len(incoming) != 1:
            raise WorkflowBuildError(f'Connector node {node_id} must have exactly one input.')
        parent = incoming[0]
        return self._resolve_source(parent.get('source'), parent.get('sourceHandle'), nodes_by_id, edges)