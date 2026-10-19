"""Uses the existing Git Credential Manager account, never logs credentials.
Run with --check to verify identity; --publish creates a public repo only if absent.
"""
import json, os, subprocess, sys, urllib.request, urllib.error
env = dict(os.environ, GCM_INTERACTIVE='Never', GIT_TERMINAL_PROMPT='0')
result = subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env=env)
credential = dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
token = credential.get('password')
if not token:
    print('NO_SAVED_GITHUB_CREDENTIAL'); sys.exit(2)
def api(path, method='GET', body=None):
    req=urllib.request.Request('https://api.github.com'+path,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'vmeste-publisher'})
    with urllib.request.urlopen(req,timeout=30) as response:
        content=response.read();return json.loads(content) if content else {}
try:
    user=api('/user'); print('GITHUB_ACCOUNT',user['login'])
    if '--publish' in sys.argv:
        repo='vmeste'; full=user['login']+'/'+repo
        try:
            api('/repos/'+full)
            print('REPOSITORY_ALREADY_EXISTS_NO_CHANGES',full);sys.exit(3)
        except urllib.error.HTTPError as e:
            if e.code!=404:raise
        created=api('/user/repos','POST',{'name':repo,'description':'Вместе — уютное PWA для двоих: идеи, игры, планы и прямая синхронизация.','private':False,'auto_init':False})
        subprocess.run(['git','remote','add','origin',created['clone_url']],check=True)
        subprocess.run(['git','push','-u','origin','main'],check=True,env=env)
        try: pages=api('/repos/'+full+'/pages','POST',{'build_type':'legacy','source':{'branch':'main','path':'/'}})
        except urllib.error.HTTPError as e:
            print('PAGES_SETUP_STATUS',e.code);pages={}
        print('REPOSITORY',created['html_url']);print('PAGES',pages.get('html_url','https://'+user['login']+'.github.io/'+repo+'/'))
except urllib.error.HTTPError as e:
    print('GITHUB_API_STATUS',e.code);sys.exit(1)
except Exception as e:
    print('GITHUB_OPERATION_FAILED',type(e).__name__);sys.exit(1)
