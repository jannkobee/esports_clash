"""Measured technical quality, never a substitute for an artistic review."""
import math

FEATURES = ['skeleton_failure', 'unweighted', 'weight_errors', 'gltf_errors',
            'intersection_growth', 'foot_drift', 'hand_jump', 'render_regression',
            'silhouette_clipping', 'silhouette_readability']


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


class AssetQualityEvaluator:
    version = 'technical-quality-v1'

    def evaluate(self, state):
        report = state.get('report') or {}
        geometry = report.get('geometry') or {}
        candidate = next(iter(report.get('candidates') or []), {})
        render = candidate.get('render') or {}
        baseline = (report.get('baseline') or {}).get('render') or {}
        visual = VisualQualityCritic().evaluate(render)
        missing = []

        def number(value, name, default=1):
            if not finite(value) or value < 0:
                missing.append(name)
                return default
            return value

        gates = geometry.get('gates') or {}
        if not isinstance(gates.get('skeleton', {}).get('passed'), bool):
            missing.append('skeleton_gate')
        bind = number(geometry.get('bind', {}).get('self_intersections'), 'bind_intersections', 0)
        frames = geometry.get('frames') or []
        intersections = [number(frame.get('self_intersections'), 'posed_intersections', bind) for frame in frames]
        if not frames:
            missing.append('stress_poses')
        frame_ms = number(render.get('renderer', {}).get('mean_frame_ms'), 'frame_cost')
        base_ms = number(baseline.get('renderer', {}).get('mean_frame_ms'), 'baseline_frame_cost')
        foot = number(render.get('planted_foot_step_drift'), 'foot_drift')
        base_foot = number(baseline.get('planted_foot_step_drift'), 'baseline_foot_drift')
        hand = number(render.get('blend_hand_step_jump'), 'hand_jump')
        base_hand = number(baseline.get('blend_hand_step_jump'), 'baseline_hand_jump')
        vector = [
            float(gates.get('skeleton', {}).get('passed') is not True),
            min(1, number(geometry.get('unweighted_vertices'), 'unweighted') / 100),
            min(1, number(geometry.get('invalid_weight_sums'), 'weight_errors') / 100),
            min(1, number(report.get('gltf', {}).get('errors'), 'gltf_errors') / 10),
            min(1, max(0, max(intersections, default=bind) - bind) / 1000),
            min(1, max(0, foot - base_foot) / max(.001, base_foot)),
            min(1, max(0, hand - base_hand) / max(.001, base_hand)),
            min(1, max(0, frame_ms / max(.001, base_ms) - 1)),
            visual['clipped_fraction'], visual['unreadable_fraction'],
        ]
        reasons = list(report.get('reasons') or [])
        if report.get('qualification_complete') is not True:
            missing.append('completed_qualification')
        if visual['status'] == 'incomplete':
            missing.append('multi_view_silhouettes')
        hard_pass = (not missing and not reasons and not visual['clipped_fraction'] and not visual['unreadable_fraction']
                     and foot <= base_foot + .001 and hand <= base_hand + .001
                     and geometry.get('unweighted_vertices') == 0 and geometry.get('invalid_weight_sums') == 0
                     and report.get('gltf', {}).get('errors') == 0 and geometry.get('passed') is True
                     and candidate.get('validation', {}).get('passed') is True
                     and render.get('passed') is True and render.get('gameplay', {}).get('passed') is True)
        failures = [name for name, value in zip(FEATURES, vector) if value > 0]
        return {'version': self.version, 'features': dict(zip(FEATURES, vector)),
                'hard_pass': hard_pass, 'missing_measurements': sorted(set(missing)),
                'failure_classes': failures, 'reasons': reasons,
                'visual_critic': visual,
                'technical_score': round(max(0, 100 - sum(v * w for v, w in zip(vector, [25, 20, 15, 20, 5, 5, 5, 5, 5, 5]))), 3)
                if not missing else None,
                'artistic_quality': 'unrated',
                'correction_priority': self.correction(failures),
                'scope': 'Measured geometry/contact/renderer and silhouette features; no trained pixel/artistic critic yet'}

    @staticmethod
    def correction(failures):
        if 'unweighted' in failures or 'weight_errors' in failures:
            return 'deterministic_skin_repair'
        if 'foot_drift' in failures or 'hand_jump' in failures:
            return 'contact_or_socket_parameter_review'
        if 'skeleton_failure' in failures:
            return 'alternative_compatible_rig'
        if 'intersection_growth' in failures:
            return 'deformation_review'
        return 'curated_visual_review'


class VisualQualityCritic:
    def evaluate(self, render):
        views = render.get('views') or []
        poses = render.get('gameplay', {}).get('views') or []
        missing = []
        if not {'front', 'side', 'back'} <= {view.get('name') for view in views}:
            missing.append('front_side_back')
        if not {'idle', 'attack', 'ability'} <= {view.get('name') for view in poses}:
            missing.append('critical_gameplay_poses')
        clipped, unreadable = 0, 0
        for view in views + poses:
            silhouette = view.get('silhouette') or {}
            if not finite(silhouette.get('occupied_pixels')) or not isinstance(silhouette.get('clipped'), bool):
                missing.append('silhouette_measurement')
                continue
            clipped += int(silhouette['clipped'])
            threshold = 100 if view in views else 10
            unreadable += int(silhouette['occupied_pixels'] <= threshold)
        count = max(1, len(views) + len(poses))
        return {'status': 'incomplete' if missing else 'measured', 'views': len(views), 'critical_poses': len(poses),
                'clipped_fraction': clipped / count, 'unreadable_fraction': unreadable / count,
                'missing': sorted(set(missing)), 'artistic_assessment': 'requires_curated_rating'}


class AutoRiggingOrchestrator:
    """Rank real stress-tested candidates; generation stays in admitted workers."""
    def select(self, candidates, profile, budget=3):
        if not 1 <= budget <= 8:
            raise ValueError('Rig candidate budget must be between 1 and 8')
        comparisons = []
        for candidate in candidates[:budget]:
            quality = AssetQualityEvaluator().evaluate(candidate['state'])
            compatible = profile in candidate.get('supported_profiles', [])
            comparisons.append({'id': candidate['id'], 'backend': candidate['backend'],
                                'seed': candidate['seed'], 'model_version': candidate['model_version'],
                                'compatible': compatible, 'quality': quality})
        valid = [item for item in comparisons if item['compatible'] and item['quality']['hard_pass']]
        valid.sort(key=lambda item: (-item['quality']['technical_score'], item['id']))
        return {'selected': valid[0]['id'] if valid else None, 'comparisons': comparisons,
                'status': 'qualified_candidate' if valid else 'needs_improvement'}


def evaluate_vfx(events, expected_class, tolerance_s=.05):
    """Offline event evidence only; never emits gameplay hits or changes timing."""
    issues = []
    if not events:
        issues.append('missing_event_evidence')
    for event in events:
        if event.get('class') != expected_class:
            issues.append('class_mismatch')
        if not finite(event.get('gameplay_time')) or not finite(event.get('visual_time')):
            issues.append('missing_timing')
        elif abs(event['gameplay_time'] - event['visual_time']) > tolerance_s:
            issues.append('event_desynchronization')
        if event.get('type') not in {'cast', 'release', 'hit', 'trail', 'interrupt'}:
            issues.append('unknown_event')
    return {'passed': not issues, 'issues': sorted(set(issues)), 'samples': len(events)}
