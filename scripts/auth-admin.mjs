// Membership tasks from the server's command line.
// Usage: node --no-warnings scripts/auth-admin.mjs setup-link          one-time link (24 h) that creates an admin account
//        node --no-warnings scripts/auth-admin.mjs reset-link e-posta  one-time link (3 days) to set a new password
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openUsers} from './auth.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),users=openUsers(process.env.AUTH_DB||path.join(root,'data/auth/users.db'));
const base=process.env.SITE_URL||'https://mathgoal.io',[command,email]=process.argv.slice(2);
if(command==='setup-link')console.log(`${base}/giris.html?kurulum=${users.setupLink()}`);
else if(command==='reset-link'){
 const u=users.byEmail(String(email||'').trim().toLocaleLowerCase('en-US'));if(!u)throw Error('Bu e-postayla üye yok.');
 console.log(`${base}/giris.html?sifirla=${users.resetLink(u.id)}`);
}else throw Error('Kullanım: auth-admin.mjs setup-link | reset-link e-posta');
users.close();
