// Sign-in page: login, application, and the one-time links for the first admin (?kurulum=) and a new password (?sifirla=).
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const setup=params.get('kurulum'),resetToken=params.get('sifirla');
// Only a path on this site, never another host.
const next=()=>{const s=params.get('sonra')||'/';return /^\/(?![/\\])/.test(s)?s:'/';};
let mode=setup?'setup':resetToken?'reset':'login';
const TEXT={
 login:{submit:'Giriş yap',intro:'İçeriği yalnız onaylı üyeler görebilir.',complete:'current-password'},
 register:{submit:'Başvur',intro:'Başvurun yönetici onayından sonra açılır. Şifre en az 8 karakter olmalı.',complete:'new-password'},
 setup:{submit:'Yönetici hesabı oluştur',title:'Yönetici hesabı',intro:'Bu bağlantı tek kullanımlık. E-posta adresini ve kendi şifreni belirle. Şifre en az 8 karakter olmalı.',complete:'new-password'},
 reset:{submit:'Şifreyi kaydet',title:'Yeni şifre',intro:'Bu bağlantı tek kullanımlık. Şifre en az 8 karakter olmalı.',complete:'new-password'},
};
function message(text,kind='error'){const m=$('auth-message');m.textContent=text||'';m.className=`auth-message ${kind}${text?'':' hidden'}`;}
function show(){
 const t=TEXT[mode],linkMode=mode==='setup'||mode==='reset';
 $('auth-tabs').classList.toggle('hidden',linkMode);
 $('auth-title').classList.toggle('hidden',!linkMode);$('auth-title').textContent=t.title||'';
 $('email-field').classList.toggle('hidden',mode==='reset');
 $('auth-intro').textContent=t.intro;$('auth-submit').textContent=t.submit;$('password').autocomplete=t.complete;
 $('tab-login').setAttribute('aria-selected',String(mode==='login'));$('tab-register').setAttribute('aria-selected',String(mode==='register'));
 message('');
}
$('tab-login').onclick=()=>{mode='login';show();};
$('tab-register').onclick=()=>{mode='register';show();};
async function post(route,body){
 const r=await fetch(`/api/auth/${route}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 return {ok:r.ok,data:await r.json().catch(()=>({}))};
}
$('auth-form').onsubmit=async e=>{
 e.preventDefault();
 const email=$('email').value.trim(),password=$('password').value,button=$('auth-submit');
 if(mode!=='reset'&&!email)return message('E-posta adresini girin.');
 if(!password)return message('Şifreni girin.');
 button.disabled=true;message('');
 try{
  const {ok,data}=mode==='login'?await post('login',{email,password}):mode==='register'?await post('register',{email,password}):
   mode==='setup'?await post('register',{email,password,setup}):await post('reset',{token:resetToken,password});
  if(!ok)return message(data.error||'İşlem tamamlanamadı.',data.status==='pending'?'info':'error');
  if(mode==='register'){$('password').value='';return message('Başvurun alındı. Yönetici onaylayınca aynı e-posta ve şifreyle giriş yapabilirsin.','info');}
  if(mode==='reset'){history.replaceState(null,'','/giris.html');mode='login';$('password').value='';show();return message('Şifren değişti. Şimdi giriş yapabilirsin.','info');}
  location.replace(next());
 }catch{message('Sunucuya ulaşılamadı. Tekrar deneyin.');}
 finally{button.disabled=false;}
};
show();
if(mode==='setup'||mode==='reset'){
 const kind=mode,code=kind==='setup'?setup:resetToken;
 fetch(`/api/auth/link?tur=${kind}&kod=${encodeURIComponent(code)}`).then(r=>r.json()).then(d=>{if(!d.valid){message('Bu bağlantı geçersiz veya kullanılmış.');$('auth-submit').disabled=true;}}).catch(()=>{});
}else fetch('/api/auth/me').then(r=>{if(r.ok)location.replace(next());}).catch(()=>{});
