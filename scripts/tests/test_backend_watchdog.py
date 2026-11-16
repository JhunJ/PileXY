"""Windows-only watchdog smoke tests; random ports, real venv, no live app data."""
import ctypes
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import urlopen


SCRIPTS = Path(__file__).resolve().parents[1]
FAKE_UVICORN = r'''
import argparse, ctypes, json, os, subprocess, sys, time
import watchdog_fixture_dependency
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('app')
p.add_argument('--host')
p.add_argument('--port', type=int)
args = p.parse_args()
mode = Path('mode.txt').read_text()
events = Path('starts.jsonl')
prior = events.read_text().splitlines() if events.exists() else []
# Direct binaries inherit the job; Store execution aliases deliberately broker
# a separate application activation and cannot represent Node/ODA descendants.
buffer = ctypes.create_unicode_buffer(32768)
ctypes.windll.kernel32.GetModuleFileNameW(None, buffer, len(buffer))
child = subprocess.Popen([buffer.value, '-c', 'import time; time.sleep(300)'])
Path('runtime.json').write_text(json.dumps({'prefix': sys.prefix, 'executable': sys.executable}))
with events.open('a') as stream:
    stream.write(json.dumps({'pid': os.getpid(), 'child': child.pid}) + '\n')
if mode == 'crash_once' and not prior:
    sys.exit(17)
started = time.monotonic()
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if mode == 'stalled' or (mode == 'brief_stall' and time.monotonic()-started < 4):
            time.sleep(30)
            return
        self.send_response(200)
        self.send_header('Content-Length', '2')
        self.end_headers()
        self.wfile.write(b'ok')
    def log_message(self, *args):
        pass
ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
'''


def wait_until(check, seconds=25):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.1)
    raise AssertionError('Condition did not become true before timeout')


def process_alive(pid):
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
    kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel.OpenProcess(0x100000, False, pid)
    if not handle:
        return False
    try:
        return kernel.WaitForSingleObject(handle, 0) == 0x102
    finally:
        kernel.CloseHandle(handle)


