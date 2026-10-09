import { ROOMS } from './src/rooms.js';
const JUMP_DY=2.6, SERVO_DY=4.6, GAP=5.0, GAP_SERVO=6.5, GAP_DASH=9.5, GAP_FLAT=7.5;
function holeFloor(room, at){let f=0;for(const [x,y,w,h] of room.solids){if(h>=1.5&&y+h<=8.5){if(x<=at-1.0||x+w>=at+1.0)if(Math.min(Math.abs(x-at),Math.abs(x+w-at))<5)f=Math.max(f,y+h);}}return f;}
function nodes(room){const N=[];const add=(x0,x1,y,kind)=>N.push({x0,x1,y,kind});
 for(const [x,y,w,h] of room.solids)add(x,x+w,y+h,"solid");
 for(const [x,y,w] of room.oneway||[])add(x,x+w,y,"oneway");
 for(const m of room.movers||[])for(const [px,py] of m.path)add(px,px+m.w,py,"mover");
 for(const d of room.doors){if(d.s==="E")add(room.w-1.2,room.w-0.2,d.at,"door");else if(d.s==="W")add(0.2,1.2,d.at,"door");else if(d.s==="N")add(d.at-1.2,d.at+1.2,room.h-1.0,"doorN");else add(d.at-1.2,d.at+1.2,holeFloor(room,d.at),"doorS");}
 return N;}
const gapB=(a,b)=>Math.max(0,Math.max(a.x0,b.x0)-Math.min(a.x1,b.x1));
const xOv=(a,b,p=0)=>Math.min(a.x1,b.x1+p)-Math.max(a.x0,b.x0-p)>0.01;
function edges(room,N,t){const E=[];const link=(i,j)=>E.push([i,j]);
 for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){const a=N[i],b=N[j];const gap=gapB(a,b);
  const up=b.y>a.y?[a,b,i,j]:[b,a,j,i];const[lo,hi,li,hiI]=up;const dy=hi.y-lo.y;
  if(dy>0.01){if(dy<=JUMP_DY&&gap<=GAP)link(li,hiI);else if(t.servo&&dy<=SERVO_DY&&gap<=GAP_SERVO)link(li,hiI);else if(t.servo&&dy<=SERVO_DY&&gap<=GAP_DASH)link(li,hiI);else if(dy<=JUMP_DY&&gap<=GAP_DASH)link(li,hiI);}
  else{if(gap<=GAP_FLAT)link(i,j);else if(gap<=GAP_DASH&&dy>-0.6)link(i,j);}
  if(b.kind==="doorN"&&dy>0&&xOv(a,b,1.0)&&dy<=JUMP_DY)link(li,hiI);
  if(a.kind==="doorN"&&xOv(a,b,1.5)&&a.y>b.y)link(i,j);
 }
 return E;}
for (const id of process.argv.slice(2)) {
  const room=ROOMS.find(r=>r.id===id);
  const N=nodes(room), E=edges(room,N,{servo:true});
  const adj=N.map(()=>[]);for(const [i,j] of E){adj[i].push(j);adj[j].push(i);}
  const comp=new Array(N.length).fill(-1);let c=0;
  for(let s=0;s<N.length;s++)if(comp[s]===-1){const st=[s];comp[s]=c;while(st.length){const v=st.pop();for(const u of adj[v])if(comp[u]===-1){comp[u]=c;st.push(u);}}c++;}
  console.log('==',id);
  N.forEach((n,i)=>console.log(i, n.kind.padEnd(6), n.x0.toFixed(1)+'..'+n.x1.toFixed(1), 'y'+n.y.toFixed(1), 'comp'+comp[i]));
}
