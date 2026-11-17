/** Live engineering drawing with orthographic views, dimensions and sheet data. */
export default {
  name: 'ActivityIndustrialBlueprint',
  props: { activity: { type: Object, required: true } },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let raf = null;
    let localProgress = props.activity.state?.progress || 0;

    const add = (out, a, b, kind='object', label='') => out.push({ a, b, kind, label });
    const poly = (out, points, close=false, kind='object') => {
      for(let i=0;i<points.length-1;i++) add(out,points[i],points[i+1],kind);
      if(close)add(out,points.at(-1),points[0],kind);
    };
    const ellipse = (out,cx,cy,rx,ry,kind='object',steps=28) => {
      const p=Array.from({length:steps+1},(_,i)=>[cx+Math.cos(i/steps*Math.PI*2)*rx,cy+Math.sin(i/steps*Math.PI*2)*ry]);
      poly(out,p,false,kind);
    };
    function dimH(out,x1,x2,y,objectY,label){
      add(out,[x1,objectY],[x1,y],'extension');add(out,[x2,objectY],[x2,y],'extension');
      add(out,[x1,y],[x2,y],'dimension',label);add(out,[x1,y-1],[x1+2,y+1],'dimension');add(out,[x2,y-1],[x2-2,y+1],'dimension');
    }
    function dimV(out,x,y1,y2,objectX,label){
      add(out,[objectX,y1],[x,y1],'extension');add(out,[objectX,y2],[x,y2],'extension');
      add(out,[x,y1],[x,y2],'dimension',label);add(out,[x-1,y1],[x+1,y1+2],'dimension');add(out,[x-1,y2],[x+1,y2-2],'dimension');
    }
    function leader(out,from,to,label){add(out,from,to,'leader',label);add(out,[to[0]-1,to[1]-1],[to[0]+1,to[1]+1],'leader');}
    function center(out,x1,y1,x2,y2){add(out,[x1,y1],[x2,y2],'center');}

    function airplane(out){
      // Plan view with fuselage stations, wing spars, control surfaces and engine nacelles.
      poly(out,[[7,25],[13,21],[31,19],[41,8],[47,8],[43,20],[62,23],[66,25],[62,27],[43,30],[47,42],[41,42],[31,31],[13,29]],true);
      center(out,5,25,68,25); ellipse(out,27,25,4,5); ellipse(out,37,16,3,4); ellipse(out,37,34,3,4);
      for(const x of [13,20,27,34,43,54,62])add(out,[x,22],[x,28],'hidden');
      add(out,[31,19],[43,30],'detail');add(out,[31,31],[43,20],'detail');add(out,[41,8],[43,20],'detail');add(out,[41,42],[43,30],'detail');
      dimH(out,7,66,4,21,'38 420 O.A.L.');dimV(out,70,8,42,47,'29 325 SPAN');
      leader(out,[48,11],[42,18],'WING STA 4600 / FWD SPAR');leader(out,[52,35],[41,31],'AILERON HINGE CL');
      // Side elevation.
      poly(out,[[7,63],[13,58],[47,58],[59,62],[64,65],[58,67],[19,67],[9,65]],true);
      poly(out,[[46,58],[53,49],[56,49],[55,61]],true); center(out,5,64,67,64);
      for(const x of [18,24,30,36,42,48,54])add(out,[x,58],[x,67],'hidden');
      ellipse(out,19,62,1.4,1);ellipse(out,23,62,1.4,1);ellipse(out,27,62,1.4,1);
      dimH(out,7,64,73,67,'F.S. 0.00 — F.S. 38420');leader(out,[47,54],[53,51],'VERT STAB — RIB 12');
      // Section B-B.
      ellipse(out,82,26,10,13);ellipse(out,82,26,8.7,11.7,'detail');center(out,70,26,94,26);center(out,82,11,82,41);
      for(let a=0;a<Math.PI*2;a+=Math.PI/4)add(out,[82+Math.cos(a)*8.7,26+Math.sin(a)*11.7],[82+Math.cos(a)*10,26+Math.sin(a)*13],'detail');
      leader(out,[92,12],[88,17],'SECTION B-B');leader(out,[94,38],[89,34],'FRAME 420 / TYP');
    }

    function rocket(out){
      poly(out,[[27,7],[32,15],[34,25],[34,64],[39,74],[35,72],[34,82],[20,82],[19,72],[15,74],[20,64],[20,25],[22,15]],true);
      center(out,27,4,27,86);for(const y of [25,39,57,64,72])add(out,[20,y],[34,y],'detail');
      for(const x of [22,25,29,32])add(out,[x,64],[x,81],'hidden');
      dimV(out,10,7,82,20,'94 700 O.A.H.');dimH(out,20,34,88,82,'Ø 8 400');
      leader(out,[45,15],[32,18],'OGIVE PAYLOAD FAIRING');leader(out,[47,40],[34,40],'LOX TANK / STA 28400');leader(out,[46,60],[34,60],'LH2 TANK / COMMON BULKHEAD');
      // Engine thrust-frame section.
      ellipse(out,72,28,15,15);ellipse(out,72,28,4,4);center(out,55,28,89,28);center(out,72,11,72,45);
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;ellipse(out,72+Math.cos(a)*9,28+Math.sin(a)*9,2.2,2.2,'detail',14);add(out,[72+Math.cos(a)*4,28+Math.sin(a)*4],[72+Math.cos(a)*7,28+Math.sin(a)*7],'detail');}
      leader(out,[91,14],[83,19],'SECTION A-A');leader(out,[91,43],[82,38],'8X ENGINE MOUNT EQ SP');
      // Local structural detail.
      poly(out,[[59,59],[87,59],[87,79],[59,79]],true);for(let x=62;x<87;x+=5)add(out,[x,59],[x+8,79],'detail');
      dimH(out,59,87,84,79,'12 600 REF');leader(out,[88,55],[82,60],'THRUST FRAME — DETAIL C');
    }

    function launchPad(out){
      add(out,[7,73],[94,73]);poly(out,[[18,73],[18,18],[29,18],[29,73]],true);
      for(let y=23;y<72;y+=7){add(out,[18,y],[29,y]);add(out,[18,y],[29,y+7],'detail');}
      poly(out,[[49,71],[49,27],[53,16],[57,27],[57,71]],true);for(const y of [37,49,61])add(out,[49,y],[57,y],'detail');
      for(const y of [30,43,56])poly(out,[[29,y],[45,y],[49,y+3],[29,y+4]],true,'detail');
      poly(out,[[42,73],[47,66],[60,66],[66,73]],false);add(out,[12,78],[88,78]);
      dimV(out,8,18,73,18,'EL. +96 250');dimH(out,42,66,85,73,'12 500 CL');
      leader(out,[65,20],[55,26],'LIGHTNING MAST');leader(out,[70,42],[48,45],'CREW ACCESS ARM — EL +42.600');leader(out,[69,63],[58,65],'TAIL SERVICE MAST');
      // Site plan inset with roads, pad rings and north arrow.
      poly(out,[[68,8],[94,8],[94,34],[68,34]],true,'detail');ellipse(out,81,21,8,8);ellipse(out,81,21,4,4,'detail');
      add(out,[70,12],[92,30],'hidden');add(out,[70,30],[92,12],'hidden');add(out,[91,31],[91,11],'center','N');
      leader(out,[92,37],[87,29],'PLAN — GRID 7 / C5');
    }

    function facility(out){
      // Building elevation and framing grids.
      poly(out,[[8,63],[8,25],[28,25],[28,17],[52,17],[52,34],[67,34],[67,24],[89,24],[89,63]],false);
      add(out,[5,63],[94,63]);for(const x of [14,21,34,42,50,59,73,82])add(out,[x,17],[x,63],'hidden');
      for(const y of [31,40,49,57])add(out,[8,y],[89,y],'detail');
      ellipse(out,76,42,8,12);ellipse(out,76,42,6.5,10.5,'detail');center(out,66,42,86,42);
      for(let x=31;x<63;x+=6){add(out,[x,43],[x+5,48],'detail');add(out,[x+5,48],[x,53],'detail');}
      dimH(out,8,89,70,63,'84 000 GRID 1—9');dimV(out,3,17,63,8,'EL +32 400');
      leader(out,[72,14],[51,18],'REACTOR HALL — GRID C5');leader(out,[91,45],[83,44],'T-201 TURBINE CASING');leader(out,[61,38],[56,43],'PIPE RACK PR-12');
      // Process plan inset.
      poly(out,[[10,77],[55,77],[55,94],[10,94]],true,'detail');
      for(const x of [17,29,41,50]){ellipse(out,x,85,3,3,'detail',14);add(out,[x+3,85],[x+7,85],'detail');}
      add(out,[12,80],[53,80],'center');add(out,[12,90],[53,90],'center');leader(out,[58,88],[51,88],'P&ID INTERFACE / BATTERY LIMIT');
    }

    function turbine(out){
      // Sectioned front view with blade root and casing details.
      ellipse(out,35,39,26,26);ellipse(out,35,39,22,22,'detail');ellipse(out,35,39,9,9);ellipse(out,35,39,4,4);
      center(out,6,39,64,39);center(out,35,10,35,68);
      for(let i=0;i<24;i++){
        const a=i/24*Math.PI*2,b=a+.12;
        poly(out,[[35+Math.cos(a)*9,39+Math.sin(a)*9],[35+Math.cos(b)*19,39+Math.sin(b)*19],[35+Math.cos(a+.2)*22,39+Math.sin(a+.2)*22]],false,'detail');
      }
      dimH(out,9,61,72,65,'Ø 3 800 ±0.25');leader(out,[63,14],[53,21],'24X STATOR VANE EQ SP');leader(out,[64,59],[51,54],'ROTOR BLADE ROOT — DETAIL D');
      // Longitudinal cutaway.
      poly(out,[[68,22],[91,25],[94,34],[94,54],[91,61],[68,64]],false);center(out,65,43,96,43);
      for(const x of [72,76,80,84,88]){add(out,[x,27],[x,59],'detail');ellipse(out,x,43,2+(x-70)*.1,12,'hidden',14);}
      poly(out,[[69,38],[87,38],[92,42],[87,48],[69,48]],true,'detail');
      dimH(out,68,94,69,64,'6 250 REF');leader(out,[95,18],[85,27],'SECTION A-A / FLOW →');
    }

    function geometry(subject){const out=[];({airplane,rocket,launch_pad:launchPad,industrial_facility:facility,turbine}[subject]||facility)(out);return out;}

    const sheetTitles={
      airplane:'AX-47 AIRFRAME GA',
      launch_pad:'LC-07 SITE PLAN',
      rocket:'HLV-9 VEHICLE',
      industrial_facility:'PROCESS FACILITY',
      turbine:'TURBINE STAGE ASSY',
    };

    function drawSheet(ctx,w,h,state,accent,dim){
      const m=5,titleH=Math.max(32,Math.min(54,h*.27)),titleY=h-m-titleH;
      ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.globalAlpha=.88;ctx.lineWidth=1;ctx.setLineDash([]);
      ctx.strokeRect(m,m,w-m*2,h-m*2);ctx.strokeRect(m+3,m+3,w-m*2-6,h-m*2-6);
      ctx.font=`${Math.max(6,Math.min(8,w/55))}px monospace`;
      for(let i=0;i<4;i++){const y=m+3+(titleY-m-3)*i/4;ctx.fillText(String.fromCharCode(65+i),m+.5,y+(titleY-m)/8);ctx.textAlign='right';ctx.fillText(String.fromCharCode(65+i),w-m-.5,y+(titleY-m)/8);ctx.textAlign='left';}
      for(let i=0;i<6;i++){const x=m+3+(w-m*2-6)*(i+.5)/6;ctx.fillText(String(i+1),x,m+8);}
      ctx.beginPath();ctx.moveTo(m,titleY);ctx.lineTo(w-m,titleY);ctx.stroke();
      const split=w*.47;ctx.beginPath();ctx.moveTo(split,titleY);ctx.lineTo(split,h-m);ctx.stroke();
      ctx.fillStyle=dim;ctx.globalAlpha=.9;ctx.font=`${Math.max(5,Math.min(7,w/65))}px monospace`;
      const notes=['GENERAL NOTES:','1. DIMENSIONS ARE IN MILLIMETRES.','2. DO NOT SCALE DRAWING.','3. REMOVE BURRS / BREAK SHARP EDGES.','4. DATUM A CONTROLS UNLESS NOTED.'];
      notes.forEach((t,i)=>ctx.fillText(t,m+6,titleY+9+i*8));
      const col=split,row1=titleY+titleH*.48,row2=titleY+titleH*.7;
      ctx.strokeStyle=accent;ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(col,row1);ctx.lineTo(w-m,row1);ctx.moveTo(col,row2);ctx.lineTo(w-m,row2);ctx.moveTo(w*.72,row1);ctx.lineTo(w*.72,h-m);ctx.moveTo(w*.87,row1);ctx.lineTo(w*.87,h-m);ctx.stroke();
      ctx.globalAlpha=1;ctx.fillStyle=accent;
      const sheetTitle=sheetTitles[state.strategy]||'GENERAL ARRANGEMENT';
      const titleMax=w-m-col-10;
      let titleSize=Math.max(6,Math.min(10,w/40));
      ctx.font=`bold ${titleSize}px monospace`;
      while(titleSize>5&&ctx.measureText(sheetTitle).width>titleMax){titleSize-=.5;ctx.font=`bold ${titleSize}px monospace`;}
      ctx.save();ctx.beginPath();ctx.rect(col+2,titleY+2,titleMax+3,row1-titleY-4);ctx.clip();ctx.fillText(sheetTitle,col+5,titleY+13);ctx.restore();
      ctx.font=`${Math.max(5,Math.min(7,w/65))}px monospace`;ctx.fillStyle=dim;
      ctx.fillText(`DRAWN  J.DOE  2026-11-17`,col+5,titleY+24);ctx.fillText(`CHKD   ${state.checked_by||'S.PATEL'}`,col+5,titleY+33);
      ctx.fillText(`DWG NO.`,col+5,row1+9);ctx.fillStyle=accent;ctx.fillText(state.drawing||'DWG-00000-A',col+5,row1+19);
      ctx.fillStyle=dim;ctx.fillText(`SCALE`,w*.72+3,row1+9);ctx.fillText(state.scale||'1:50',w*.72+3,row1+19);
      ctx.fillText(`REV`,w*.87+3,row1+9);ctx.fillText(state.revision||'A',w*.87+3,row1+19);
      ctx.fillText(`SHEET ${state.sheet||'1 OF 1'}`,w*.72+3,row2+10);ctx.fillText(state.units||'mm UNLESS NOTED',col+5,row2+10);
      return {x:m+10,y:m+13,w:w-m*2-20,h:titleY-m-17};
    }

    function draw(){
      raf=requestAnimationFrame(draw);const canvas=canvasRef.value,state=props.activity.state;if(!canvas||!state)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const dpr=window.devicePixelRatio||1;
      if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
      const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const accent=getComputedStyle(document.documentElement).getPropertyValue('--color-accent-1').trim()||'#b9e4ff';
      const dim=getComputedStyle(document.documentElement).getPropertyValue('--color-text-dim').trim()||'#5f9fc8';
      const area=drawSheet(ctx,w,h,state,accent,dim);
      ctx.strokeStyle=accent;ctx.lineWidth=.4;ctx.globalAlpha=.1;
      const grid=Math.max(8,Math.min(area.w,area.h)/14);ctx.beginPath();for(let x=area.x;x<area.x+area.w;x+=grid){ctx.moveTo(x,area.y);ctx.lineTo(x,area.y+area.h);}for(let y=area.y;y<area.y+area.h;y+=grid){ctx.moveTo(area.x,y);ctx.lineTo(area.x+area.w,y);}ctx.stroke();
      localProgress+=((state.progress??localProgress)-localProgress)*.035;const commands=geometry(state.strategy);const visible=Math.max(1,Math.floor(Math.min(1,localProgress)*commands.length));
      const px=p=>[area.x+p[0]/100*area.w,area.y+p[1]/100*area.h];
      for(let i=0;i<visible;i++){
        const c=commands[i],a=px(c.a),b=px(c.b);ctx.strokeStyle=c.kind==='dimension'||c.kind==='extension'?dim:accent;
        ctx.globalAlpha=c.kind==='hidden'?.32:c.kind==='center'?.4:c.kind==='detail'?.58:.9;ctx.lineWidth=c.kind==='object'?1:.65;
        ctx.setLineDash(c.kind==='hidden'?[3,3]:c.kind==='center'?[8,3,2,3]:[]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
        if(c.label){ctx.setLineDash([]);ctx.globalAlpha=.9;ctx.fillStyle=dim;ctx.font=`${Math.max(5,Math.min(7,w/65))}px monospace`;ctx.fillText(c.label,(a[0]+b[0])/2+2,(a[1]+b[1])/2-2);}
      }
      ctx.setLineDash([]);ctx.globalAlpha=1;ctx.fillStyle=dim;ctx.font=`${Math.max(5,Math.min(7,w/65))}px monospace`;
      (state.annotations||[]).forEach((note,i)=>ctx.fillText(`${i+1}  ${note}`,area.x+3,area.y+area.h-3-i*8));
      ctx.textAlign='right';ctx.fillText(`PLOT ${Math.min(100,localProgress*100).toFixed(0)}%`,area.x+area.w-3,area.y+9);ctx.textAlign='left';
    }
    onMounted(()=>{raf=requestAnimationFrame(draw);});onUnmounted(()=>{if(raf)cancelAnimationFrame(raf);});return{canvasRef};
  },
  template:`<canvas ref="canvasRef" class="activity-canvas" aria-label="Live technical engineering blueprint with dimensions and title block"></canvas>`,
};
