// The signed-in member in the sidebar: e-mail, member admin link with the waiting count for admins, sign out.
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function signOut(){await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});location.replace('/giris.html');}
async function mount(){
 const r=await fetch('/api/auth/me').catch(()=>null);if(!r)return;
 if(r.status===401)return location.replace(`/giris.html?sonra=${encodeURIComponent(location.pathname+location.search)}`);
 if(!r.ok)return;
 const me=await r.json(),sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 const box=document.createElement('div');box.className='account';
 box.innerHTML=`<b>${esc(me.email)}</b><div class="account-actions">${me.admin?`<a href="/yonetim.html">Üyeler${me.pending?`<span class="count">${Number(me.pending)}</span>`:''}</a>`:''}<button type="button" id="sign-out">Çıkış yap</button></div>`;
 sidebar.querySelector('nav')?.after(box);
 box.querySelector('#sign-out').onclick=signOut;
}
mount();
