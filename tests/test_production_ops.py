import contextlib
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('production_ops',pathlib.Path(__file__).resolve().parents[1]/'scripts/prepare-production.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)

class Response(io.BytesIO):
    def __init__(self,value):super().__init__(json.dumps(value).encode())

class ProductionOpsTests(unittest.TestCase):
    def run_setup(self,applied=False,status='ACTIVE',identity=None,apply=True):
        requests=[]
        def request(req,timeout=None):
            path=req.full_url.removeprefix(ops.BASE);method=req.get_method();data=req.data
            requests.append((method,path,data))
            if path=='':return Response({'id':identity or ops.REF})
            if path=='/config/auth' and method=='GET':return Response({'site_url':'https://old.test','uri_allow_list':'https://keep.test/**'})
            if path=='/database/query':
                sql=json.loads(data)['query']
                if sql.startswith('select version'):return Response([{'version':v} for v in ['202610160013','202610160014']+([v for v,_ in ops.MIGRATIONS] if applied is True else list(applied) if applied else [])])
                return Response([])
            if path.startswith('/functions/deploy'):
                self.assertIn(b'"verify_jwt": false',data);self.assertIn(b'AI_IMAGES_PAUSED=true',data)
                return Response({'status':status,'version':20})
            if path=='/secrets':
                self.assertEqual({x['name'] for x in json.loads(data)},{'SITE_URL','ALLOWED_ORIGINS'})
                return Response(None)
            if path=='/config/auth' and method=='PATCH':
                settings=json.loads(data);self.assertEqual(settings['site_url'],ops.SITE);self.assertIn('https://keep.test/**',settings['uri_allow_list'])
                return Response(settings)
            self.fail('Unexpected operation '+method+' '+path)
        output=io.StringIO()
        with patch.dict(ops.os.environ,{'SUPABASE_ACCESS_TOKEN':'fixture-management-token'}),patch.object(ops.sys,'argv',['prepare-production.py']+(['--apply'] if apply else [])),patch.object(ops.urllib.request,'urlopen',request),contextlib.redirect_stdout(output):
            ops.main()
        self.assertNotIn('fixture-management-token',output.getvalue())
        return requests

    def test_applies_only_release_and_preserves_provider_secrets(self):
        reqs=self.run_setup();writes=[x for x in reqs if x[0] in ('POST','PATCH')]
        migrations=[json.loads(data)['query'] for method,path,data in writes if path=='/database/query' and 'insert into supabase_migrations' in json.loads(data)['query']]
        self.assertEqual(len(migrations),4);self.assertIn('update public.lk_plans set image_credits=0;',migrations[0]);self.assertIn('create table public.lk_guest_resumes',migrations[1]);self.assertIn('create table public.lk_captain_proposals',migrations[2]);self.assertIn("status in ('created','pending','uncertain','paid')",migrations[3])
        for sql,(version,name) in zip(migrations,ops.MIGRATIONS):
            self.assertTrue(sql.startswith('begin;'));self.assertTrue(sql.endswith('commit;'));self.assertIn("values ('"+version+"','"+name+"'",sql)

    def test_partial_release_applies_only_missing_migrations(self):
        reqs=self.run_setup(applied=[ops.MIGRATIONS[0][0]])
        migrations=[json.loads(data)['query'] for method,path,data in reqs if path=='/database/query' and 'insert into supabase_migrations' in json.loads(data)['query']]
        self.assertEqual(len(migrations),3);self.assertNotIn('update public.lk_plans set image_credits=0;',migrations[0]);self.assertIn(ops.MIGRATIONS[1][0],migrations[0]);self.assertIn(ops.MIGRATIONS[2][0],migrations[1]);self.assertIn(ops.MIGRATIONS[3][0],migrations[2])

    def test_rerun_does_not_reapply_recorded_migration(self):
        reqs=self.run_setup(applied=True)
        self.assertFalse(any(path=='/database/query' and 'insert into supabase_migrations' in json.loads(data)['query'] for method,path,data in reqs if data and path=='/database/query'))

    def test_read_only_default_never_writes_configuration(self):
        reqs=self.run_setup(apply=False)
        self.assertFalse(any(method in ('PATCH','POST') and path!='/database/query' for method,path,_ in reqs))

    def test_wrong_project_or_inactive_deployment_stops(self):
        for values in [{'identity':'wrong-project'},{'status':'FAILED'}]:
            with self.subTest(values=values),self.assertRaises(RuntimeError):self.run_setup(**values)

if __name__=='__main__':unittest.main()
