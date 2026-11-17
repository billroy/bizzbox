/** First-person wireframe flight through detailed cities and spacecraft. */
export default {
  name: 'ActivityWireframeFlyover',
  props: { activity: { type: Object, required: true } },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let raf = null;
    let last = 0;
    let progress = props.activity.state?.progress || 0;

    function themeColor(name, fallback) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function pathPoint(path, t) {
      if (!path?.length) return [0, 5, 0];
      const scaled = ((t % 1) + 1) % 1 * (path.length - 1);
      const index = Math.min(path.length - 2, Math.floor(scaled));
      const mix = scaled - index;
      return path[index].map((value, axis) => value + (path[index + 1][axis] - value) * mix);
    }

    function draw(time) {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.value;
      const state = props.activity.state;
      if (!canvas || !state?.structures || !state?.path) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const accent = themeColor('--color-accent-1', '#00ff9d');
      const dim = themeColor('--color-text-dim', '#4aa77d');
      const dt = last ? Math.min((time - last) / 1000, .05) : 0;
      last = time;
      progress = (progress + dt * .018 * (state.speed || 1)) % 1;
      const camera = pathPoint(state.path, progress);
      const ahead = pathPoint(state.path, progress + .012);
      const yaw = Math.atan2(ahead[0] - camera[0], ahead[2] - camera[2]);
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const focal = Math.min(w * .85, h * 1.35);
      const horizon = h * .47;

      function project(point) {
        const dx = point[0] - camera[0], dz = point[2] - camera[2];
        const x = dx * cy - dz * sy;
        const z = dx * sy + dz * cy;
        if (z < .8) return null;
        return [w / 2 + x / z * focal, horizon - (point[1] - camera[1]) / z * focal, z];
      }
      function line(a, b, alpha = .45, width = 1) {
        const pa = project(a), pb = project(b);
        if (!pa || !pb) return;
        ctx.globalAlpha = alpha; ctx.strokeStyle = accent; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      }

      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      function box(cx, base, cz, bw, bh, bd, alpha = .45) {
        const x0=cx-bw/2,x1=cx+bw/2,z0=cz-bd/2,z1=cz+bd/2,y1=base+bh;
        const v=[[x0,base,z0],[x1,base,z0],[x1,base,z1],[x0,base,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]];
        edges.forEach(([a,b])=>line(v[a],v[b],alpha));
      }
      function ring(cx, y, cz, rx, rz, alpha=.45) {
        for(let i=0;i<12;i++){
          const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;
          line([cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz],[cx+Math.cos(b)*rx,y,cz+Math.sin(b)*rz],alpha);
        }
      }
      function detailedStructure(s) {
        const distance=Math.max(12,s.z-camera[2]+12);
        const alpha=.2+Math.min(.62,18/distance);
        if(s.kind==='rocket'){
          for(let y=0;y<s.h;y+=s.h/6) ring(s.x,y,s.z,s.w/2,s.d/2,alpha);
          for(let i=0;i<8;i++){
            const a=i/8*Math.PI*2;
            line([s.x+Math.cos(a)*s.w/2,0,s.z+Math.sin(a)*s.d/2],[s.x+Math.cos(a)*s.w/2,s.h*.82,s.z+Math.sin(a)*s.d/2],alpha);
            line([s.x+Math.cos(a)*s.w/2,s.h*.82,s.z+Math.sin(a)*s.d/2],[s.x,s.h,s.z],alpha);
          }
          return;
        }
        if(s.kind==='tank_farm'){
          for(const ox of [-s.w*.26,s.w*.26]) for(const oz of [-s.d*.25,s.d*.25]){
            ring(s.x+ox,0,s.z+oz,s.w*.2,s.d*.2,alpha); ring(s.x+ox,s.h,s.z+oz,s.w*.2,s.d*.2,alpha);
            for(let i=0;i<4;i++){const a=i/4*Math.PI*2;line([s.x+ox+Math.cos(a)*s.w*.2,0,s.z+oz+Math.sin(a)*s.d*.2],[s.x+ox+Math.cos(a)*s.w*.2,s.h,s.z+oz+Math.sin(a)*s.d*.2],alpha);}
          }
          return;
        }
        const tiers=Math.max(1,(s.setbacks||0)+1);
        for(let tier=0;tier<tiers;tier++){
          const y0=s.h*tier/tiers, scale=1-tier*.16;
          box(s.x,y0,s.z,s.w*scale,s.h/tiers,s.d*scale,alpha);
        }
        // Floor plates, facade mullions and structural ribs make scale readable.
        const floors=Math.min(18,s.floors||3);
        for(let floor=1;floor<floors;floor++){
          const y=floor/floors*s.h;
          line([s.x-s.w/2,y,s.z-s.d/2],[s.x+s.w/2,y,s.z-s.d/2],alpha*.62);
          line([s.x-s.w/2,y,s.z+s.d/2],[s.x+s.w/2,y,s.z+s.d/2],alpha*.42);
        }
        const bays=Math.max(2,Math.min(6,Math.round(s.w/1.4)));
        for(let bay=1;bay<bays;bay++){
          const x=s.x-s.w/2+s.w*bay/bays;
          line([x,0,s.z-s.d/2],[x,s.h,s.z-s.d/2],alpha*.58);
        }
        if(['hull','superstructure','gantry','launch_tower'].includes(s.kind)){
          for(let y=0;y<s.h-2;y+=3){
            line([s.x-s.w/2,y,s.z-s.d/2],[s.x+s.w/2,Math.min(s.h,y+3),s.z-s.d/2],alpha*.7);
            line([s.x+s.w/2,y,s.z+s.d/2],[s.x-s.w/2,Math.min(s.h,y+3),s.z+s.d/2],alpha*.55);
          }
        }
        if(s.roof==='antenna'||s.roof==='crane'){
          line([s.x,s.h,s.z],[s.x,s.h+Math.max(3,s.h*.28),s.z],alpha);
          line([s.x-1.4,s.h+1.2,s.z],[s.x+1.4,s.h+1.2,s.z],alpha*.8);
        }else if(s.roof==='mechanical'||s.roof==='greeble'){
          box(s.x-s.w*.18,s.h,s.z,s.w*.22,Math.max(.7,s.h*.1),s.d*.3,alpha*.75);
          box(s.x+s.w*.18,s.h,s.z,s.w*.18,Math.max(.5,s.h*.08),s.d*.22,alpha*.7);
        }else if(s.roof==='helipad'){
          ring(s.x,s.h+.05,s.z,Math.min(s.w,s.d)*.3,Math.min(s.w,s.d)*.3,alpha);
        }
      }

      // Ground/flight reference changes with the environment.
      const groundY=(state.scene==='starship'||state.scene==='shipyard')?-1.5:0;
      for(let z=Math.floor(camera[2]/5)*5;z<camera[2]+100;z+=5)line([-28,groundY,z],[28,groundY,z],.12);
      for(let x=-28;x<=28;x+=4)line([x,groundY,camera[2]],[x,groundY,camera[2]+100],.1);
      if(state.scene==='urban'){
        line([-4,0,camera[2]],[-4,0,camera[2]+100],.48,1.2);line([4,0,camera[2]],[4,0,camera[2]+100],.48,1.2);
        for(let z=Math.floor(camera[2]/6)*6;z<camera[2]+100;z+=6)line([-.12,.02,z],[.12,.02,z+2.4],.65,1.2);
      }
      for(let i=0;i<state.path.length-1;i++)line(state.path[i],state.path[i+1],.42,1.2);

      const ordered = [...state.structures].sort((a, b) => b.z - a.z);
      ordered.forEach(detailedStructure);

      ctx.globalAlpha = .75; ctx.strokeStyle = accent; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w/2-14,h/2); ctx.lineTo(w/2-4,h/2); ctx.moveTo(w/2+4,h/2); ctx.lineTo(w/2+14,h/2);
      ctx.moveTo(w/2,h/2-14); ctx.lineTo(w/2,h/2-4); ctx.moveTo(w/2,h/2+4); ctx.lineTo(w/2,h/2+14); ctx.stroke();
      ctx.font = '9px monospace'; ctx.fillStyle = dim; ctx.globalAlpha = 1;
      ctx.fillText(`${state.craft} // ${state.site}`, 7, 13);
      ctx.fillText(`ALT ${camera[1].toFixed(1)}M   HDG ${((yaw * 180 / Math.PI + 360) % 360).toFixed(0).padStart(3,'0')}`, 7, 25);
      ctx.textAlign = 'right'; ctx.fillText(`TRACK ${(progress * 100).toFixed(1)}%`, w - 7, 13); ctx.textAlign = 'left';
    }

    onMounted(() => { raf = requestAnimationFrame(draw); });
    onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });
    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas" aria-label="Animated wireframe flyover of an industrial site"></canvas>`,
};
