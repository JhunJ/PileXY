import asyncio
import hashlib
import inspect
from types import SimpleNamespace

import pytest
from backend import main


class UploadRequest:
    def __init__(self, data):
        self.data = data

    async def stream(self):
        yield self.data

    async def body(self):
        return self.data


@pytest.mark.parametrize('chunked', [False, True])
def test_upload_returns_received_source_identity_for_both_upload_routes(tmp_path, monkeypatch, chunked):
    monkeypatch.setattr(main.tempfile, 'tempdir', str(tmp_path))
    monkeypatch.setattr(main, 'CHUNKED_UPLOAD_DIR', str(tmp_path / 'chunks'))
    monkeypatch.setattr(main, 'parse_dxf_entities', lambda *args: ([], [], []))
    monkeypatch.setattr(main, 'update_cached_result', lambda filters: SimpleNamespace())
    data = b'new CAD source, distinct from the previous saved drawing'
    endpoint = main.upload_dxf_chunk if chunked else main.upload_dxf
    kwargs = {name: getattr(p.default, 'default', p.default)
              for name, p in inspect.signature(endpoint).parameters.items() if name != 'request'}
    kwargs.update(filename='new.dxf', reuse_manual_history=False)
    if chunked:
        kwargs.update(upload_id='test-source', chunk_index=0, total_chunks=1)
    token = main._circle_workspace_ctx.set(main.CircleWorkspace())
    try:
        result = asyncio.run(endpoint(UploadRequest(data), **kwargs))
        assert result.source_metadata['filename'] == 'new.dxf'
        assert result.source_metadata['sha256'] == hashlib.sha256(data).hexdigest()
        assert result.source_metadata['size'] == len(data)
    finally:
        main._circle_workspace_ctx.reset(token)


def test_repaired_source_rejects_pre_repair_browser_save():
    existing = {'sourceMetadata': {'sha256': 'verified-source'}}
    with pytest.raises(main.HTTPException) as error:
        main._check_saved_work_source(existing, {'circles': []})
    assert error.value.status_code == 409
    main._check_saved_work_source(existing, {'sourceMetadata': {'sha256': 'verified-source'}})
    # A deliberate replacement with a newly uploaded source still works.
    main._check_saved_work_source(existing, {'sourceMetadata': {'sha256': 'new-source'}})
    with pytest.raises(main.HTTPException):
        main._check_saved_work_source(existing, {'sourceMetadata': {'sha256': 'other-source'}}, patch=True)


def test_legacy_saved_work_without_provenance_remains_editable():
    main._check_saved_work_source({}, {'circles': []})