@unittest.skipUnless(os.name == 'nt', 'PowerShell watchdog runs on Windows')
class BackendWatchdogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='pilexy watchdog smoke-')
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        for name in ('run_server_forever.ps1', 'pilexy_watchdog_native.ps1'):
            shutil.copy2(SCRIPTS / name, self.root / 'scripts' / name)
        subprocess.run([sys.executable, '-m', 'venv', '--without-pip',
                        str(self.root / 'backend' / '.venv')], check=True, timeout=30)
        (self.root / 'backend' / '.venv' / 'Lib' / 'site-packages' /
         'watchdog_fixture_dependency.py').write_text('VENV_IMPORT_OK = True\n')
        (self.root / 'uvicorn.py').write_text(FAKE_UVICORN, encoding='utf-8')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        self.watchdogs = []
        self.others = []
        self.output_handles = []

    def starts(self):
        try:
            return [json.loads(line) for line in (self.root / 'starts.jsonl').read_text().splitlines()]
        except (OSError, ValueError):
            return []

    def start_watchdog(self, mode='healthy', grace=8):
        (self.root / 'mode.txt').write_text(mode)
        output = (self.root / f'watchdog-{len(self.watchdogs)}.txt').open('w')
        self.output_handles.append(output)
        process = subprocess.Popen([
            'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', str(self.root / 'scripts' / 'run_server_forever.ps1'),
            '-Port', str(self.port), '-HealthCheckIntervalSeconds', '1',
            '-HealthTimeoutSeconds', '1', '-UnhealthyRestartAfterSeconds', str(grace),
            '-RestartDelaySeconds', '1',
        ], stdout=output, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
        self.watchdogs.append(process)
        return process

    def healthy(self):
        try:
            with urlopen(f'http://127.0.0.1:{self.port}/', timeout=1) as response:
                return response.read() == b'ok'
        except OSError:
            return False

    def stop_watchdog(self, process):
        if process.poll() is None:
            process.kill()  # Bypass PowerShell finally, as an external task stop can.
            process.wait(timeout=10)

    def tearDown(self):
        for process in self.watchdogs + self.others:
            self.stop_watchdog(process)
        for entry in self.starts():
            for pid in entry.values():
                if process_alive(pid):
                    os.kill(pid, 15)  # Only fixture PIDs recorded inside this temp tree.
        for handle in self.output_handles:
            handle.close()
        report_root = os.environ.get('PILEXY_WATCHDOG_TEST_LOGS')
        if report_root:
            destination = Path(report_root) / self._testMethodName
            shutil.copytree(self.root / 'logs', destination / 'logs', dirs_exist_ok=True)
            for fixture_file in self.root.glob('*.txt'):
                shutil.copy2(fixture_file, destination / fixture_file.name)
        # Windows may release image mappings just after the last process exits.
        for attempt in range(20):
            try:
                self.temp.cleanup()
                break
            except PermissionError:
                if attempt == 19:
                    raise
                time.sleep(0.1)

    def test_single_instance_and_forced_parent_exit_clean_real_venv_tree(self):
        process = self.start_watchdog()
        wait_until(self.healthy)
        started = self.starts()[0]
        runtime = json.loads((self.root / 'runtime.json').read_text())
        self.assertEqual(Path(runtime['prefix']), self.root / 'backend' / '.venv')
        self.assertEqual(Path(runtime['executable']), self.root / 'backend' / '.venv' / 'Scripts' / 'python.exe')
        self.assertTrue(process_alive(started['pid']))
        self.assertTrue(process_alive(started['child']))
        duplicate = self.start_watchdog()
        self.assertEqual(duplicate.wait(timeout=15), 0)
        self.assertEqual(len(self.starts()), 1)
        self.assertTrue(self.healthy())
        self.stop_watchdog(process)
        wait_until(lambda: not any(process_alive(pid) for pid in started.values()), seconds=10)

    def test_crashed_backend_restarts_without_orphaned_child(self):
        self.start_watchdog(mode='crash_once')
        wait_until(lambda: len(self.starts()) >= 2)
        wait_until(self.healthy)
        first = self.starts()[0]
        wait_until(lambda: not any(process_alive(pid) for pid in first.values()), seconds=10)
        self.assertEqual(len(self.starts()), 2)

    def test_persistent_http_stall_restarts_and_transient_stall_recovers(self):
        process = self.start_watchdog(mode='stalled', grace=5)
        wait_until(lambda: len(self.starts()) >= 2)
        first = self.starts()[0]
        self.assertFalse(process_alive(first['pid']))
        self.assertFalse(process_alive(first['child']))
        self.stop_watchdog(process)
        (self.root / 'starts.jsonl').unlink()
        process = self.start_watchdog(mode='brief_stall', grace=10)
        wait_until(self.healthy)
        time.sleep(7)
        self.assertEqual(len(self.starts()), 1)
        log = (self.root / 'logs' / 'watchdog.log').read_text(encoding='utf-8-sig')
        self.assertIn('local HTTP response recovered', log)

    def test_unrelated_listener_is_preserved(self):
        output = (self.root / 'unrelated.txt').open('w')
        self.output_handles.append(output)
        unrelated = subprocess.Popen([
            sys.executable, '-m', 'http.server', str(self.port), '--bind', '127.0.0.1',
        ], cwd=self.root, stdout=output, stderr=output, creationflags=subprocess.CREATE_NO_WINDOW)
        self.others.append(unrelated)
        def listening():
            try:
                with socket.create_connection(('127.0.0.1', self.port), timeout=0.3):
                    return True
            except OSError:
                return False
        wait_until(listening)
        self.start_watchdog()
        wait_until(lambda: (self.root / 'logs' / 'watchdog.log').exists())
        time.sleep(4)
        self.assertIsNone(unrelated.poll())
        self.assertEqual(self.starts(), [])
        log = (self.root / 'logs' / 'watchdog.log').read_text(encoding='utf-8-sig')
        self.assertIn('leaving them running', log)


if __name__ == '__main__':
    unittest.main(verbosity=2)
