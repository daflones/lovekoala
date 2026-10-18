import {useEffect,useState} from 'react';
import {Check,ExternalLink,Globe,Loader2,RefreshCw} from 'lucide-react';
import {api} from './api';
export default function AdminProduction(){
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function check(verify=false){setBusy('check');setError('');try{setData(await api('admin_production_status',{verify},undefined,45000));}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 useEffect(()=>{void check();},[]);
 async function activate(){setBusy('activate');setError('');setMessage('');try{await api('admin_production_activate',{},undefined,65000);setMessage('Webhooks ativados em lovekoala.com.br. As próximas cobranças Pix usarão esse endereço.');await check(true);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 const ready=data?.checks?.length===2&&data.checks.every((c:any)=>c.ready);
 return <section className="admin-card production-card"><div className="admin-card-title"><h2><Globe size={19}/> Domínio de produção</h2><span className={'admin-ai-status '+(data?.custom_domain_active?'ready':'')}>{data?.custom_domain_active?'Domínio ativado':'Preparação'}</span></div>
  <p>Depois de publicar no EasyPanel e habilitar HTTPS, verifique as duas rotas e ative os webhooks do domínio.</p>
  <a href="https://lovekoala.com.br" target="_blank" rel="noreferrer">lovekoala.com.br <ExternalLink size={13}/></a>
  <dl><dt>Domínio de produção</dt><dd>{data?.site_url||'Aguardando verificação do backend'}</dd><dt>Stripe</dt><dd>{data?.stripe_url||'Aguardando verificação'}</dd><dt>Callback das novas cobranças Pix</dt><dd>{data?.webhook_base?data.webhook_base+'/mercosulpay':'Aguardando verificação'}</dd></dl>
  {data?.environment_site_url&&data.environment_site_url!==data.production_url&&<p className="production-probe">O endereço padrão do servidor ainda aponta para {data.environment_site_url}. O guia EasyPanel explica como alinhar a configuração de domínio e autenticação.</p>}
  {data?.checks?.map((c:any)=><p className="production-probe" key={c.provider}><span>{c.ready?<Check size={15}/>:<RefreshCw size={15}/>} {c.provider==='stripe'?'Stripe':'MercosulPay'}</span><strong>{c.ready?'Proxy HTTPS verificado':'Ainda não respondeu como esperado'}</strong></p>)}
  <div className="production-actions"><button className="button-secondary" disabled={!!busy} onClick={()=>check(true)}>{busy==='check'?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} Verificar domínio</button><button className="button-primary" disabled={!!busy||!ready||data?.custom_domain_active} onClick={activate}>{busy==='activate'?<Loader2 className="spin" size={16}/>:<Globe size={16}/>} Ativar webhooks no domínio</button></div>
  <small>As assinaturas e cobranças existentes são preservadas. A ativação mantém o segredo de assinatura do endpoint Stripe e altera somente o webhook dedicado do LoveKoala.</small>
  {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
 </section>;
}
