import * as THREE from 'three'
import { finishes, part, ring, profile, box } from './product-geometry.js'
import { asset } from '../content/site.js'

// PUMP BODY.pdf: the body envelope is 80 x 87.39 x 70.82 mm.
// Normalize by the 80 mm width; undimensioned mould details follow the orthographic views.
const HEIGHT = 70.82 / 80
const FRONT = 87.39 / 80 - .5
const signedPower = (v, p) => Math.sign(v) * Math.abs(v) ** p
const outline = (a, inset = 0) => {
  const s = Math.sin(a), c = Math.cos(a)
  return [( .5 - inset) * signedPower(s, c >= 0 ? 1 : .42), (c >= 0 ? FRONT - inset : .5 - inset) * signedPower(c, c >= 0 ? 1 : .42)]
}
const topOutline = (a, inset = 0) => {
  const s=Math.sin(a), c=Math.cos(a)
  return [(.322-inset)*signedPower(s,c>=0?.86:.33), (c>=0?.294-inset:.419-inset)*signedPower(c,c>=0?.86:.33)]
}
const coverPoint = (a,t,inset=0) => {
  const b=outline(a,inset), top=topOutline(a,inset)
  const taper=Math.max(0,(t-.17)/.83)
  let x=THREE.MathUtils.lerp(b[0],top[0],taper),z=THREE.MathUtils.lerp(b[1],top[1],taper)
  // Two deep side pockets, with diagonal flanks between the skirt and top deck.
  const side=Math.exp(-(((Math.abs(a)-Math.PI/2)/.42)**4))
  const pocket=.16*side*(1-t)**.6
  x-=Math.sign(x)*pocket
  return [x,.326+(HEIGHT-.326)*t,z]
}
const bowlPoint=(a,t,inset=0)=>{
  const p=outline(a,inset),scale=.73+.27*Math.sin(t*Math.PI/2)
  return [p[0]*scale,.012+.274*t,p[1]*scale]
}

function shell(point, columns, rows, gap) {
  const positions=[],uv=[],indices=[]
  const index=(layer,r,c)=>layer*(rows+1)*(columns+1)+r*(columns+1)+c
  for(let layer=0;layer<2;layer++)for(let r=0;r<=rows;r++)for(let c=0;c<=columns;c++){
    positions.push(...point(-Math.PI+c/columns*Math.PI*2,r/rows,layer*.012));uv.push(c/columns,r/rows)
  }
  const quad=(a,b,c,d)=>indices.push(a,d,b,b,d,c)
  const solid=(r,c)=>r>=0&&r<rows&&!gap(r,(c+columns)%columns)
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
    if(!solid(r,c))continue
    const a=index(0,r,c),b=index(0,r+1,c),cc=index(0,r+1,c+1),d=index(0,r,c+1)
    const aa=index(1,r,c),bb=index(1,r+1,c),ccc=index(1,r+1,c+1),dd=index(1,r,c+1)
    quad(a,b,cc,d);quad(dd,ccc,bb,aa)
    if(!solid(r,c-1))quad(aa,bb,b,a)
    if(!solid(r,c+1))quad(d,cc,ccc,dd)
    if(!solid(r-1,c))quad(aa,a,d,dd)
    if(!solid(r+1,c))quad(b,bb,ccc,cc)
  }
  const g=new THREE.BufferGeometry()
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals()
  return g
}

function deck(point,y,depth,holes=[]) {
  const shape=new THREE.Shape()
  for(let i=0;i<=256;i++){
    const [x,z]=point(-Math.PI+i/256*Math.PI*2)
    i?shape.lineTo(x,-z):shape.moveTo(x,-z)
  }
  shape.closePath();shape.holes.push(...holes)
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48,steps:1})
  g.rotateX(-Math.PI/2);g.translate(0,y-depth,0)
  return g
}

function mountingTab(side,material) {
  const shape=new THREE.Shape(),x=side*.432,w=.126,d=.242,r=.018
  const left=x-w/2,right=x+w/2,bottom=-d/2,top=d/2
  shape.moveTo(left+r,bottom);shape.lineTo(right-r,bottom);shape.quadraticCurveTo(right,bottom,right,bottom+r)
  shape.lineTo(right,top-r);shape.quadraticCurveTo(right,top,right-r,top);shape.lineTo(left+r,top)
  shape.quadraticCurveTo(left,top,left,top-r);shape.lineTo(left,bottom+r);shape.quadraticCurveTo(left,bottom,left+r,bottom)
  for(const z of [-.061,.061]){
    const hole=new THREE.Path(),rr=.021,half=.026
    hole.moveTo(x-half,z-rr);hole.lineTo(x+half,z-rr);hole.absarc(x+half,z,rr,-Math.PI/2,Math.PI/2,false)
    hole.lineTo(x-half,z+rr);hole.absarc(x-half,z,rr,Math.PI/2,Math.PI*1.5,false);hole.closePath();shape.holes.push(hole)
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth:.026,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2,curveSegments:24,steps:1})
  g.rotateX(-Math.PI/2);g.translate(0,.334,0)
  return new THREE.Mesh(g,material)
}

