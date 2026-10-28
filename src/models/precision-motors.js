import * as THREE from 'three'
import { finishes, part, profile, box, ring, fastener, threadedShaft } from './product-geometry.js'
import { addWordmark } from './decals'
import { asset } from '../content/site.js'

const sizes = { 'high-speed': 1.08, '110': .86, kit: .72, capcan: 1.17, 'h-frame': 1.24, exhaust: 1.38 }

export function createMotor(family, options = {}) {
  const root = new THREE.Group(); root.name = family
  const m = finishes(), h = sizes[family], glossy = family === 'capcan', coat = glossy ? m.gloss : m.coat
  const body = part(root, 'formed-housing', profile([[0, 0], [.40, 0], [.46, .012], [.485, .038], [.495, .075], [.495, h - .025], [.487, h], [.46, h], [.46, .05], [0, .05]]), coat)
  const top = family === 'h-frame' ? m.alloy : coat
  // Recessed top plate and bearing well: genuine depth, including when viewed from above.
  part(root, 'recessed-end-cover', profile([[.13, h - .09], [.21, h - .09], [.245, h - .065], [.275, h - .012], [.29, h], [.479, h], [.494, h - .008], [.494, h - .026], [.285, h - .026], [.25, h - .085], [.21, h - .11], [.13, h - .11], [.13, h - .09]].reverse()), top)
  part(root, 'bearing-boss', profile([[.048, h - .09], [.13, h - .09], [.14, h - .065], [.125, h + .025], [.108, h + .04], [.048, h + .04], [.048, h - .09]]), top)
  ring(root, 'bearing-seat', .092, .045, .012, h + .04, m.steel)
  if (family === 'high-speed') ring(root, 'bearing-insulator', .076, .044, .035, h + .05, new THREE.MeshStandardMaterial({color:'#c7cdcb',roughness:.45}))
  const shaftBottom = h + .052, shaftLength = family === 'kit' ? .48 : .56
  threadedShaft(root, 'shaft', .047, shaftBottom, shaftLength, family === 'high-speed' ? m.steel : glossy ? m.green : m.shaft, glossy)
  if (family !== 'high-speed') {
    ring(root, 'machined-shaft-foot', .0475, .045, .045, shaftBottom, m.steel)
    ring(root, 'machined-tip', .044, .012, .003, shaftBottom + shaftLength, m.steel)
    part(root, 'tip-bore', new THREE.CircleGeometry(.012, 24), m.black, [0, shaftBottom + shaftLength + .0005, 0]).rotation.x = -Math.PI / 2
  }
  if (!glossy) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2
      fastener(root, 'cover-screw', [Math.sin(a)*.405,h+.002,Math.cos(a)*.405], [0,1,0], .036, family==='kit'?m.brass:m.steel,{screw:true})
    }
    if (['high-speed','110','kit'].includes(family)) for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      fastener(root,'bearing-fixing',[Math.sin(a)*.307,h+.002,Math.cos(a)*.307],[0,1,0],.018,family==='high-speed'?m.steel:m.brass,{screw:true})
    }
  }
  if (family === 'kit' || family === 'h-frame') {
    for (let i = 0; i < (family === 'kit' ? 4 : 8); i++) {
      const a = i * Math.PI * 2 / (family === 'kit' ? 4 : 8)
      if (family === 'kit') {
        part(root,'pressed-cover-rib',profile([[.29,h+.001],[.45,h+.001],[.45,h+.014],[.29,h+.014],[.29,h+.001]],24,a+.14,.9),top)
      } else {
        const rib=part(root,'cast-radial-rib',box(.28,.018,.014,.005),top,[Math.sin(a)*.29,h+.01,Math.cos(a)*.29]);rib.rotation.y=Math.PI/2+a
      }
    }
    if(family==='h-frame') ring(root,'cast-outer-bead',.45,.436,.012,h+.004,top)
  }
  const bracket = (parent, angle, y, width, height, doubleVertical, finish = m.cast) => {
    const group=new THREE.Group();group.name='formed-mounting-bracket';group.position.set(Math.sin(angle)*.505,y,Math.cos(angle)*.505);group.rotation.y=angle;parent.add(group)
    part(group,'bracket-web',box(width,height,.035,.008),finish,[0,0,.008])
    for(const side of [-1,1])part(group,'folded-bracket-edge',box(.027,height,.065,.009),finish,[side*(width/2-.014),0,.024])
    const positions=doubleVertical?[[0,-height*.25],[0,height*.25]]:[[-width*.25,0],[width*.25,0]]
    for(const [x,yy] of positions)fastener(group,'bracket-bolt',[x,yy,.043],[0,0,1],doubleVertical?.043:.037,family==='exhaust'?m.steel:m.brass)
    return group
  }
  if(['110','kit'].includes(family) && options.ring !== false) {
    const y=h*.39, height=family==='kit'?.15:.18
    const band=new THREE.Group();band.name='mounting-ring';root.add(band)
    part(band,'continuous-cast-band',profile([[.496,y],[.525,y],[.54,y+.012],[.54,y+height-.012],[.527,y+height],[.496,y+height],[.496,y]]),m.cast)
    ring(band,'upper-ring-shoulder',.516,.495,.015,y+height,m.cast)
    for(const angle of [-.92,.92,Math.PI-.92,Math.PI+.92]) {const lug=bracket(band,angle,y+height/2,.22,height*.94,false);lug.position.x*=1.065;lug.position.z*=1.065}
    part(band,'front-casting-notch',box(.012,.065,.008,.003),m.cast,[0,y+.033,.544])
  } else if(family==='high-speed' && options.ring !== false) {
    const y=h*.32
    part(root,'continuous-clamp-band',profile([[.495,y],[.506,y],[.51,y+.006],[.51,y+.245],[.503,y+.252],[.495,y+.252],[.495,y]]),m.coat)
    for(const a of [-.88,.88]) {const seam=part(root,'strap-overlap',box(.008,.247,.008,.002),m.coat,[Math.sin(a)*.514,y+.126,Math.cos(a)*.514]);seam.rotation.y=a}
  }
  if(['high-speed','110','kit'].includes(family)) for(let i=0;i<4;i++) {
    const a=Math.PI/4+i*Math.PI/2,stud=new THREE.Group();stud.position.set(Math.sin(a)*.37,-.13,Math.cos(a)*.37);root.add(stud)
    threadedShaft(stud,'mounting-stud',.022,0,.15,family==='high-speed'?m.steel:m.brass,true)
    fastener(stud,'stud-nut',[0,.105,0],[0,-1,0],.04,family==='high-speed'?m.steel:m.brass,{nut:true,length:.03})
  }
  if(glossy) {
    // An annular flange with actual fixing holes and through-bolts.
    const y=.55, shape=new THREE.Shape();shape.absarc(0,0,.66,0,Math.PI*2,false)
    const centre=new THREE.Path();centre.absarc(0,0,.495,0,Math.PI*2,true);shape.holes.push(centre)
    for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,hole=new THREE.Path();hole.absarc(Math.sin(a)*.594,Math.cos(a)*.594,.025,0,Math.PI*2,true);shape.holes.push(hole)}
    const flange=new THREE.ExtrudeGeometry(shape,{depth:.019,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2,steps:1,curveSegments:96});flange.rotateX(-Math.PI/2)
    part(root,'pierced-mounting-flange',flange,coat,[0,y,0])
    for(let i=0;i<4;i++) {const a=Math.PI/8+i*Math.PI/2,x=Math.sin(a)*.594,z=Math.cos(a)*.594
      fastener(root,'flange-bolt',[x,y+.022,z],[0,1,0],.049,m.brass,{length:.10})
      fastener(root,'flange-nut',[x,y-.018,z],[0,-1,0],.047,m.brass,{nut:true,length:.06})
      const stud=new THREE.Group();stud.position.set(x,y-.105,z);root.add(stud);threadedShaft(stud,'exposed-thread',.023,0,.09,m.brass,true)
    }
    for(const yy of [.49,.69,.715,h-.012])ring(root,'rolled-housing-bead',.502,.49,.012,yy,coat)
  }
  if(family==='h-frame'||family==='exhaust') {
    const y=family==='h-frame'?.82:.83
    for(const a of [-1.05,1.05])bracket(root,a,y,.22,.32,true)
    ring(root,'housing-joint',.499,.49,.022,family==='h-frame'?.46:.45,coat)
    if(family==='exhaust') {
      ring(root,'stator-belt',.503,.494,.33,.65,m.cast)
      for(let i=0;i<40;i++){const a=i*Math.PI/20;const fin=part(root,'cooling-rib',box(.024,.32,.035,.003),m.cast,[Math.sin(a)*.512,.815,Math.cos(a)*.512]);fin.rotation.y=a}
    }
  }
  if(!glossy)addWordmark(root,{url:asset('xingz-logo-white.png'),radius:.497,y:family==='exhaust'?1.19:family==='h-frame'?.91:h*.79,width:.42,color:0x242828})
  root.userData.family=family
  return root
}
