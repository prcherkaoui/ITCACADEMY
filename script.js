// ===== BARRE DU HAUT : modifiez cette liste =====
// nom : texte affiché | url : votre lien | logo : chemin d'image (ex. 'logo1.png') ou '' pour afficher la lettre
const SITES=[
 {nom:'Mon site web 1',url:'#',logo:''},
 {nom:'Mon site web 2',url:'#',logo:''},
 {nom:'Mon site web 3',url:'#',logo:''}
];
const FORMS=[
 {nom:'Formulaire d\'inscription',url:'#',logo:''},
 {nom:'Formulaire de contact',url:'#',logo:''}
];
const tl=document.getElementById('toplinks');
function chip(o,f){const a=document.createElement('a');a.className='tl'+(f?' f':'');a.href=o.url;if(o.url!=='#'){a.target='_blank';a.rel='noopener'}
 a.innerHTML='<span class="lg">'+(o.logo?'<img src="'+o.logo+'" alt="">':(f?'📝':o.nom.charAt(0)))+'</span>'+o.nom;tl.appendChild(a)}
tl.insertAdjacentHTML('beforeend','<small>Nos sites :</small>');SITES.forEach(o=>chip(o,0));
tl.insertAdjacentHTML('beforeend','<span class="sep"></span><small>Formulaires :</small>');FORMS.forEach(o=>chip(o,1));
// ===== FORMATIONS (liste modifiable) =====
const FORM=[
 ['🇬🇧','Anglais technique','Vocabulaire et communication professionnelle IT.'],
 ['🧰','Microsoft Office (Word, Excel, PowerPoint)','Le pack complet de la bureautique.'],
 ['📄','Word seulement','Mise en page, documents et rapports.'],
 ['📈','Excel seulement','Formules, tableaux et graphiques.'],
 ['💻','Développement web (HTML, CSS, JS)','Créez vos sites et applications.'],
 ['🌍','WordPress','Créez et gérez un site sans coder.'],
 ['🧾','Comptabilité générale','Bases et pratique comptable.'],
 ['🗣️','Français et communication','Expression écrite et orale.'],
 ['🛠️','Maintenance informatique','Diagnostic, dépannage et entretien.'],
 ['🛒','E-commerce','Lancez et gérez votre boutique en ligne.'],
 ['🤖','Outils de l\'intelligence artificielle et fonctionnement','Comprendre et utiliser l\'IA au quotidien.'],
 ['🎯','Orientation et coaching','GRATUIT']
];
const fg=document.getElementById('fgrid'),fo=document.getElementById('fopts');
FORM.forEach(([ic,n,d],k)=>{
 const free=d==='GRATUIT';
 fg.insertAdjacentHTML('beforeend','<article class="card"><div class="ic">'+ic+'</div><h3>'+n+(free?' <span class="free">GRATUIT</span>':'')+'</h3><p>'+(free?'Un accompagnement gratuit pour choisir la formation qui vous convient.':d)+'</p><a class="more" href="#devis">Demander un devis</a></article>');
 fo.insertAdjacentHTML('beforeend','<label><input type="checkbox" name="fm" value="'+n.replace(/"/g,'&quot;')+'"> '+n+(free?' <span class="free">gratuit</span>':'')+'</label>');
});
// ===== TARIFS =====
const SP=['Développement web (HTML, CSS, JS)','WordPress','Comptabilité générale'];
function calc(fm,typ,mod,n){
 const paid=fm.filter(f=>!f.startsWith('Orientation')),rows=[];let tot=0,pend=false;
 if(typ==='Personnalisée'){
  if(paid.length<2||paid.length>3)return{err:'Formation personnalisée : choisissez 2 ou 3 modules (maximum 3).'};
  paid.forEach(f=>rows.push([f,'Module inclus','','']));
  tot=150*n;rows.push(['Forfait personnalisé','150 DH/h',n+' h',tot+' DH']);
 }else paid.forEach(f=>{
  let r,u,q;
  if(typ==='Individuelle'){r=mod==='Hybride'?90:mod==='Présentiel'?(SP.includes(f)?150:120):(SP.includes(f)?120:100);u=r+' DH/h';q=n+' h'}
  else{r=mod==='À distance'?50:mod==='Présentiel'?80:null;u=r?r+' DH/séance (2h)':'à confirmer';q=n+' séance(s)'}
  if(r===null){pend=true;rows.push([f,u,q,'à confirmer'])}else{const t=r*n;tot+=t;rows.push([f,u,q,t+' DH'])}
 });
 fm.filter(f=>f.startsWith('Orientation')).forEach(f=>rows.push([f,'Gratuit','','0 DH']));
 return{rows,tot,pend};
}
const dhl=document.getElementById('dhl');
function upl(){const t=document.querySelector('[name=typ]:checked').value;dhl.textContent=t==='En groupe'?'Nombre de séances (2h) par formation':t==='Personnalisée'?'Nombre total d\'heures':'Nombre d\'heures par formation'}
document.querySelectorAll('[name=typ]').forEach(r=>r.onchange=upl);upl();
// ===== DEVIS PDF + WHATSAPP =====
const WA='212660837285';
document.getElementById('dvf').onsubmit=async e=>{
 e.preventDefault();
 const fm=[...document.querySelectorAll('[name=fm]:checked')].map(i=>i.value);
 const R=document.getElementById('res');R.style.display='block';
 if(!fm.length){R.textContent='Veuillez choisir au moins une formation.';return}
 const typ0=document.querySelector('[name=typ]:checked').value,mod0=document.querySelector('[name=mod]:checked').value;
 const P=calc(fm,typ0,mod0,Math.max(1,+dh.value||1));
 if(P.err){R.textContent=P.err;return}
 const d={nom:dn.value.trim(),tel:dt.value.trim(),mail:de.value.trim(),fm,
  typ:document.querySelector('[name=typ]:checked').value,mod:document.querySelector('[name=mod]:checked').value,msg:dm.value.trim()};
 const ref='ITC-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+Math.floor(1000+Math.random()*9000);
 const date=new Date().toLocaleDateString('fr-FR');
 // Texte WhatsApp (copie pour l'académie)
 const txt='*Nouvelle demande de devis ITCACADEMY*\nRéf : '+ref+'\nDate : '+date+'\n\nClient : '+d.nom+'\nTél : '+d.tel+(d.mail?'\nE-mail : '+d.mail:'')+'\n\nFormations :\n- '+P.rows.map(r=>r[0]+(r[1]?' : '+r[1]:'')+(r[2]?' x '+r[2]:'')+(r[3]?' = '+r[3]:'')).join('\n- ')+'\n\nType : '+d.typ+'\nMode : '+d.mod+'\nTOTAL : '+P.tot+' DH'+(P.pend?' (+ éléments à confirmer)':'')+(d.msg?'\n\nPrécisions : '+d.msg:'');
 // PDF
 let blob=null,doc=null;
 try{
  const {jsPDF}=window.jspdf;doc=new jsPDF({unit:'mm',format:'a4'});
  doc.setFillColor(10,19,48);doc.rect(0,0,210,34,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(22);doc.text('ITCACADEMY',14,16);
  doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text('Centre de formation à distance - Informatique et communication',14,24);
  doc.setTextColor(10,19,48);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('DEVIS',14,48);
  doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text('Réf : '+ref,150,44);doc.text('Date : '+date,150,50);
  let y=64;const L=(t,v)=>{doc.setFont('helvetica','bold');doc.text(t,14,y);doc.setFont('helvetica','normal');const w=doc.splitTextToSize(v,130);doc.text(w,64,y);y+=6*w.length+3};
  L('Client :',d.nom);L('Téléphone :',d.tel);if(d.mail)L('E-mail :',d.mail);
  y+=4;doc.setDrawColor(47,107,255);doc.line(14,y,196,y);y+=9;
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Détail du tarif (en dirhams)',14,y);y+=8;doc.setFontSize(9);
  doc.setFillColor(47,107,255);doc.rect(14,y-5,182,7,'F');doc.setTextColor(255,255,255);doc.text('Formation',16,y);doc.text('Tarif',100,y);doc.text('Quantité',140,y);doc.text('Total',172,y);doc.setTextColor(10,19,48);y+=7;
  P.rows.forEach(r=>{doc.setFont('helvetica','normal');const w=doc.splitTextToSize(r[0],80);if(y>262){doc.addPage();y=20}doc.text(w,16,y);doc.text(r[1],100,y);doc.text(r[2],140,y);doc.text(r[3],172,y);y+=5*w.length+2;doc.setDrawColor(217,225,245);doc.line(14,y-3,196,y-3)});
  y+=3;doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('TOTAL : '+P.tot+' DH'+(P.pend?' (hors éléments à confirmer)':''),14,y);y+=10;doc.setFontSize(10);
  y+=6;L('Type :',d.typ);L('Mode :',d.mod);if(d.msg)L('Précisions :',d.msg);
  if(y>250){doc.addPage();y=20}y+=4;doc.setFillColor(238,242,255);doc.rect(14,y,182,22,'F');doc.setFont('helvetica','bold');doc.text('Devis valable selon les tarifs en vigueur (DH).',18,y+9);
  doc.setFont('helvetica','normal');doc.text('Notre équipe vous contactera rapidement pour finaliser le devis.',18,y+16);
  doc.setFontSize(9);doc.setTextColor(81,96,138);doc.text('ITCACADEMY  |  WhatsApp : 0660 83 72 85  |  cherkaoui.imaad@gmail.com',14,285);
  blob=doc.output('blob');
 }catch(err){R.textContent='Le PDF n\'a pas pu être généré. Utilisez le bouton WhatsApp ci-dessous.'}
 R.innerHTML='<b>Votre demande '+ref+' est prête.</b><div class="row"></div>';
 const row=R.querySelector('.row');
 if(blob){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Télécharger mon devis (PDF)';
  b.onclick=async()=>{let ok=false;try{const dl=typeof claude!=='undefined'?await claude.use('downloads'):null;if(dl){await dl.save({filename:'Devis-ITCACADEMY-'+ref+'.pdf',data:blob});ok=true}}catch(x){if(x&&x.code==='declined')return}
   if(!ok)try{doc.save('Devis-ITCACADEMY-'+ref+'.pdf')}catch(x){}};row.appendChild(b);b.click()}
 const w=document.createElement('a');w.className='btn';w.style.cssText='background:#25d366;border-color:#25d366;color:#04200e';w.target='_blank';w.rel='noopener';
 w.href='https://wa.me/'+WA+'?text='+encodeURIComponent(txt);w.textContent='Envoyer ma copie sur WhatsApp';row.appendChild(w);
};
// Année
document.getElementById('yr').textContent=new Date().getFullYear();
// Menu mobile
const menu=document.getElementById('menu');
document.getElementById('burger').onclick=()=>menu.classList.toggle('open');
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.classList.remove('open')));
// Thème clair/sombre
document.getElementById('tg').onclick=()=>{
 const r=document.documentElement,d=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);
 r.dataset.theme=d?'light':'dark';
};
// Slider
const sl=[...document.querySelectorAll('.slide')],dots=document.getElementById('dots');let i=0,t;
sl.forEach((_,k)=>{const b=document.createElement('button');b.className='dot'+(k?'':' on');b.setAttribute('aria-label','Diapositive '+(k+1));b.onclick=()=>go(k,1);dots.appendChild(b)});
function go(n,u){i=(n+sl.length)%sl.length;sl.forEach((s,k)=>s.classList.toggle('on',k===i));[...dots.children].forEach((d,k)=>d.classList.toggle('on',k===i));if(u)auto()}
function auto(){clearInterval(t);t=setInterval(()=>go(i+1),5500)}
document.getElementById('nx').onclick=()=>go(i+1,1);
document.getElementById('pv').onclick=()=>go(i-1,1);
document.getElementById('sl').addEventListener('mouseenter',()=>clearInterval(t));
document.getElementById('sl').addEventListener('mouseleave',auto);auto();
// Compteurs
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;io.unobserve(e.target);const n=+e.target.dataset.n;let c=0;const s=setInterval(()=>{c+=Math.ceil(n/40);if(c>=n){c=n;clearInterval(s)}e.target.textContent=c+(n>=500?'+':'')},35)}));
document.querySelectorAll('[data-n]').forEach(e=>io.observe(e));
// Machine à écrire
const lines=['const centre = "ITCACADEMY";','formation.mode = "à distance";','apprendre(informatique, communication);','// Votre avenir commence ici'];let l=0,c=0;const ty=document.getElementById('ty');
(function type(){if(c<=lines[l].length){ty.textContent=lines[l].slice(0,c++);setTimeout(type,60)}else{setTimeout(()=>{c=0;l=(l+1)%lines.length;type()},1400)}})();
// Formulaire : ouvre le client e-mail
document.getElementById('f').onsubmit=e=>{e.preventDefault();
 const b=encodeURIComponent('Nom : '+nm.value+'\nE-mail : '+em.value+'\n\n'+tx.value);
 location.href='mailto:cherkaoui.imaad@gmail.com?subject='+encodeURIComponent('Message depuis le site ITCACADEMY')+'&body='+b;
 document.getElementById('msg').textContent='Votre application e-mail s\'ouvre pour envoyer le message.';};
// Fond animé : réseau de points
const cv=document.getElementById('net'),x=cv.getContext('2d');let W,H,P=[];
function rs(){W=cv.width=innerWidth;H=cv.height=innerHeight;P=Array.from({length:Math.min(70,Math.floor(W/18))},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5}))}
function dr(){x.clearRect(0,0,W,H);const col=getComputedStyle(document.documentElement).getPropertyValue('--pri').trim()||'#2f6bff';x.strokeStyle=col;x.fillStyle=col;
 P.forEach((p,a)=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;x.beginPath();x.arc(p.x,p.y,2,0,7);x.fill();
  for(let b=a+1;b<P.length;b++){const q=P[b],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<130){x.globalAlpha=1-d/130;x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke();x.globalAlpha=1}}});
 requestAnimationFrame(dr)}
rs();addEventListener('resize',rs);if(!matchMedia('(prefers-reduced-motion:reduce)').matches)dr();
