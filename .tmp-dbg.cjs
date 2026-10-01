'use strict';
const path = require('path');
const { RAIZ } = require('./tools/arquivos.js');

const nav = { estado: { pendentes: new Map(), visivel: 'visible', proximo: 1 } };
nav.document = { visibilityState: 'visible', addEventListener(){}, removeEventListener(){} };
nav.addEventListener = function () {};
nav.removeEventListener = function () {};
nav.requestAnimationFrame = function (cb) { const id = nav.estado.proximo++; nav.estado.pendentes.set(id, cb); return id; };
nav.cancelAnimationFrame = function (id) { nav.estado.pendentes.delete(id); };

function criar(tag) {
  const listeners = {};
  return {
    tagName: String(tag).toUpperCase(), style: {}, dataset: {},
    classList: { _set: [], add(c){this._set.push(c);}, remove(){}, contains(c){return this._set.indexOf(c)>=0;} },
    children: [], parentNode: null, textContent: '', clientWidth: 400, clientHeight: 280, width: 0, height: 0,
    appendChild(f){this.children.push(f); f.parentNode=this; return f;},
    removeChild(f){const i=this.children.indexOf(f); if(i>=0)this.children.splice(i,1); return f;},
    remove(){ if(this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k,v){this[k]=v;}, getAttribute(k){return this[k]===undefined?null:this[k];},
    querySelector(){return null;}, querySelectorAll(){return [];},
    getBoundingClientRect(){return {left:0,top:0,width:400,height:280,right:400,bottom:280};},
    addEventListener(n,f){(listeners[n]=listeners[n]||[]).push(f);},
    removeEventListener(n,f){const ls=listeners[n]||[];const i=ls.indexOf(f);if(i>=0)ls.splice(i,1);},
  };
}

global.document = {
  visibilityState: 'visible', createElement: criar, createElementNS: criar,
  createTextNode: (t) => ({ text: t }),
  addEventListener(){}, removeEventListener(){},
  querySelector: () => null, querySelectorAll: () => [],
  documentElement: { classList: {add(){},remove(){},contains(){return false;}}, style:{}, setAttribute(){}, getAttribute(){return null;} },
  body: { appendChild(){}, removeChild(){} }, head: { appendChild(){} },
};
global.addEventListener = nav.addEventListener;
global.removeEventListener = nav.removeEventListener;
global.requestAnimationFrame = nav.requestAnimationFrame;
global.cancelAnimationFrame = nav.cancelAnimationFrame;
global.matchMedia = (q) => ({ matches: /reduced-motion/.test(q), media: q, addEventListener(){} });

const utils = require(path.join(RAIZ, 'js/core/utils.js'));
utils.el = criar;
const UI = require(path.join(RAIZ, 'js/core/ui.js'));
UI.el = criar; UI.icons = function () {};

const contador = { criados: 0, devolvidos: 0, devolvidosPorId: {} };
function threeFalso() {
  function rec() { return function () { this.dispose = function(){}; this.rotateX=function(){}; this.rotateY=function(){}; this.rotateZ=function(){}; }; }
  function no3D() { return { x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar(s){this.x=this.y=this.z=s;} }; }
  function Mesh(g,m){this.geometry=g;this.material=m;this.position=no3D();this.rotation=no3D();this.scale=no3D();this.userData={};}
  return {
    Scene: function(){this.children=[];this.add=function(o){this.children.push(o);};this.clear=function(){};},
    Group: function(){this.children=[];this.rotation=no3D();this.position=no3D();this.add=function(o){this.children.push(o);};},
    Mesh, BoxGeometry: rec(), CylinderGeometry: rec(), CircleGeometry: rec(), SphereGeometry: rec(), TorusGeometry: rec(),
    MeshStandardMaterial: function(o){o=o||{};this.emissive={setHex(){}};this.emissiveIntensity=1;this.dispose=function(){};},
    MeshBasicMaterial: function(){this.dispose=function(){};},
    HemisphereLight: function(){this.position=no3D();}, DirectionalLight: function(){this.position=no3D();},
    PerspectiveCamera: function(){this.position=no3D();this.lookAt=function(){};this.updateProjectionMatrix=function(){};this.aspect=1;},
    Vector2: function(x,y){this.x=x||0;this.y=y||0;this.set=function(a,b){this.x=a;this.y=b;};this.copy=function(o){this.x=o.x;this.y=o.y;};},
    Raycaster: function(){this.setFromCamera=function(){};this.intersectObjects=function(){return[];};},
  };
}
const Gfx = require(path.join(RAIZ, 'js/core/gfx.js'));
Object.defineProperty(Gfx, 'three', { value: threeFalso(), configurable: true });
Gfx.criarRenderer = function () {
  return { domElement: { parentElement: { clientWidth: 400, clientHeight: 280 } },
    setSize(){}, setPixelRatio(){}, render(){}, dispose(){}, getContext(){return null;} };
};
Gfx.destruir = function () {};
require(path.join(RAIZ, 'js/core/cena.js'));
for (const m of ['js/core/music.js','js/core/render.js','js/views/violao3d.js','js/views/traste3d.js']) {
  delete require.cache[require.resolve(path.join(RAIZ, m))];
}
require(path.join(RAIZ, 'js/core/music.js'));
require(path.join(RAIZ, 'js/core/render.js'));
require(path.join(RAIZ, 'js/views/violao3d.js'));
const Traste3D = require(path.join(RAIZ, 'js/views/traste3d.js'));

const wrap = Traste3D.mostrar({ pcs:[0,2,4,5,7,9,11], rootPc:0, flat:false, frets:12, inst:'violao', acordes:[] });

function arvore(no, prof) {
  const d = prof || 0;
  if (!no || !no.tagName) { console.log('  '.repeat(d) + '#texto'); return; }
  const cls = (no.classList && no.classList._set) ? no.classList._set.join('.') : '';
  console.log('  '.repeat(d) + no.tagName + (cls ? '.' + cls : ''));
  for (const f of (no.children||[])) arvore(f, d+1);
}
console.log('--- imediatamente apos mostrar() ---');
arvore(wrap);
setTimeout(() => {
  console.log('\n--- depois de uma volta do laco de eventos ---');
  arvore(wrap);
  const c = wrap.classList._set;
  console.log('classes do wrap:', c.join(','));
}, 10);
