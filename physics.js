/* ---------- Beam model (mm) ----------
   Under the cone: 50 kV Xstrahl RADiant Aura, closed acrylic cones at 6 cm. See CLAUDE.md, Physics model.
   Dose is relative, normalized to the central axis skin surface with the applicator touching.
   Teaching model only, never for prescription or treatment calculation. */
export const SSD=60, RX_D=2, RX_GY=2.5;
export let FR=10, CONE=20, PDD_RX=0.834, DSURF=3;
/* Clinic SRT treatment time table (50 kV, 6 cm FSD), 6 Gy column, depths 0 to 4 mm in 0.5 mm steps.
   Depth dose at each depth = beam on time at the surface / beam on time at that depth.
   beam: minutes for 2.5 Gy at 2 mm. mu: beam hardening fit used past 4 mm. tail: out of field scatter relative to the 20 mm cone. */
export const CONES={
  10:{t:[2.70,2.81,2.93,3.07,3.30,3.44,3.59,3.74,3.92],beam:1.37,mu:0.0640,tail:0.55},
  15:{t:[2.59,2.69,2.81,2.93,3.11,3.23,3.37,3.54,3.74],beam:1.29,mu:0.0591,tail:0.70},
  20:{t:[2.51,2.61,2.71,2.83,3.01,3.12,3.24,3.42,3.60],beam:1.26,mu:0.0574,tail:1.00},
  30:{t:[2.44,2.53,2.64,2.75,2.92,3.03,3.14,3.30,3.48],beam:1.21,mu:0.0561,tail:1.35},
  40:{t:[2.40,2.50,2.59,2.71,2.87,2.98,3.10,3.25,3.40],beam:1.20,mu:0.0560,tail:1.70}};
const KH=0.015,AG=new Float32Array(1601);
export function pchip(xs,ys){const n=xs.length,h=[],dl=[],m=new Array(n);
  for(let i=0;i<n-1;i++){h[i]=xs[i+1]-xs[i];dl[i]=(ys[i+1]-ys[i])/h[i];}
  m[0]=dl[0];m[n-1]=dl[n-2];
  for(let i=1;i<n-1;i++){if(dl[i-1]*dl[i]<=0)m[i]=0;else{const w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];m[i]=(w1+w2)/(w1/dl[i-1]+w2/dl[i]);}}
  return x=>{const i=Math.min(n-2,Math.max(0,Math.floor((x-xs[0])/h[0]))),t=(x-xs[i])/h[i],t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h[i]*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h[i]*m[i+1];};}
/* Attenuation part of the depth dose (inverse square removed): clinic table from 0 to 4 mm, then a beam hardening tail. */
function buildCone(){FR=CONE/2;const c=CONES[CONE],xs=[],ys=[];
  for(let i=0;i<9;i++){const d=i*0.5;xs.push(d);ys.push((c.t[0]/c.t[i])/Math.pow(SSD/(SSD+d),2));}
  const f=pchip(xs,ys),g=d=>c.mu*d/(1+KH*d),A4=ys[8];
  for(let n=0;n<AG.length;n++){const d=n*0.05;AG[n]=d<=4?f(d):A4*Math.exp(-(g(d)-g(4)));}
  PDD_RX=doseAt(0,SSD+RX_D,RX_D);DSURF=RX_GY/PDD_RX;}
/* Switch the applicator (10, 15, 20, 30 or 40 mm) and rebuild the attenuation grid and prescription scaling. */
export function setCone(c){CONE=c;buildCone();}
export function att(d){if(d<=0)return 1;const u=d/0.05,n=Math.floor(u);if(n>=AG.length-1)return AG[AG.length-1]*Math.exp(-0.035*(d-80));const f=u-n;return AG[n]*(1-f)+AG[n+1]*f;}
export function pdd0(d){return Math.pow(SSD/(SSD+d),2)*att(d);}

/* Lateral shape: 80 to 20% edge about 1.0 mm at the skin widening with depth; a small loss of side scatter near the edge;
   out of field scatter of about 0.6% at 1 cm and 0.16% at 2 cm from the edge at the skin (20 mm cone). */
export function prof(r,R,dd){dd=dd||0;const s=0.28+0.025*dd,core=1/(1+Math.exp((r-R)/s));
  const cdef=Math.min(0.12,0.04+0.004*dd),edge=r<R?1-cdef*Math.exp(-(R-r)/2):1-cdef;
  const amp=0.022*(1+0.1*dd)*CONES[CONE].tail,lam=7.6+0.2*dd,tail=r>R?amp*Math.exp(-(r-R)/lam):amp;
  return core*edge+(1-core)*tail;}
/* Dose at lateral offset r, vertical distance L below the source, depth dd under the skin: true inverse square and slant path. */
export function doseAt(r,L,dd){const Lr=Math.sqrt(L*L+r*r),R=FR*L/SSD;return Math.pow(SSD/Lr,2)*att(dd*Lr/L)*prof(r,R,dd);}

/* Isodose depth: first depth on the central axis where dose falls to frac of the skin surface dose, with the applicator
   lifted by gap. Searched down in steps of step mm (the panel uses 0.05). Returns 0 if not reached by 60 mm. */
export function isoDepth(frac,gap=0,step=0.05){const s=doseAt(0,SSD+gap,0);
  for(let d=0;d<60;d+=step){if(doseAt(0,SSD+gap+d,d)<=frac*s)return d;}return 0;}
/* Dose across the beam at depth dd (touching), relative to the central axis at the same depth. */
export function offAxis(r,dd){return doseAt(Math.abs(r),SSD+dd,dd)/doseAt(0,SSD+dd,dd);}
/* Distance from the center where offAxis first falls to frac, searched outward in 0.01 mm steps up to max. */
export function edgeAt(frac,dd,max){for(let r=0;r<max;r+=0.01){if(offAxis(r,dd)<=frac)return r;}return max;}

buildCone();
