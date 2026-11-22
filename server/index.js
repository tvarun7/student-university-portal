import {initDb,db} from './db.js';
import {app} from './app.js';
import {hashPassword,strongPassword} from './security.js';
import {randomUUID} from 'node:crypto';

await initDb();

// ── Auto-bootstrap admin if env vars present and no admin exists ──────────────
if(process.env.BOOTSTRAP_ADMIN_USERNAME && process.env.BOOTSTRAP_ADMIN_PASSWORD){
  try{
    const existing=(await db.query("SELECT id FROM users WHERE role='admin' LIMIT 1")).rows;
    if(existing.length){
      console.log('[bootstrap] Administrator already exists, skipping.');
    } else {
      const username=process.env.BOOTSTRAP_ADMIN_USERNAME;
      const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
      if(strongPassword(password)){
        await db.query('INSERT INTO users(id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(),username,'University Administrator','admin',await hashPassword(password)]);
        console.log('[bootstrap] Administrator created: '+username);
      } else {
        console.warn('[bootstrap] BOOTSTRAP_ADMIN_PASSWORD too weak, skipped.');
      }
    }
  }catch(e){console.error('[bootstrap] Error:',e.message);}
}

// ── Auto-seed if AUTO_SEED=true and no departments exist ─────────────────────
if(process.env.AUTO_SEED==='true'){
  try{
    const deptCount=(await db.query('SELECT COUNT(*) FROM departments')).rows[0].count;
    if(Number(deptCount)>0){
      console.log('[seed] Data already seeded ('+deptCount+' departments), skipping.');
    } else {
      console.log('[seed] Starting seed — this will take several minutes…');
      const {default:seed}=await import('./seed.js');
      await seed();
      console.log('[seed] Seed complete!');
    }
  }catch(e){console.error('[seed] Error:',e.message);}
}

const port=Number(process.env.PORT||3000);
const server=app.listen(port,()=>console.log('Student University: http://localhost:'+port));
async function shutdown(){server.close(async()=>{await db.close();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
