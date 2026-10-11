import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import QRCode from 'qrcode';
import archiver from 'archiver';
import multer from 'multer';
import sharp from 'sharp';
import slugify from 'slugify';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {people} from './data.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'data'),{recursive:true});
const uploadDir=path.join(root,'public','uploads');fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
const db=new Database(path.join(root,'data','gallery.db'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS people (id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, country TEXT NOT NULL, category TEXT NOT NULL, dates TEXT NOT NULL, bio TEXT NOT NULL, journey TEXT NOT NULL, achievements TEXT NOT NULL, image_url TEXT DEFAULT '', published INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
if(db.prepare('SELECT COUNT(*) AS n FROM people').get().n===0){const insert=db.prepare('INSERT INTO people (slug,name,country,category,dates,bio,journey,achievements) VALUES (?,?,?,?,?,?,?,?)');const seed=db.transaction(()=>people.forEach(p=>insert.run(slugify(p[0],{lower:true,strict:true}),...p)));seed();}
// Ajout non destructif : conserve les fiches déjà modifiées par l'équipe.
for (const col of ['article','sources']) {
 if (!db.prepare('PRAGMA table_info(people)').all().some(x=>x.name===col)) db.exec(`ALTER TABLE people ADD COLUMN ${col} TEXT DEFAULT ''`);
}
const insertNew=db.prepare('INSERT OR IGNORE INTO people (slug,name,country,category,dates,bio,journey,achievements) VALUES (?,?,?,?,?,?,?,?)');
const addMissing=db.transaction(()=>people.forEach(p=>insertNew.run(slugify(p[0],{lower:true,strict:true}),...p)));
addMissing();
import {articles} from './editorial.js';
const getArticle=(p)=>{
 const authored=String(p.article||'').trim();
 if(authored)return authored.split(/\n\s*\n/).filter(Boolean);
 if(articles[p.name])return articles[p.name];
 return [
 `${p.name} (${p.dates}) appartient à l’histoire de ${p.country}. ${p.bio} Son itinéraire permet de comprendre les mouvements politiques, intellectuels et sociaux qui ont transformé les sociétés africaines et leurs diasporas.`,
 p.journey,
 p.achievements,
 `Lire cette trajectoire demande de tenir compte du contexte historique, des rapports de force et de la diversité des interprétations. Cette notice constitue une introduction éditoriale : une documentation archivistique approfondie reste nécessaire pour une exposition scientifique.`
 ];
};
const sourceLinks=(p)=>{
 const custom=String(p.sources||'').split('\n').map(x=>x.trim()).filter(x=>/^https:\/\//.test(x)).slice(0,8);
 if(custom.length)return custom.map(url=>({title:new URL(url).hostname,url}));
 return [{title:'Rechercher dans Encyclopaedia Britannica',url:'https://www.britannica.com/search?query='+encodeURIComponent(p.name)},{title:'Explorer les références encyclopédiques',url:'https://fr.wikipedia.org/w/index.php?search='+encodeURIComponent(p.name)}];
};
const DEFAULT_DOMAINS=['Résistance anticoloniale','Indépendance et décolonisation','Panafricanisme','Politique et gouvernance','Droits humains','Littérature et philosophie','Arts et culture','Sciences et innovation','Éducation','Diplomatie','Féminisme et droits des femmes','Économie et développement','Spiritualité et traditions','Sport','Journalisme et médias'];
const domainOptions=()=>[...new Set([...DEFAULT_DOMAINS,...db.prepare('SELECT DISTINCT category FROM people').all().map(x=>x.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'fr'));
const xmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const safeFileName=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]/g,'-').replace(/-+/g,'-').slice(0,90);
async function exhibitionPoster(p){
 const width=900,height=1500;
 const link=base()+'/personnalites/'+p.slug;
 const qr=await QRCode.toBuffer(link,{width:650,margin:2,errorCorrectionLevel:'H',color:{dark:'#16262b',light:'#ffffff'}});
 const name=xmlEscape(p.name.length>43?p.name.slice(0,42)+'…':p.name);
 const country=xmlEscape(p.country);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1500"><rect width="900" height="1500" fill="#f6f0e6"/><rect width="900" height="580" fill="#1a2a2e"/><rect x="36" y="36" width="828" height="508" rx="12" fill="#263b40"/><text x="450" y="110" fill="#f2c37b" font-size="25" font-family="Arial" text-anchor="middle" letter-spacing="4">MÉMOIRES PANAFRICAINES</text><text x="450" y="330" fill="#f2c37b" font-size="180" font-family="Georgia" text-anchor="middle">${xmlEscape(p.name.trim().charAt(0))}</text><rect x="0" y="580" width="900" height="920" fill="#f6f0e6"/><text x="450" y="665" fill="#1a2a2e" font-family="Georgia" font-weight="bold" font-size="43" text-anchor="middle">${name}</text><text x="450" y="713" fill="#a2513b" font-family="Arial" font-size="25" text-anchor="middle">${country}</text><text x="450" y="1450" fill="#1a2a2e" font-family="Arial" font-size="23" letter-spacing="2" text-anchor="middle">SCANNEZ POUR DÉCOUVRIR SON HISTOIRE</text></svg>`;
 const layers=[{input:Buffer.from(svg),top:0,left:0},{input:qr,top:753,left:125}];
 if(/^\/uploads\/[a-f0-9-]+\.webp$/i.test(p.image_url||'')){
   const imagePath=path.join(uploadDir,path.basename(p.image_url));
   if(fs.existsSync(imagePath)){
    const portrait=await sharp(imagePath).resize(828,508,{fit:'cover',position:'attention'}).png().toBuffer();
    layers.splice(1,0,{input:portrait,top:36,left:36});
   }
 }
 return sharp({create:{width,height,channels:4,background:'#f6f0e6'}}).composite(layers).png().toBuffer();
}
const app=express();app.disable('x-powered-by');app.set('view engine','ejs');app.set('views',path.join(root,'views'));app.use(helmet({contentSecurityPolicy:false}));app.use(express.urlencoded({extended:false,limit:'30kb'}));app.use(express.json({limit:'30kb'}));app.use(cookieParser());app.use(express.static(path.join(root,'public'),{maxAge:'1h'}));
const secret=process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');const base=()=>process.env.BASE_URL?.replace(/\/$/,'')||'http://localhost:3000';
const csrfToken=()=>crypto.randomBytes(20).toString('hex');
app.use((req,res,next)=>{res.locals.csrf=req.cookies.csrf||csrfToken();if(!req.cookies.csrf)res.cookie('csrf',res.locals.csrf,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});res.locals.site='Mémoires Panafricaines';next()});
const safe=(fn)=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const requireCsrf=(req,res,next)=>{if(!req.body.csrf||req.body.csrf!==req.cookies.csrf)return res.status(403).send('Jeton de sécurité invalide');next()};
function logged(req){const token=req.cookies.admin_session;if(!token)return false;const hash=crypto.createHash('sha256').update(token).digest('hex');return !!db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires>?').get(hash,Date.now())}
function auth(req,res,next){if(!logged(req))return res.redirect('/admin/login');next()}
app.get('/',(req,res)=>{const q=String(req.query.q||'').slice(0,100),category=String(req.query.category||'');const page=Math.max(1,Math.min(10000,parseInt(String(req.query.page||'1'),10)||1));const perPage=12;let where=' WHERE published=1',args=[];if(q){where+=' AND (name LIKE ? OR country LIKE ?)';args.push('%'+q+'%','%'+q+'%')}if(category){where+=' AND category=?';args.push(category)}const total=db.prepare('SELECT COUNT(*) AS count FROM people'+where).get(...args).count;const pages=Math.max(1,Math.ceil(total/perPage));const current=Math.min(page,pages);const items=db.prepare('SELECT * FROM people'+where+' ORDER BY name LIMIT ? OFFSET ?').all(...args,perPage,(current-1)*perPage);res.render('home',{items,q,category,total,page:current,pages,categories:db.prepare('SELECT DISTINCT category FROM people ORDER BY category').all()})});
app.get('/personnalites/:slug',(req,res)=>{const p=db.prepare('SELECT * FROM people WHERE slug=? AND published=1').get(req.params.slug);if(!p)return res.status(404).render('404');res.render('person',{p,paragraphs:getArticle(p),sources:sourceLinks(p),url:base()+'/personnalites/'+p.slug})});
app.get('/admin/login',(req,res)=>res.render('login',{error:''}));
const loginLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/admin/login',loginLimit,requireCsrf,(req,res)=>{const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;if(!email||!password)return res.status(503).render('login',{error:'Configurez ADMIN_EMAIL et ADMIN_PASSWORD dans .env.'});if(req.body.email!==email||!bcrypt.compareSync(String(req.body.password||''),bcrypt.hashSync(password,10)))return res.status(401).render('login',{error:'Identifiants incorrects.'});const token=crypto.randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),Date.now()+86400000);res.cookie('admin_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:86400000});res.redirect('/admin')});
app.post('/admin/logout',auth,requireCsrf,(req,res)=>{const hash=crypto.createHash('sha256').update(req.cookies.admin_session).digest('hex');db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);res.clearCookie('admin_session');res.redirect('/')});
app.get('/admin',auth,(req,res)=>{const q=String(req.query.q||'').trim().slice(0,100);const status=['all','published','draft'].includes(req.query.status)?req.query.status:'all';const sort=['name_asc','name_desc','recent','country'].includes(req.query.sort)?req.query.sort:'name_asc';const page=Math.max(1,parseInt(String(req.query.page||'1'),10)||1);const perPage=12;let where=' WHERE 1=1',args=[];if(q){where+=' AND (name LIKE ? OR country LIKE ? OR category LIKE ?)';args.push(...Array(3).fill('%'+q+'%'))}if(status!=='all'){where+=' AND published=?';args.push(status==='published'?1:0)}const total=db.prepare('SELECT COUNT(*) AS n FROM people'+where).get(...args).n;const pages=Math.max(1,Math.ceil(total/perPage));const current=Math.min(page,pages);const order={name_asc:'name COLLATE NOCASE ASC',name_desc:'name COLLATE NOCASE DESC',recent:'id DESC',country:'country COLLATE NOCASE ASC, name COLLATE NOCASE ASC'}[sort];const items=db.prepare('SELECT * FROM people'+where+' ORDER BY '+order+' LIMIT ? OFFSET ?').all(...args,perPage,(current-1)*perPage);res.render('admin',{items,q,status,sort,total,page:current,pages});});
app.get('/admin/:id/qr',auth,(req,res)=>{const p=db.prepare('SELECT * FROM people WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);res.set('Cache-Control','no-store');res.render('admin-qr',{p,publicUrl:base()+'/personnalites/'+p.slug})});
app.get('/admin/:id/qr.png',auth,safe(async(req,res)=>{const p=db.prepare('SELECT * FROM people WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);const url=base()+'/personnalites/'+p.slug;res.type('png');res.set('Cache-Control','no-store');if(req.query.download==='1')res.set('Content-Disposition',`attachment; filename="qr-${p.slug}.png"`);res.send(await QRCode.toBuffer(url,{width:1200,margin:3,errorCorrectionLevel:'H',color:{dark:'#171514',light:'#FFFFFF'}}))}));
app.get('/admin/qr/all.zip',auth,safe(async(req,res)=>{
 const items=db.prepare('SELECT * FROM people WHERE published=1 ORDER BY name COLLATE NOCASE').all();
 if(!items.length)return res.status(404).send('Aucune personnalité publiée.');
 res.set({'Content-Type':'application/zip','Content-Disposition':'attachment; filename="cartels-qr-memoires-panafricaines.zip"','Cache-Control':'no-store'});
 const zip=archiver('zip',{zlib:{level:7}});
 zip.on('error',err=>{console.error(err);res.destroy(err)});
 zip.pipe(res);
 for(const p of items){const poster=await exhibitionPoster(p);zip.append(poster,{name:safeFileName(p.slug)+'-cartel.png'});}
 await zip.finalize();
}));
app.get('/admin/:id/poster.png',auth,safe(async(req,res)=>{
 const p=db.prepare('SELECT * FROM people WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);
 res.type('png');res.set('Cache-Control','no-store');
 if(req.query.download==='1')res.set('Content-Disposition',`attachment; filename="cartel-${safeFileName(p.slug)}.png"`);
 res.send(await exhibitionPoster(p));
}));
app.get('/admin/new',auth,(req,res)=>res.render('edit',{p:null,error:'',domains:domainOptions()}));
app.get('/admin/:id/edit',auth,(req,res)=>{const p=db.prepare('SELECT * FROM people WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);res.render('edit',{p,error:'',domains:domainOptions()})});
app.post('/admin/save',auth,upload.single('portrait'),requireCsrf,safe(async(req,res)=>{
 let uploadedPath='';
 if(req.file){try{const processed=await sharp(req.file.buffer,{limitInputPixels:16000000}).rotate().resize({width:1400,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer();uploadedPath='/uploads/'+crypto.randomUUID()+'.webp';fs.writeFileSync(path.join(uploadDir,path.basename(uploadedPath)),processed)}catch(e){return res.status(400).send('Image invalide : utilisez JPG, PNG ou WebP (5 Mo maximum).')}}
const chosenDomain=String(req.body.category||'').trim();req.body.category=chosenDomain==='__other__'?String(req.body.new_category||'').trim():chosenDomain;
if(!req.body.category||req.body.category.length>90)return res.status(400).render('edit',{p:req.body,domains:domainOptions(),error:'Choisissez ou créez un domaine (90 caractères maximum).'});
const keys=['name','country','category','dates','bio','journey','achievements','image_url','article','sources'];const previous=req.body.id?db.prepare('SELECT image_url FROM people WHERE id=?').get(Number(req.body.id)):null;const values=keys.map(k=>k==='image_url'?(uploadedPath||String(req.body[k]||'').trim()||previous?.image_url||''):String(req.body[k]||'').trim());if(values.slice(0,7).some(v=>!v)||values.some(v=>v.length>12000))return res.status(400).render('edit',{p:req.body,error:'Complétez les champs obligatoires (12 000 caractères maximum).'});if(values[7]&&!(/^(https:\/\/\/|\/uploads\/[a-f0-9-]+\.webp$)/i.test(values[7])))return res.status(400).render('edit',{p:req.body,error:'L’image doit utiliser une URL HTTPS.'});const published=req.body.published==='on'?1:0;try{if(req.body.id){db.prepare(`UPDATE people SET ${keys.map(k=>k+'=?').join(',')},published=? WHERE id=?`).run(...values,published,Number(req.body.id))}else{let slug=slugify(values[0],{lower:true,strict:true});if(!slug)slug='personne';if(db.prepare('SELECT 1 FROM people WHERE slug=?').get(slug))slug+='-'+crypto.randomBytes(3).toString('hex');db.prepare(`INSERT INTO people(slug,${keys.join(',')},published) VALUES (${Array(12).fill('?').join(',')})`).run(slug,...values,published)}res.redirect('/admin')}catch(e){res.status(400).render('edit',{p:req.body,error:'Enregistrement impossible : '+e.message})}}));
app.post('/admin/:id/delete',auth,requireCsrf,(req,res)=>{db.prepare('DELETE FROM people WHERE id=?').run(req.params.id);res.redirect('/admin')});
app.get('/health',(req,res)=>res.json({status:'ok'}));app.use((req,res)=>res.status(404).render('404'));app.use((err,req,res,next)=>{console.error(err);res.status(500).send('Erreur interne du serveur')});
const port=Number(process.env.PORT||3000);app.listen(port,()=>console.log('Galerie accessible sur http://localhost:'+port));
