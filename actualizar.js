(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var CFG=window.PN||{};
var ESTADOS=[['futuro','Por iniciar'],['preparacao','Em preparação'],['activo','Em execução'],['concluido','Concluído']];
var projectos=[],dados={projectos:{}},sujo=false,sess=null,recTok=null,mem=null;
function ecra(n){['pLogin','pSenha','pEdit'].forEach(function(id){$('#'+id).hidden=id!==n})}
function msg(el,t,ok){el.textContent=t||'';el.style.color=ok?'var(--ok)':'var(--err)'}

/* sessão (guardada só neste separador do navegador) */
function lerSess(){try{var s=sessionStorage.getItem('pn_sess');return s?JSON.parse(s):mem}catch(e){return mem}}
function gravarSess(s){mem=s;try{if(s)sessionStorage.setItem('pn_sess',JSON.stringify(s));else sessionStorage.removeItem('pn_sess')}catch(e){}}
function traduz(m){m=String(m||'');
  if(/invalid login|invalid_credentials|invalid grant/i.test(m))return 'Email ou palavra-passe incorrectos.';
  if(/rate limit|too many/i.test(m))return 'Demasiadas tentativas. Aguarde uns minutos.';
  if(/same password|different from the old/i.test(m))return 'Escolha uma palavra-passe diferente da anterior.';
  if(/weak|at least/i.test(m))return 'A palavra-passe é demasiado fraca (mínimo 8 caracteres).';
  if(/email not confirmed/i.test(m))return 'O email ainda não foi confirmado.';
  return m||'Ocorreu um erro. Tente de novo.'}
function http(path,o){
  o=o||{};var h={apikey:CFG.anon,'content-type':'application/json'};
  if(o.token)h.Authorization='Bearer '+o.token;
  if(o.prefer)h.Prefer=o.prefer;
  return fetch(CFG.url+path,{method:o.method||'GET',headers:h,body:o.body?JSON.stringify(o.body):undefined,cache:'no-store'}).then(function(r){
    return r.text().then(function(t){var j=null;try{j=t?JSON.parse(t):null}catch(e){}
      if(!r.ok){var e=new Error((j&&(j.msg||j.error_description||j.message||j.error))||('Erro '+r.status));e.status=r.status;throw e}return j})});
}
function guardaTokens(j){
  var s={access:j.access_token,refresh:j.refresh_token,exp:Date.now()+((j.expires_in||3600)-60)*1000,email:(j.user&&j.user.email)||(sess&&sess.email)||''};
  sess=s;gravarSess(s);return s}
function tokenValido(){
  if(!sess)return Promise.reject(Object.assign(new Error('Sem sessão.'),{status:401}));
  if(Date.now()<sess.exp)return Promise.resolve(sess.access);
  return http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:sess.refresh}}).then(function(j){return guardaTokens(j).access})
    .catch(function(){gravarSess(null);sess=null;throw Object.assign(new Error('A sessão expirou. Entre de novo.'),{status:401})});
}

function rodape(){var a=dados.atualizado;$('#ultima').textContent=a?'Última gravação: '+new Date(a).toLocaleString('pt-PT')+(dados.por?' · '+dados.por:''):'Ainda não foi gravada nenhuma actualização.'}
function valor(p){return Object.assign({estado:'futuro',prog:0,data:'',obs:''},dados.projectos[p.id]||{})}
function lerDados(){
  return http('/rest/v1/dados?id=eq.1&select=conteudo,atualizado,por').then(function(a){var x=a&&a[0];return x?{atualizado:x.atualizado,por:x.por,projectos:x.conteudo||{}}:{projectos:{}}}).catch(function(){return {projectos:{}}})}
function carregar(){
  return Promise.all([fetch('content.json?v='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}),lerDados()]).then(function(x){
    projectos=(x[0].projectos||[]).slice().sort(function(a,b){return (a.n||0)-(b.n||0)});
    dados=x[1];if(!dados.projectos)dados.projectos={};
    var sec=[];projectos.forEach(function(p){if(p.sector&&sec.indexOf(p.sector)<0)sec.push(p.sector)});
    $('#fSec').innerHTML='<option value="">Todos os sectores</option>'+sec.map(function(s){return '<option>'+esc(s)+'</option>'}).join('');
    desenhar();rodape()})}
function desenhar(){
  var q=$('#fQ').value.trim().toLowerCase(),s=$('#fSec').value;
  var lista=projectos.filter(function(p){return (!s||p.sector===s)&&(!q||(p.nome+' '+p.sector).toLowerCase().indexOf(q)>=0)});
  $('#lista').innerHTML=lista.map(function(p){var v=valor(p);
    return '<article class="row" data-id="'+esc(p.id)+'"><div class="rt"><b>'+(p.n||'')+'.</b> '+esc(p.nome)+'<small>'+esc(p.sector)+'</small></div>'+
    '<label>Estado<select data-k="estado">'+ESTADOS.map(function(e){return '<option value="'+e[0]+'"'+(v.estado===e[0]?' selected':'')+'>'+e[1]+'</option>'}).join('')+'</select></label>'+
    '<label>Execução %<input data-k="prog" type="number" min="0" max="100" step="1" value="'+v.prog+'"'+(v.estado==='activo'?'':' disabled')+'></label>'+
    '<label>Ponto de situação em<input data-k="data" type="date" value="'+esc(v.data)+'"></label>'+
    '<label class="obs">Observação<input data-k="obs" type="text" maxlength="300" value="'+esc(v.obs)+'" placeholder="Opcional"></label></article>'}).join('')||'<p class="vazio">Nenhum projecto encontrado.</p>';
  $('#cont').textContent=lista.length+' de '+projectos.length+' projectos'}
