"""Verify an existing owner's paid order and optionally finish publication.

Reads credentials from hidden stdin; never creates a charge or overrides payment.
Prints only payment/access/publication state, never private gift content or tokens.
"""
import json, sys, termios, urllib.request, urllib.error

try:
    settings = termios.tcgetattr(sys.stdin)
    settings[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin, termios.TCSANOW, settings)
except (termios.error, ValueError):
    pass
print('Ready for owner recovery JSON on stdin (input is hidden).', flush=True)
cfg = json.loads(sys.stdin.readline())
root = 'https://' + cfg['ref'] + '.supabase.co'
headers = {'apikey': cfg['public_key'], 'Content-Type': 'application/json',
           'Origin': 'https://lovekoala.contatodaflonedu.chatgpt.site'}

def request(path, body):
    req = urllib.request.Request(root + path, data=json.dumps(body).encode(),
                                 headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=55) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read())
        except (ValueError, UnicodeError):
            detail = {}
        code = detail.get('error', {})
        print(json.dumps({'ok': False, 'status': error.code,
                          'code': detail.get('code') or (code.get('code', 'request_rejected') if isinstance(code, dict) else 'request_rejected'),
                          'message': (detail.get('message') or (code if isinstance(code, str) else ''))[:500]}))
        sys.exit(1)

login = request('/auth/v1/token?grant_type=password', cfg['admin'])
headers['Authorization'] = 'Bearer ' + login['access_token']

def api(action, **body):
    return request('/functions/v1/lovekoala-api', {'action': action, **body})

gift_id = cfg['gift_id']
if cfg.get('diagnostic_only'):
    print(json.dumps(api('admin_payment_check', order_id=cfg['order_id'])))
    sys.exit(0)
editor = api('editor', gift_id=gift_id)['gift']
if editor.get('owner_user_id') != login['user']['id']:
    raise SystemExit('Owner mismatch; no publication attempted.')
state = api('order_status', gift_id=gift_id, order_id=cfg['order_id'])
print(json.dumps({'order_status': state['order']['status'],
                  'access_ready': state.get('access_ready', False)}), flush=True)
if not state.get('access_ready'):
    raise SystemExit('Verified access is not ready; no publication attempted.')
editor = api('editor', gift_id=gift_id)['gift']
if cfg.get('publish'):
    if editor.get('public_consent') is not True:
        raise SystemExit('Stored publication consent is absent; no publication attempted.')
    slug = editor['slug']
    published = api('publish', gift_id=gift_id, slug=slug, public_consent=True)
    public = api('gift', slug=published['slug'])['gift']
    print(json.dumps({'ok': public['status'] == 'published', 'slug': public['slug'],
                      'status': public['status'], 'photo_count': len(public['photos']),
                      'expires_at': public['expires_at'], 'new_charge_created': False}))
