// Member admin page: approve or reject applications, create a one-time password link, remove a member.
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS={pending:'Onay bekliyor',approved:'Onaylı',rejected:'Reddedildi'};
const when=v=>v?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}):'–';
function actions(u,me){
 const b=(action,label)=>`<button class="button ghost small" data-id="${u.id}" data-action="${action}">${label}</button>`,list=[];
 if(u.id!==me){if(u.status!=='approved')list.push(b('approve','Onayla'));if(u.status!=='rejected')list.push(b('reject',u.status==='pending'?'Reddet':'Erişimi kapat'));}
 if(u.status==='approved')list.push(b('reset','Şifre bağlantısı'));
 if(u.id!==me)list.push(b('delete','Sil'));
 return `<div class="member-actions">${list.join('')}</div>`;
}
async function load(){
 const r=await fetch('/api/auth/users');if(r.status===401)return location.replace('/giris.html?sonra=/yonetim.html');if(!r.ok)return location.replace('/');
 const {users,me}=await r.json(),waiting=users.filter(u=>u.status==='pending').length;
 $('members-note').textContent=`${users.length} üye · ${waiting} onay bekliyor`;
 $('members').innerHTML=users.map(u=>`<tr><td>${esc(u.email)}${u.admin?' <small>yönetici</small>':''}</td><td><span class="member-status ${esc(u.status)}">${esc(STATUS[u.status]??u.status)}</span></td><td>${esc(when(u.createdAt))}</td><td>${esc(when(u.lastLogin))}</td><td>${actions(u,me)}</td></tr>`).join('');
}
$('members').onclick=async e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;const {id,action}=b.dataset,email=b.closest('tr').querySelector('td').firstChild.textContent;
 if(action==='delete'&&!confirm(`${email} silinsin mi?`))return;
 b.disabled=true;
 const r=await fetch(`/api/auth/users/${id}/${action}`,{method:'POST'}),data=await r.json().catch(()=>({})),box=$('member-link');
 box.classList.toggle('hidden',!(data.link||!r.ok));
 if(data.link)box.textContent=`${email} için tek kullanımlık şifre bağlantısı (3 gün geçerli): ${location.origin}${data.link}`;
 else if(!r.ok)box.textContent=data.error||'İşlem tamamlanamadı.';
 await load();
};
$('sign-out').onclick=async()=>{await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});location.replace('/giris.html');};
load();
