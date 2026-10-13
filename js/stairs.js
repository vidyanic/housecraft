/** Three perimeter flights with uniform risers/going and two clear rectangular landings. */
(function(){
 'use strict';const A=window.Atelier;
 function stairFormatLength(cm){const unit=A.state?.project?.unit||'cm',n=v=>String(Number(v.toFixed(2)));if(unit==='ft'){let feet=Math.floor(cm/30.48),inches=Number(((cm-feet*30.48)/2.54).toFixed(2));if(inches>=12){feet++;inches=0;}return feet?feet+'′ '+n(inches)+'″':n(inches)+'″';}return unit==='in'?n(cm/2.54)+'″':unit==='m'?String(Number((cm/100).toFixed(3)))+' m':n(cm)+' cm';}
 function threeSideStairLayout(o){
  const width=o.stairWidth??91.44,minLanding=Math.max(width,o.stairLandingMin??width),platform=Math.max(width,o.stairPlatformLength??width),target=o.stairTargetRiser??15.24;
  if(![o.w,o.d,o.height,width,o.stairLandingMin??width,o.stairPlatformLength??width,target].every(v=>Number.isFinite(v)&&v>0))throw Error('Enter positive stair room dimensions, floor height and clear width.');
  const alongX=(o.stairStartSide||'short')==='long'?o.w>=o.d:o.w<o.d,L=alongX?o.w:o.d,B=alongX?o.d:o.w;
  let best;
  for(let first=3;first<=12;first++)for(let middle=3;middle<=12;middle++){
   const total=first*2+middle,riser=o.height/total;if(riser<14||riser>18)continue;
   const limit=Math.min((L-minLanding-platform)/(first-1),(B-2*minLanding)/(middle-1),33),going=Math.min(63-2*riser,limit);
   if(going<25||2*riser+going<60-1e-8||2*riser+going>65)continue;
   const landingAlong=L-platform-(first-1)*going,landingAcross=(B-(middle-1)*going)/2;
   const score=Math.abs(riser-target)*100+landingAlong*landingAcross/10000;
   if(!best||score<best.score)best={score,first,middle,total,riser,going,landingAlong,landingAcross};
  }
  if(!best)throw Error('This room cannot fit three flights with the chosen width/landings and comfortable risers/treads. Enlarge the room or reduce the clear width.');
  const {first,middle,total,riser,going,landingAlong:V,landingAcross:U}=best,parts=[],risers=[];
  const map=(u,v)=>{if(o.stairHandedness==='right')u=B-u;return alongX?{x:v-o.w/2,y:u-o.d/2}:{x:u-o.w/2,y:v-o.d/2};};
  const rect=(u,v,du,dv,z,kind,flight)=>{const center=map(u+du/2,v+dv/2);parts.push({...center,w:alongX?dv:du,d:alongX?du:dv,z,kind,flight});};
  rect(0,L-platform,width,platform,0,'entrance',0);
  for(let i=0;i<first-1;i++)rect(0,L-platform-(i+1)*going,width,going,(i+1)*riser,'tread',1);
  rect(0,0,U,V,first*riser,'landing',1);
  for(let i=0;i<middle-1;i++)rect(U+i*going,0,going,width,(first+i+1)*riser,'tread',2);
  rect(B-U,0,U,V,(first+middle)*riser,'landing',2);
  for(let i=0;i<first-1;i++)rect(B-width,V+i*going,width,going,(first+middle+i+1)*riser,'tread',3);
  rect(0,L-platform,B,platform,o.height,'exit',3);
  const path=[map(width/2,L-platform/2),map(width/2,V/2),map(B-width/2,V/2),map(B-width/2,L-platform/2)];
  const rail=(a,b,z1,z2)=>({a:map(...a),b:map(...b),z1,z2}),rails=[rail([width+3,L-platform],[width+3,V],0,first*riser),rail([U,width+3],[B-U,width+3],first*riser,(first+middle)*riser),rail([B-width-3,V],[B-width-3,L-platform],(first+middle)*riser,o.height),rail([width+3,L-platform-3],[B-width-3,L-platform-3],o.height,o.height)];
  const face=(u,v,du,dv,z)=>risers.push({...map(u+du/2,v+dv/2),w:alongX?dv:du,d:alongX?du:dv,z,height:riser});
  for(let i=0;i<first;i++)face(0,L-platform-i*going-.5,width,1,(i+1)*riser);
  for(let i=0;i<middle;i++)face(U+i*going-.5,0,1,width,(first+i+1)*riser);
  for(let i=0;i<first;i++)face(B-width,V+i*going-.5,width,1,(first+middle+i+1)*riser);
  const voidCenter=map(B/2,(V+L-platform)/2),voidArea={...voidCenter,w:alongX?L-platform-V:B-2*width,d:alongX?B-2*width:L-platform-V};
  return {...best,width,minLanding,platform,bridgeWidth:B,alongX,parts,risers,path,rails,voidArea,counts:[first,middle,first],start:path[0],end:path[3],comfort:2*riser+going};
 }
 function updateThreeSideStair(o,changes){if(!A.canTransform(o))return;try{const next={...o,...changes};threeSideStairLayout(next);if(Object.keys(changes).every(k=>o[k]===next[k]))return;A.checkpoint();Object.assign(o,changes);A.queueSave();A.renderInspector();A.draw();}catch(error){A.showToast(error.message);A.renderInspector();}}
 function drawThreeSideStair(o,c){
  let layout;try{layout=threeSideStairLayout(o);}catch(error){c.strokeStyle='#b34232';c.strokeRect(-o.w/2,-o.d/2,o.w,o.d);c.beginPath();c.moveTo(-o.w/2,-o.d/2);c.lineTo(o.w/2,o.d/2);c.stroke();return;}
  c.strokeStyle='#665746';c.lineWidth=1.2/(A.state?.scale||1);
  for(const p of layout.parts){c.fillStyle=p.kind==='entrance'?'#d9eadb':p.kind==='exit'?'#dce8f3':p.kind==='landing'?'#ece0c5':o.color;c.fillRect(p.x-p.w/2,p.y-p.d/2,p.w,p.d);c.strokeRect(p.x-p.w/2,p.y-p.d/2,p.w,p.d);}
  const entry=layout.parts[0];c.fillStyle='#d9eadb';c.fillRect(entry.x-entry.w/2,entry.y-entry.d/2,entry.w,entry.d);c.strokeRect(entry.x-entry.w/2,entry.y-entry.d/2,entry.w,entry.d);
  c.strokeStyle='#28735a';c.lineWidth=2/(A.state?.scale||1);c.beginPath();layout.path.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();const a=layout.path[2],b=layout.path[3],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,size=14;c.beginPath();c.moveTo(b.x-ux*size-uy*size*.45,b.y-uy*size+ux*size*.45);c.lineTo(b.x,b.y);c.lineTo(b.x-ux*size+uy*size*.45,b.y-uy*size-ux*size*.45);c.stroke();
  if((A.state?.scale||1)>.35){const base=(A.floor?.()?.elevation||0)+(o.elevation||0);c.font='12px system-ui';c.textAlign='center';c.fillStyle='#28735a';c.fillText('ENTRY · '+A.formatLength(base),layout.start.x,layout.start.y-8);c.fillText('EXIT · '+A.formatLength(base+o.height),layout.end.x,layout.end.y-8);}
 }
 function threeSideStairSvg(o){
  const l=threeSideStairLayout(o),esc=A.escapeHtml,cx=o.x+o.w/2,cy=o.y+o.d/2,base=(A.floor?.()?.elevation||0)+(o.elevation||0),color=p=>p.kind==='entrance'?'#d9eadb':p.kind==='exit'?'#dce8f3':p.kind==='landing'?'#ece0c5':esc(o.color||'#b89168');
  return `<g transform="translate(${cx} ${cy}) rotate(${o.rotation||0})" data-stair-risers="${l.total}">${[...l.parts,l.parts[0]].map(p=>`<rect x="${p.x-p.w/2}" y="${p.y-p.d/2}" width="${p.w}" height="${p.d}" fill="${color(p)}" stroke="#665746" stroke-width="1"/>`).join('')}<polyline points="${l.path.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="#28735a" stroke-width="2"/><text x="${l.start.x}" y="${l.start.y-8}" font-size="10" text-anchor="middle">ENTRY ${esc(A.formatLength(base))}</text><text x="${l.end.x}" y="${l.end.y-8}" font-size="10" text-anchor="middle">EXIT ${esc(A.formatLength(base+o.height))}</text><text x="0" y="0" font-size="12" text-anchor="middle">${l.total} risers · R ${esc(A.stairFormatLength(l.riser))} · T ${esc(A.stairFormatLength(l.going))}</text></g>`;
 }
 Object.assign(A,{stairFormatLength,threeSideStairSvg,threeSideStairLayout,updateThreeSideStair,drawThreeSideStair});
})();
