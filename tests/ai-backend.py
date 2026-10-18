"""Live checks after deploying the paused-image release. Hidden JSON on stdin.
No fixtures, purchases, uploads, publications or email; only one Koala conversation.
Input: {"ref": "...", "public_key": "...", "origin": "https://lovekoala.com.br"}
"""
import json, sys, termios, urllib.error, urllib.request
try:
    settings=termios.tcgetattr(sys.stdin);settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,settings)
except (termios.error, ValueError):
    pass
print('Ready for AI backend JSON on stdin (hidden).', flush=True)
cfg=json.loads(sys.stdin.readline());root='https://'+cfg['ref']+'.supabase.co/functions/v1/lovekoala-api';origin=cfg.get('origin','https://lovekoala.com.br')

def call(body, suffix=''):
    request=urllib.request.Request(root+suffix, method='POST', data=json.dumps(body).encode(), headers={'Content-Type':'application/json','apikey':cfg['public_key'],'Origin':origin})
    try:
        return urllib.request.urlopen(request, timeout=100)
    except urllib.error.HTTPError as error:
        return error

config=json.load(call({'action':'config'}))
assert config['readiness']['images'] is False
assert all(p['image_credits']==0 and not p['ai_available'] for p in config['plans'])
print(json.dumps({'passed':'Image generation is absent from public plans/readiness'}), flush=True)
for action in ['ai_setup','ai_prepare','ai_include']:
    response=call({'action':action})
    assert response.status==503 and json.load(response)['code']=='IMAGE_GENERATION_PAUSED'
print(json.dumps({'passed':'Image routes are paused without starting provider calls'}), flush=True)
response=call({'action':'koala_chat','page':'home','messages':[{'role':'user','content':'Me mostra um exemplo de retrospectiva do plano Para sempre.'}]},'?forceFunctionRegion=us-west-1')
assert response.status==200
kind='';done=False;actions=[];text=''
for raw in response:
    line=raw.decode().strip()
    if line.startswith('event:'):kind=line[6:].strip()
    elif line.startswith('data:'):
        data=json.loads(line[5:])
        if kind=='delta':text+=data.get('text','')
        elif kind=='done':done=True
        elif kind=='error':raise RuntimeError('Koala did not complete the response.')
        elif kind=='action':actions.append(data)
assert done and text and actions and actions[0]['destination']=='examples' and actions[0]['format']=='retrospectiva' and actions[0]['automatic'] is True
print(json.dumps({'passed':'Real conversation completed with a validated example navigation intent','charges_created':False,'email_sent':False,'private_content_sent':False}), flush=True)