export function createModel() {
  const root=new THREE.Group();root.name='submersible-pump-drawing'
  root.userData.bodyDimensionsMm={width:80,depth:87.39,height:70.82}
  const m=finishes()
  // Keep the catalogue's teal/black finish; drawing colours identify separate CAD parts.
  part(root,'tapered-cover-with-side-pockets',shell(coverPoint,256,48,(r,c)=>{
    const a=-Math.PI+(c+.5)/256*Math.PI*2
    return r>=12&&r<42&&Math.abs(a)<1.17&&c%8>=2&&c%8<=4
  }),m.teal)
  part(root,'rounded-intake-cage',shell(bowlPoint,256,32,(r,c)=>r>=3&&r<28&&c%8>=2&&c%8<=4),m.polymer)
  const seam=(a,t,inset)=>{const p=outline(a,inset);return[p[0],.286+t*.04,p[1]]}
  part(root,'continuous-base-rim',shell(seam,256,4,()=>false),m.polymer)
  const shoulderHoles=[]
  for(const side of [-1,1])for(const z of [-.061,.061]){
    const x=side*.432,rr=.021,half=.026,hole=new THREE.Path()
    hole.moveTo(x-half,z-rr);hole.lineTo(x+half,z-rr);hole.absarc(x+half,z,rr,-Math.PI/2,Math.PI/2,false)
    hole.lineTo(x-half,z+rr);hole.absarc(x-half,z,rr,Math.PI/2,Math.PI*1.5,false);hole.closePath();shoulderHoles.push(hole)
  }
  part(root,'rim-shoulder',deck(a=>outline(a),.326,.009,shoulderHoles),m.polymer)
  part(root,'closed-intake-floor',deck(a=>{const p=bowlPoint(a,0);return[p[0],p[2]]},.013,.013),m.polymer)
  // Fit the photographed hose adapter into the drawing-based outlet.
  const outlet=new THREE.Path();outlet.absarc(0,-.205,.069,0,Math.PI*2,true)
  part(root,'flat-rounded-top',deck(a=>topOutline(a),HEIGHT,.014,[outlet]),m.teal)
  const port=new THREE.Group();port.position.set(0,HEIGHT-.054,.205);root.add(port)
  ring(port,'outlet-bore',.070,.055,.054,0,m.teal)
  part(port,'dark-outlet-depth',new THREE.CircleGeometry(.055,48),m.black,[0,.002,0]).rotation.x=-Math.PI/2
  const nozzle=new THREE.Group();nozzle.name='hose-adapter';nozzle.position.set(0,HEIGHT,.205);root.add(nozzle)
  ring(nozzle,'sealing-gasket',.088,.052,.009,-.003,m.black)
  ring(nozzle,'adapter-flange',.085,.052,.019,.006,m.polymer)
  ring(nozzle,'adapter-shoulder',.077,.052,.012,.025,m.polymer)
  // Four tapered hose-retaining barbs, with a real continuous bore and rounded top lip.
  const nozzleProfile=[[.052,.025],[.069,.025]]
  for(let i=0;i<4;i++){
    const y=.037+i*.061,r=.071-i*.002
    nozzleProfile.push([r,y],[r,y+.004],[r-.009,y+.058])
  }
  nozzleProfile.push([.058,.282],[.057,.287],[.051,.287],[.049,.283],[.049,.025],[.052,.025])
  part(nozzle,'hollow-four-barb-nozzle',profile(nozzleProfile,96),m.polymer)
  for(const a of [-.76,.76,Math.PI]){
    const [x,z]=outline(a),clip=new THREE.Group();clip.position.set(x,.303,z);clip.rotation.y=a;root.add(clip)
    part(clip,'clip-socket',box(.105,.035,.019,.005),m.black,[0,0,.004])
    part(clip,'teal-release-catch',box(.071,.018,.021,.004),m.teal,[0,0,.014])
  }
  // Follow the side pocket so the mark stays seated on the curved moulding.
  const positions=[],uv=[],indices=[],nx=40,ny=12
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    positions.push(...coverPoint(1.24+x/nx*.62,.45+y/ny*.19,-.002))
    uv.push(x/nx,y/ny)
    if(x<nx&&y<ny){const i=y*(nx+1)+x;indices.push(i,i+1,i+nx+1,i+1,i+nx+2,i+nx+1)}
  }
  const markGeometry=new THREE.BufferGeometry()
  markGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));markGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));markGeometry.setIndex(indices);markGeometry.computeVertexNormals()
  const markTexture=new THREE.TextureLoader().load(asset('xingz-logo-white.png'));markTexture.colorSpace=THREE.SRGBColorSpace;markTexture.anisotropy=8
  part(root,'moulded-side-wordmark',markGeometry,new THREE.MeshPhysicalMaterial({map:markTexture,color:'#006e60',roughness:.34,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}))
  for(const side of [-1,1]){
    const tab=mountingTab(side,m.polymer);tab.name='two-slot-mounting-tab';tab.castShadow=tab.receiveShadow=true;root.add(tab)
  }
  part(root,'internal-pump-envelope',new THREE.CylinderGeometry(.22,.25,.64,64),m.black,[0,.37,-.05])
  // Present the rounded intake and one side pocket together in the standard viewer.
  root.rotation.y=-.42
  return root
}
