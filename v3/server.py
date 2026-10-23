"""Loopback-only development dashboard. No production services are changed."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from .report import report_bundle


def serve(root, port=8763):
    root = Path(root)
    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, value, mime='application/json'):
            body = value if isinstance(value, bytes) else json.dumps(value, allow_nan=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == '/':
                return self.respond(200, Path(__file__).with_name('dashboard.html').read_bytes(), 'text/html; charset=utf-8')
            if self.path == '/api/report':
                return self.respond(200, report_bundle(root))
            if self.path == '/api/records':
                from .predict import score_records
                from .records import Ledger
                records = Ledger(root / 'predictions.sqlite')
                return self.respond(200, {'events': records.rows(), 'scores': score_records(root), 'verified': records.verify()})
            self.respond(404, {'error': 'Not found'})

        def do_POST(self):
            # Browser requests must originate from this exact loopback dashboard.
            if self.headers.get('Origin') != f'http://127.0.0.1:{port}':
                return self.respond(403, {'error': 'Local dashboard origin required'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'JSON required'})
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 2_000_000:
                return self.respond(413, {'error': 'Invalid payload length'})
            try:
                payload = json.loads(self.rfile.read(size))
                from .predict import predict, record_result
                operation = {'/api/predict': predict, '/api/result': record_result}.get(self.path)
                if operation is None:
                    return self.respond(404, {'error': 'Not found'})
                self.respond(200, operation(root, payload))
            except (ValueError, KeyError, TypeError, OSError) as error:
                self.respond(400, {'error': str(error)})
            except Exception:
                self.respond(409, {'error': 'Record already exists or operation failed; original records retained'})
    print(f'Development dashboard: http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
