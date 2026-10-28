import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { addWordmark } from './decals'
import { asset } from '../content/site.js'

// Reconstruct all detail levels from the saved sculpt specification.
export function createCatalogueModel(spec, family) {
  const root = new THREE.Group(), nodes = {}, meshes = {}
  const materials = Object.fromEntries(spec.materials.map(m => [m.id,new THREE.MeshPhysicalMaterial({color:m.color,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat,clearcoatRoughness:.25,envMapIntensity:.4})]))
  const grain = new Uint8Array(128*128*4)
  let seed=19
  for(let i=0;i<grain.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=100+(seed%56);grain[i]=grain[i+1]=grain[i+2]=v;grain[i+3]=255}
  const bump=new THREE.DataTexture(grain,128,128);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(5,5);bump.needsUpdate=true
  for(const [id,m] of Object.entries(materials))if(/coat|aluminium|plastic/.test(id)){m.bumpMap=bump;m.bumpScale=id==='cast-aluminium'?.003:.0008}
  const lathe = (points, segments=96, start=0, length=Math.PI*2) => new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),segments,start,length)
  const primitive=(kind,hex=false)=>kind==='cylinder'?new THREE.CylinderGeometry(.5,.5,1,hex?6:48):kind==='sphere'?new THREE.SphereGeometry(.5,24,16):new RoundedBoxGeometry(1,1,1,3,.04)
  for(const c of spec.components) {
    const node=new THREE.Group(); node.name=c.id; node.position.fromArray(c.transform.position); node.rotation.fromArray(c.transform.rotation); nodes[c.id]=node
    let geometry
    if(c.primitive==='lathe') geometry=lathe(c.geometry.latheProfile.points,c.geometry.latheProfile.segments)
    else if(c.primitive==='extrude') {
      const shape=new THREE.Shape(), points=c.geometry.profile2D.points
      points.forEach((p,i)=>{
        const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length]
        const incoming=[p[0]+(prev[0]-p[0])*.12,p[1]+(prev[1]-p[1])*.12]
        const outgoing=[p[0]+(next[0]-p[0])*.12,p[1]+(next[1]-p[1])*.12]
        if(i===0)shape.moveTo(...incoming);else shape.lineTo(...incoming)
        shape.quadraticCurveTo(p[0],p[1],...outgoing)
      });shape.closePath()
      geometry=new THREE.ExtrudeGeometry(shape,{depth:c.geometry.profile2D.depth,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:3,steps:1})
    } else geometry=primitive(c.primitive,c.id.includes('bolt'))
    geometry.scale(...c.transform.scale)
    // Shaft positions in the sculpt spec name the bearing seat, not the cylinder centre.
    if(c.id==='shaft') geometry.translate(0,c.transform.scale[1]/2,0)
    const mesh=new THREE.Mesh(geometry,materials[c.material]);mesh.name=c.id;mesh.castShadow=mesh.receiveShadow=true;node.add(mesh);meshes[c.id]=mesh
  }
  for(const c of spec.components) (nodes[c.parent]??root).add(nodes[c.id])
  for(const r of spec.repetitions) {
    if(family==='pump') continue
    const cluster=new THREE.InstancedMesh(primitive(r.primitive,/nuts|bolts/.test(r.id)),materials[r.material],r.count)
    cluster.name=r.id; const dummy=new THREE.Object3D()
    for(let i=0;i<r.count;i++) {
      const angle=THREE.MathUtils.degToRad(r.placement.startAngleDeg+i*360/r.count),radius=r.placement.radius/2
      dummy.position.set(Math.cos(angle)*radius,0,-Math.sin(angle)*radius);dummy.rotation.set(0,angle,0);dummy.scale.fromArray(r.instanceScale);dummy.updateMatrix();cluster.setMatrixAt(i,dummy.matrix)
    }
    cluster.castShadow=cluster.receiveShadow=true;(nodes[r.parent]??root).add(cluster)
  }
  if(family==='pump') {
    materials['teal-plastic'].color.set('#009d87')
    materials['teal-plastic'].roughness=.38
    // Build real gaps between moulded ribs rather than painting black slots on a solid shell.
    const slottedShell=(id,low,high,count,openFraction)=>{
      const component=spec.components.find(c=>c.id===id),profile=component.geometry.latheProfile.points,outer=profile.filter(p=>p[0]>.2)
      const radiusAt=y=>{for(let i=1;i<outer.length;i++) if(y<=outer[i][1]) {const a=outer[i-1],b=outer[i];return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1])}return outer[outer.length-1][0]}
      meshes[id].visible=false
      const attach=g=>{const m=new THREE.Mesh(g,materials[component.material]);m.castShadow=m.receiveShadow=true;nodes[id].add(m)}
      attach(lathe([...profile.filter(p=>p[1]<low),[radiusAt(low),low],[radiusAt(low)-.012,low]]))
      attach(lathe([[radiusAt(high)-.012,high],[radiusAt(high),high],...profile.filter(p=>p[1]>high)]))
      const rib=[[radiusAt(low),low],...outer.filter(p=>p[1]>low&&p[1]<high),[radiusAt(high),high],[radiusAt(high)-.012,high],[radiusAt(low)-.012,low],[radiusAt(low),low]]
      for(let i=0;i<count;i++)attach(lathe(rib,5,i*Math.PI*2/count,Math.PI*2/count*(1-openFraction)))
      const inside=new THREE.Mesh(new THREE.CylinderGeometry(radiusAt(high)*.82,radiusAt(low)*.82,high-low,48),materials['slot-shadow']);inside.position.y=(low+high)/2;nodes[id].add(inside)
    }
    slottedShell('impeller-dome',-.10,.105,32,.56);slottedShell('base-bowl',-.035,.045,48,.53)
    nodes['base-bowl'].scale.y=1.6
    nodes['base-bowl'].position.y=.0486
    meshes['xiing-panel'].visible=false
    const texture=new THREE.TextureLoader().load(asset('xingz-logo-white.png'));texture.colorSpace=THREE.SRGBColorSpace
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(.22,.09),new THREE.MeshPhysicalMaterial({map:texture,color:0x086b61,transparent:true,depthWrite:false,roughness:.48,polygonOffset:true,polygonOffsetFactor:-2}))
    mark.position.set(.19,.41,.247);mark.rotation.x=-.258;mark.name='moulded-wordmark';root.add(mark)
  } else {
    const [radius,y,width]={'capcan':[.505,.34,.36],'h-frame':[.502,.85,.36],exhaust:[.505,.59,.38]}[family]
    addWordmark(root,{url:asset('xingz-logo-white.png'),radius,y,width,color:0x333333})
  }
  root.userData.sculptRuntime={nodes,meshes};return root
}