$('#lista').addEventListener('input',function(e){
  var t=e.target,row=t.closest('.row');if(!row||!t.dataset.k)return;
  var id=row.dataset.id,p=projectos.filter(function(x){return x.id===id})[0],v=valor(p);
  v[t.dataset.k]=t.dataset.k==='prog'?Math.max(0,Math.min(100,Math.round(+t.value||0))):t.value;
  if(t.dataset.k==='estado'){
    if(v.estado==='concluido')v.prog=100;else if(v.estado!=='activo')v.prog=0;
    var pi=$('[data-k="prog"]',row);pi.disabled=v.estado!=='activo';pi.value=v.prog;
    if(!v.data){v.data=new Date().toISOString().slice(0,10);$('[data-k="data"]',row).value=v.data}}
  dados.projectos[id]=v;sujo=true;$('#guardar').disabled=false;msg($('#gMsg'),'Alterações por guardar.',true)});
$('#fQ').addEventListener('input',desenhar);$('#fSec').addEventListener('change',desenhar);
addEventListener('beforeunload',function(e){if(sujo){e.preventDefault();e.returnValue=''}});

$('#guardar').addEventListener('click',function(){
  var b=$('#guardar');b.disabled=true;msg($('#gMsg'),'A guardar…',true);
  var completo={};projectos.forEach(function(p){completo[p.id]=valor(p)});
  tokenValido().then(function(tk){return http('/rest/v1/dados?on_conflict=id',{method:'POST',token:tk,prefer:'resolution=merge-duplicates,return=minimal',body:{id:1,conteudo:completo}})})
  .then(lerDados).then(function(d){dados=d;sujo=false;rodape();msg($('#gMsg'),'Guardado. O site já mostra os novos números.',true)})
  .catch(function(e){b.disabled=false;if(e.status===401){ecra('pLogin');msg($('#lMsg'),'A sessão expirou. Entre de novo e volte a guardar.')}else msg($('#gMsg'),traduz(e.message))})});

$('#fLogin').addEventListener('submit',function(e){
  e.preventDefault();msg($('#lMsg'),'A entrar…',true);
  http('/auth/v1/token?grant_type=password',{method:'POST',body:{email:$('#lEmail').value.trim(),password:$('#lSenha').value}})
   .then(function(j){guardaTokens(j);return entrar()}).catch(function(er){msg($('#lMsg'),traduz(er.message))})});
$('#esqueci').addEventListener('click',function(){
  var em=$('#lEmail').value.trim();if(!em)return msg($('#lMsg'),'Escreva primeiro o seu email.');
  http('/auth/v1/recover',{method:'POST',body:{email:em}}).then(function(){msg($('#lMsg'),'Se o email tiver acesso, enviámos uma ligação para criar nova palavra-passe.',true)}).catch(function(er){msg($('#lMsg'),traduz(er.message))})});
$('#fSenha').addEventListener('submit',function(e){
  e.preventDefault();var a=$('#sNova').value;
  if(a.length<8)return msg($('#sMsg'),'Use pelo menos 8 caracteres.');
  if(a!==$('#sNova2').value)return msg($('#sMsg'),'As palavras-passe não coincidem.');
  http('/auth/v1/user',{method:'PUT',token:recTok.access,body:{password:a}}).then(function(){sess=recTok;gravarSess(sess);recTok=null;history.replaceState(null,'',location.pathname);return entrar()}).catch(function(er){msg($('#sMsg'),traduz(er.message))})});
$('#sair').addEventListener('click',function(){sujo=false;gravarSess(null);sess=null;ecra('pLogin')});
$('#fPw').addEventListener('submit',function(e){
  e.preventDefault();var a=$('#pwNova').value;
  if(a!==$('#pwNova2').value)return msg($('#pwMsg'),'As palavras-passe não coincidem.');
  tokenValido().then(function(tk){return http('/auth/v1/user',{method:'PUT',token:tk,body:{password:a}})}).then(function(){msg($('#pwMsg'),'Palavra-passe alterada.',true);$('#fPw').reset()}).catch(function(er){msg($('#pwMsg'),traduz(er.message))})});

function entrar(){
  if(!sess)return ecra('pLogin');
  return tokenValido().then(function(){
    $('#quem').textContent=sess.email;ecra('pEdit');$('#guardar').disabled=true;msg($('#gMsg'),'');return carregar()}).catch(function(){ecra('pLogin')})}

(function init(){
  if(!CFG.url||!CFG.anon){ecra('pLogin');msg($('#lMsg'),'O site ainda não está ligado ao Supabase (ficheiro config.js vazio).');return}
  var hs=location.hash.replace(/^#/,'');
  if(/access_token=/.test(hs)){      // ligação de convite ou recuperação enviada por email
    var p=new URLSearchParams(hs);
    if(p.get('type')==='recovery'||p.get('type')==='invite'){
      recTok={access:p.get('access_token'),refresh:p.get('refresh_token'),exp:Date.now()+3000*1000,email:''};
      ecra('pSenha');return}}
  sess=lerSess();entrar()})();
})();
