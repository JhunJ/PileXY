"""Prepare (do not publish) a repair from the audited September CAD source."""
import copy
import gzip
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scipy.spatial import cKDTree
from backend.main import _build_filtered_circle_response, _normalize_saved_work_filter, _normalize_saved_work_buildings

OUT = ROOT / 'data/recovery/cad_source_audit_20260921'
SOURCE = OUT / 'cheongju-new'
with gzip.open(next(SOURCE.glob('*.json.gz')), 'rt', encoding='utf-8') as f:
    raw = json.load(f)
original = json.loads((ROOT / 'data/saved_works/work_d4177785ece5.json').read_text(encoding='utf-8'))
candidate = copy.deepcopy(original)

# Keep existing identities for their uniquely nearest CAD entity, so saved
# construction references do not move to a different pile when CAD IDs change.
groups = defaultdict(list)
for c in raw['circles']:
    groups[round(c['radius'], 6)].append(c)
trees = {r: cKDTree([(c['center_x'], c['center_y']) for c in cs]) for r, cs in groups.items()}
renames = {}
for c in original['circles']:
    radius = round(c['radius'], 6)
    indices = trees[radius].query_ball_point([c['center_x'], c['center_y']], .3)
    choices = [groups[radius][int(index)] for index in sorted(indices)
               if groups[radius][int(index)]['id'] not in renames]
    assert choices, c['id']
    target = min(choices, key=lambda n: (n['center_x']-c['center_x'])**2 + (n['center_y']-c['center_y'])**2)
    renames[target['id']] = c['id']
for c in raw['circles']:
    c['id'] = renames.get(c['id'], 'cad260921-' + c['id'])

text_groups = defaultdict(list)
for t in raw['texts']:
    text_groups[t['text']].append(t)
text_renames = {}
for t in original['texts']:
    choices = text_groups.get(t['text'], [])
    if not choices:
        continue
    x, y = t['text_center_x'], t['text_center_y']
    target = min(choices, key=lambda item: (item['text_center_x'] - x)**2 + (item['text_center_y'] - y)**2)
    distance = ((target['text_center_x'] - x)**2 + (target['text_center_y'] - y)**2)**.5
    if distance < .001:
        assert target['id'] not in text_renames
        text_renames[target['id']] = t['id']
for t in raw['texts']:
    t['id'] = text_renames.get(t['id'], 'cad260921-' + t['id'])

response = _build_filtered_circle_response(
    raw['circles'], raw['texts'], _normalize_saved_work_filter(original['filter']),
    expected_buildings=original['buildingCount'],
    buildings=_normalize_saved_work_buildings(original['buildings']),
    manual_overrides_map=original.get('manualOverrides'), response_polylines=raw['polylines'])
candidate.update({
    'circles': [c.model_dump() for c in response.circles],
    'texts': [t.model_dump() for t in response.texts],
    'errors': [e.model_dump() for e in response.errors],
    'duplicates': [d.model_dump() for d in response.duplicates],
    'summary': response.summary.model_dump(),
    'buildingSummary': [b.model_dump() for b in response.building_summary],
    'rawPolylines': raw['polylines'],
    'pileClusters': [c.model_dump() for c in response.pile_clusters],
    'clusterPolylines': [p.model_dump() for p in response.cluster_polylines],
    'sourceFileName': Path(raw['source']).name,
    'sourceMetadata': {'filename': Path(raw['source']).name, 'sha256': raw['sha256'],
                       'size': Path(raw['source']).stat().st_size,
                       'repairedFromSource': True},
})
assert len({c['id'] for c in candidate['circles']}) == len(candidate['circles'])
assert {c['id'] for c in original['circles']} <= {c['id'] for c in candidate['circles']}
old_by_id = {c['id']: c for c in original['circles']}
changed = [c for c in candidate['circles'] if c['id'] in old_by_id and
           abs(c['center_x'] - old_by_id[c['id']]['center_x']) + abs(c['center_y'] - old_by_id[c['id']]['center_y']) > 1e-4]
print('candidate circles',len(candidate['circles']),'moved',len(changed),'added',len(candidate['circles'])-len(original['circles']))
print('109-249',[(c['id'],c['center_x'],c['center_y']) for c in candidate['circles'] if (c.get('matched_text') or {}).get('text')=='109-249'])
(OUT / 'cheongju-repaired-candidate.json').write_text(json.dumps(candidate,ensure_ascii=False),encoding='utf-8')
