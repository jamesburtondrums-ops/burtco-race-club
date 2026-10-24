const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve('v3/public')+'/';
const data=JSON.parse(fs.readFileSync(root+'raceday.json','utf8'));
const study=JSON.parse(fs.readFileSync(root+'study.json','utf8'));
const elements=new Map();function el(k){if(!elements.has(k))elements.set(k,{value:'',innerHTML:'',textContent:'',hidden:false,insertAdjacentHTML(_,s){this.innerHTML+=s},setAttribute(k,v){this[k]=v}});return elements.get(k)}
el('#angle-sort').value='watch';el('#study-filter').value='reviewed';
const buttons=['selections','all','edges','method','study'].map(name=>({...el(name),dataset:{view:name}}));
const ctx={console,Set,Math,Date,Number,String,JSON,Error,document:{querySelector:el,querySelectorAll:s=>s==='[data-view]'?buttons:[]},fetch:async url=>({ok:true,json:async()=>url.includes('study.json')?study:data})};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'study.js','utf8'),ctx);const html=fs.readFileSync(root+'index.html','utf8');vm.runInContext(html.split('<script>')[1].split('</script>')[0],ctx);
setTimeout(()=>{try{
 const count=(s,p)=>(s.match(p)||[]).length;
 assert.equal(count(el('#race-list').innerHTML,/<details class="race"/g),31);
 assert.equal(count(el('#race-list').innerHTML,/<td class="horse">/g),281);
 assert.equal(count(el('#picks').innerHTML,/<article /g),5);
 assert.equal(count(el('#angle-list').innerHTML,/<details class="race"/g),7);
 el('#angle-sort').value='mark';el('#angle-sort').onchange();assert.equal(count(el('#angle-list').innerHTML,/<details class="race"/g),281);
 el('#angle-search').value='Prosperitas';el('#angle-search').oninput();assert.equal(count(el('#angle-list').innerHTML,/<details class="race"/g),1);
 el('#course').value='Southwell';el('#course').onchange();assert.equal(count(el('#race-list').innerHTML,/<details class="race"/g),9);
 el('#course').value='';el('#search').value='Prosperitas';el('#search').oninput();assert.equal(count(el('#race-list').innerHTML,/<details class="race"/g),1);
 assert.equal(count(el('#study-list').innerHTML,/<details class="race study-runner"/g),4);
 el('#study-filter').value='all';el('#study-filter').onchange();assert.equal(count(el('#study-list').innerHTML,/<details class="race study-runner"/g),281);
 const dossier=vm.runInContext("studyDossier(STUDY_HORSES.get('802653'))",ctx);assert(dossier.includes('King Of Light'));assert(dossier.includes('Complete matched history'));
 buttons[2].onclick();assert.equal(el('#edges').hidden,false);assert.equal(el('#all').hidden,true);
 console.log('Client rendering checks passed: 31 races, 281 runner rows, 5 selections, 7 research cases; full-form and quote study for all 281, complete history, comparison search, meeting filter, sorting and tab handlers.');
}catch(e){console.error(e);process.exitCode=1}},0);
