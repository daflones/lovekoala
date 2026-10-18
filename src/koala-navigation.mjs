// The model selects an intent, never a URL, script, payment or account mutation.
export const KOALA_DESTINATIONS=['create','plans','examples','how','faq','account','checkout'];
export function koalaAction(value){
 if(!value||typeof value!=='object'||!KOALA_DESTINATIONS.includes(value.destination))return null;
 const format=['album','retrospectiva','ambos'].includes(value.format)?value.format:'album';
 const plan=['carinho','encanto','universo'].includes(value.plan)?value.plan:'';
 return {destination:value.destination,format,plan,automatic:value.automatic===true};
}
export function koalaActionLabel(value){
 const action=koalaAction(value);if(!action)return '';
 return {create:action.format==='retrospectiva'?'Criar minha retrospectiva':action.format==='ambos'?'Criar meu presente completo':'Criar meu álbum',plans:'Conhecer os planos',examples:'Explorar um exemplo',how:'Ver como funciona',faq:'Ver dúvidas frequentes',account:'Abrir meus presentes',checkout:'Revisar meu presente e pagamento'}[action.destination];
}
export function koalaActionHref(value){
 const action=koalaAction(value);if(!action)return null;
 const selection='formato='+action.format+(action.plan?'&plano='+action.plan:'');
 return {create:'/criar?'+selection,plans:'/#planos',examples:'/presente/exemplo?'+selection,how:'/#como-funciona',faq:'/#duvidas',account:'/conta',checkout:'/criar'}[action.destination];
}
