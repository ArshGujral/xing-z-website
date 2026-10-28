import * as THREE from 'three'
import { finishes, part, profile, box, ring } from './product-geometry.js'
import { asset } from '../content/site.js'

const signedPower = (v, power) => Math.sign(v) * Math.abs(v) ** power
const coverPoint = (angle, t, inset = 0) => {
  const round = t < .8 ? t * .18 : .144 + .085 * Math.sin((t - .8) / .2 * Math.PI / 2)
  const x = .025 * t + (.535 * (1 - round) - inset) * signedPower(Math.sin(angle), .77)
  let z = (.438 * (1 - round * .7) - inset) * signedPower(Math.cos(angle), .77)
  // The front-right panel is moulded inward into the common shell, not attached as a box.
  if (Math.cos(angle) > 0 && x > 0) z -= .17 * (1 - t ** 5) * Math.sin(Math.min(1, x / .46) * Math.PI) ** 1.5
  return [x, .29 + .39 * t, z]
}
const bowlPoint = (angle, t, inset = 0) => {
  const swell = Math.sin(t * Math.PI / 2)
  return [(.39 + .145 * swell - inset) * signedPower(Math.sin(angle), .85), .018 + t * .245, (.31 + .125 * swell - inset) * signedPower(Math.cos(angle), .85)]
}

// A two-sided shell with sidewalls at each opening, so vents hold their depth at oblique views.
function shell(point, angularSteps, rows, gap) {
  const positions = [], uv = [], indices = []
  const index = (layer, row, column) => layer * (rows + 1) * (angularSteps + 1) + row * (angularSteps + 1) + column
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) for (let column = 0; column <= angularSteps; column++) {
    positions.push(...point(-Math.PI + column / angularSteps * Math.PI * 2, row / rows, layer * .012))
    uv.push(column / angularSteps, row / rows)
  }
  const quad = (a,b,c,d) => indices.push(a,d,b,b,d,c)
  const solid = (r,c) => r >= 0 && r < rows && !gap(r, (c + angularSteps) % angularSteps)
  for (let r=0;r<rows;r++) for(let c=0;c<angularSteps;c++) {
    if(!solid(r,c))continue
    const a=index(0,r,c),b=index(0,r+1,c),cc=index(0,r+1,c+1),d=index(0,r,c+1)
    const aa=index(1,r,c),bb=index(1,r+1,c),ccc=index(1,r+1,c+1),dd=index(1,r,c+1)
    quad(a,b,cc,d);quad(dd,ccc,bb,aa)
    if(!solid(r,c-1))quad(aa,bb,b,a)
    if(!solid(r,c+1))quad(d,cc,ccc,dd)
    if(!solid(r-1,c))quad(aa,a,d,dd)
    if(!solid(r+1,c))quad(b,bb,ccc,cc)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals()
  return geometry
}

export function createModel() {
  const root = new THREE.Group(); root.name='submersible-pump'
  const m=finishes()
  const upper=shell(coverPoint,192,32,(r,c)=>r>=5&&r<=24&&c>8&&c<101&&c%4<2)
  part(root,'continuous-moulded-cover',upper,m.teal)
  part(root,'vented-intake-bowl',shell(bowlPoint,240,24,(r,c)=>r>=3&&r<=20&&c%5<2),m.polymer)
  // Dark inner pump body sits behind the openings; no white background leaks through the far side.
  part(root,'inner-pump-body',new THREE.CylinderGeometry(.27,.28,.54,64),m.black,[0,.30,0]).scale.z=.8
  part(root,'intake-interior',new THREE.CylinderGeometry(.36,.30,.21,64),m.black,[0,.13,0]).scale.z=.8
  const beltPoint=(a,t,inset)=>[(.537-inset)*signedPower(Math.sin(a),.85),.257+t*.042,(.438-inset)*signedPower(Math.cos(a),.85)]
  part(root,'moulded-base-seam',shell(beltPoint,128,3,()=>false),m.polymer)
  const topShape=new THREE.Shape()
  for(let i=0;i<=192;i++){const p=coverPoint(-Math.PI+i/192*Math.PI*2,1);i?topShape.lineTo(p[0],p[2]):topShape.moveTo(p[0],p[2])}
  topShape.closePath()
  const hole=new THREE.Path();hole.absarc(-.22,0,.098,0,Math.PI*2,true);topShape.holes.push(hole)
  const topGeometry=new THREE.ExtrudeGeometry(topShape,{depth:.015,bevelEnabled:false,curveSegments:64,steps:1});topGeometry.rotateX(Math.PI/2)
  part(root,'rounded-top-deck',topGeometry,m.teal,[0,.68,0])
  const nozzle=new THREE.Group();nozzle.position.set(-.22,.655,0);root.add(nozzle)
  ring(nozzle,'outlet-recess',.098,.065,.015,0,m.black)
  ring(nozzle,'outlet-seat',.087,.05,.022,.015,m.polymer)
  part(nozzle,'hollow-barbed-outlet',profile([[.05,.02],[.072,.02],[.072,.055],[.083,.06],[.070,.105],[.081,.108],[.068,.153],[.079,.156],[.066,.20],[.076,.204],[.063,.245],[.048,.245],[.048,.02],[.05,.02]],96),m.polymer)
  for(const a of [-1.3,-.35,2.8]){
    const p=beltPoint(a,.5,0),clip=part(root,'snap-clip',box(.072,.023,.018,.005),m.teal,p);clip.rotation.y=a
  }
  // The mark follows the recessed front surface rather than floating over a planar block.
  const positions=[],uv=[],indices=[],nx=30,ny=10
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    const a=.27+x/nx*.62,t=.39+y/ny*.22
    positions.push(...coverPoint(a,t,-.0015));uv.push(x/nx,y/ny)
    if(x<nx&&y<ny){const i=y*(nx+1)+x;indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2)}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals()
  const logo=new THREE.TextureLoader().load(asset('xingz-logo-white.png'));logo.colorSpace=THREE.SRGBColorSpace
  part(root,'moulded-wordmark',geometry,new THREE.MeshPhysicalMaterial({map:logo,color:'#087d71',roughness:.45,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}))
  return root
}
