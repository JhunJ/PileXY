"""Read-only CAD/saved-work audit. Conversions and results stay in data/recovery."""
import gzip
import hashlib
import json
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scipy.spatial import cKDTree
from backend.dxf_parser import parse_dxf_entities
from backend.main import _resolve_oda_converter_executable

OUT = ROOT / 'data/recovery/cad_source_audit_20260921'
OUT.mkdir(parents=True, exist_ok=True)
CASES = [
 ('cheongju-new', '청주푸르지오씨엘리체_파일마스터3_260921', '*09.18.dwg', 'work_d4177785ece5'),
 ('cheongju-copy', '청주푸르지오씨엘리체_파일마스터3_260921', '*복사본.dwg', 'work_d4177785ece5'),
 ('cheongju-old', '청주푸르지오씨엘리체_파일마스터2_20260827', '*08.26.dwg', 'work_c47218650053'),
 ('upseong', '천안업성_260831_파일마스터', '260814 업성푸르지오 좌표도.dwg', 'work_665568afeaa9'),
 ('summit-new', '써밋클라비온_파일마스터2_269021', '신길10동좌표도_260908 현장 최종.dwg', 'work_a356fa667716'),
 ('summit-old', '써밋클라비온_260902_파일마스터', '신길10동좌표도0908 우복넘버링 및 좌표기입.dwg', 'work_a049a15a3b85'),
 ('gyeyang', '인천계양A10_파일마스터', '*넘버링)_검토결과.dwg', 'work_d16a795a2555'),
 ('gyeyang-source', '인천계양A10_파일마스터/첨부3.인천계양 A10BL 파일좌표값', '*.dwg', 'work_d16a795a2555'),
]

def parse_source(key, path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    folder = OUT / key
    folder.mkdir(exist_ok=True)
    cache = folder / (digest + '.json.gz')
    if cache.exists():
        with gzip.open(cache, 'rt', encoding='utf-8') as f:
            return json.load(f), digest
    # A changed DWG must never reuse an older conversion with the same filename.
    conversion_folder = folder / digest
    conversion_folder.mkdir(exist_ok=True)
    converted = conversion_folder / (path.stem + '.dxf')
    if not converted.exists():
        startup = subprocess.STARTUPINFO()
        startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = 0
        subprocess.run([_resolve_oda_converter_executable(), str(path.parent), str(conversion_folder),
                        'ACAD2018', 'DXF', '0', '1', path.name], check=True,
                       capture_output=True, timeout=600, startupinfo=startup)
    cs, ts, ps = parse_dxf_entities(str(converted), 0, 100)
    data = {'circles': cs, 'texts': ts, 'polylines': ps, 'source': str(path), 'sha256': digest}
    with gzip.open(cache, 'wt', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    return data, digest

def compare(saved, raw):
    groups = defaultdict(list)
    for c in raw['circles']:
        groups[round(c['radius'], 6)].append(c)
    trees = {r: cKDTree([(c['center_x'], c['center_y']) for c in cs]) for r, cs in groups.items()}
    differences = []
    counts = Counter()
    used = set()
    for c in saved['circles']:
        radius = round(c['radius'], 6)
        distance, index = trees[radius].query([c['center_x'], c['center_y']]) if radius in trees else (float('inf'), 0)
        status = 'same' if distance < 1e-4 else 'different'
        counts[status] += 1
        if status == 'same':
            used.add((radius, int(index)))
        else:
            n = groups[radius][int(index)] if radius in groups else None
            differences.append({'id': c['id'], 'building': c.get('building_name'),
                                'number': (c.get('matched_text') or {}).get('text'),
                                'distance': float(distance) if n else None,
                                'saved': [c['center_x'], c['center_y']],
                                'source': [n['center_x'], n['center_y']] if n else None})
    return {'counts': dict(counts), 'differences': differences,
            'savedCount': len(saved['circles']), 'rawCircleCount': len(raw['circles']),
            'uniqueSourceMatches': len(used)}

def main():
    reports = []
    for key, folder, pattern, work_id in CASES:
        paths = list((ROOT / folder).glob(pattern))
        if len(paths) != 1:
            raise RuntimeError((key, paths))
        print('START', key, str(paths[0]), flush=True)
        raw, digest = parse_source(key, paths[0])
        saved = json.loads((ROOT / 'data/saved_works' / (work_id + '.json')).read_text(encoding='utf-8'))
        report = {'key': key, 'source': str(paths[0]), 'sha256': digest, 'workId': work_id,
                  'title': saved['title'], **compare(saved, raw)}
        reports.append(report)
        (OUT / 'results.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
        print('RESULT', key, report['counts'], 'saved', report['savedCount'], 'raw', report['rawCircleCount'], flush=True)

if __name__ == '__main__':
    main()
