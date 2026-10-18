"""Read-only production checks; unsigned webhook requests must be rejected.
Run: python scripts/smoke-production.py
Does not create gifts, charges, users or email.
"""
import json, sys, urllib.error, urllib.request

SITE = 'https://lovekoala.com.br'


def check(path, expected_status, expected, method='GET', marker=None):
    req = urllib.request.Request(SITE + path, method=method, data=b'{}' if method == 'POST' else None, headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    data = response.read()
    status = response.status
    if status != expected_status or expected not in data or (marker and response.headers.get('x-lovekoala-webhook') != marker):
        raise RuntimeError('Unexpected production response at ' + path + ' (HTTP ' + str(status) + ')')
    print(json.dumps({'path': path, 'status': status, 'passed': True}))


try:
    check('/healthz', 200, b'"service":"lovekoala"')
    for path in ['/', '/criar', '/conta', '/admin', '/presente/verificacao-de-rota']:
        check(path, 200, b'<div id="root">')
    for provider in ['stripe', 'mercosulpay']:
        check('/api/webhooks/' + provider, 401, b'BAD_SIGNATURE', 'POST', provider)
except (RuntimeError, urllib.error.URLError, TimeoutError) as error:
    print('Production check failed: ' + str(error), file=sys.stderr)
    sys.exit(1)
