"""A speculative WebView connection must not block the next TLS navigation."""
import os
import http.client
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import unittest


class SecureFixtureTest(unittest.TestCase):
    def test_incomplete_handshake_does_not_block_other_clients(self):
        openssl = os.environ.get('TM_TEST_OPENSSL') or shutil.which('openssl')
        self.assertTrue(openssl, 'Existing OpenSSL is required; do not silently skip the TLS fixture test')
        with tempfile.TemporaryDirectory(prefix='tm-client-fixture-') as temporary:
            directory = Path(temporary).resolve()
            self.assertEqual(directory.parent, Path(tempfile.gettempdir()).resolve())
            cert, key = directory / 'cert.pem', directory / 'key.pem'
            subprocess.run([openssl, 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                            '-keyout', str(key), '-out', str(cert), '-subj', '/CN=localhost', '-days', '1'],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            with socket.socket() as reserve:
                reserve.bind(('127.0.0.1', 0))
                port = reserve.getsockname()[1]
            # The fixture's actual TLS port; a foreign listener fails this test rather than being stopped.
            with socket.socket() as reserve:
                reserve.bind(('127.0.0.1', 8443))
            with (directory / 'server.log').open('w') as log:
                process = subprocess.Popen([sys.executable, '-c',
                                            # Server-name reverse DNS is unrelated to the loopback TLS concurrency contract.
                                            'import socket,runpy,sys; socket.getfqdn=lambda host:"localhost"; runpy.run_path(sys.argv.pop(1),run_name="__main__")',
                                            str(Path(__file__).with_name('smoke_server.py')),
                                            str(port), str(cert), str(key), 'recovery'], stdout=log, stderr=log)
                try:
                    for _ in range(40):
                        self.assertIsNone(process.poll(), 'Fixture exited before becoming ready')
                        try:
                            connection = http.client.HTTPConnection('127.0.0.1', port, timeout=0.2)
                            try:
                                connection.request('GET', '/missing.png')
                                self.assertEqual(connection.getresponse().status, 404)
                            finally:
                                connection.close()
                            break
                        except OSError:
                            time.sleep(0.1)
                    else:
                        self.fail('HTTP fixture did not become ready: ' + (directory / 'server.log').read_text(errors='replace'))
                    context = ssl.create_default_context(cafile=str(cert))
                    with socket.create_connection(('127.0.0.1', 8443), timeout=2) as incomplete:
                        time.sleep(0.1)
                        with socket.create_connection(('127.0.0.1', 8443), timeout=2) as raw:
                            with context.wrap_socket(raw, server_hostname='localhost') as secure:
                                secure.sendall(b'GET /missing.png HTTP/1.0\r\nHost: localhost\r\n\r\n')
                                self.assertIn(b'404', secure.recv(1024))
                        self.assertGreaterEqual(incomplete.fileno(), 0)
                finally:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
