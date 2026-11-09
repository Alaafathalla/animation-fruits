import * as THREE from 'three';
import { splitGeometry } from './geometryCut.js';

export function createSlicer(canvas,camera,scene,physics,knife,onScore) {
  const raycaster=new THREE.Raycaster();
  const mouse=new THREE.Vector2();
  const juice=[];
  const flashes=[];
  const strokes=[];
  const svg=document.getElementById('slice-svg');
  let active=false, slicing=false, lastPoint=null, strokeTime=0, juiceEnabled=true;
  const consumed=new WeakSet();
  const tmp=new THREE.Vector3();
  const cameraRight=new THREE.Vector3(),cameraUp=new THREE.Vector3();
  const cutNormal=new THREE.Vector3();
  let lastPointer=null;
  const effectMat = color => new THREE.MeshStandardMaterial({color,roughness:0.55,metalness:0.02,side:THREE.DoubleSide});
  const spriteGeo=new THREE.SphereGeometry(1,7,6);

  function ndc(x,y) {
    const rect=canvas.getBoundingClientRect();
    mouse.set(((x-rect.left)/rect.width)*2-1,-((y-rect.top)/rect.height)*2+1);
    return mouse;
  }
  function screenPoint(position) {
    const v=position.clone().project(camera),r=canvas.getBoundingClientRect();
    return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2,z:v.z};
  }
  function spawnJuice(pos,color,count=32) {
    if(!juiceEnabled) return;
    for(let i=0;i<count;i++) {
      const radius=0.018+Math.random()*0.038;
      const mesh=new THREE.Mesh(spriteGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,depthWrite:false}));
      mesh.scale.setScalar(radius);mesh.position.copy(pos);
      const vel=new THREE.Vector3((Math.random()-.5)*8,Math.random()*6-0.8,(Math.random()-.5)*6);
      const life=.4+Math.random()*.7;
      scene.add(mesh);juice.push({mesh,vel,life,maxLife:life});
    }
  }
  function sliceFruit(body,worldNormal,velocity) {
    if(consumed.has(body) || body.isHalf || !body.fruitData?.outer) return false;
    consumed.add(body);
    const fruit=body.fruitData;
    const position=body.group.position.clone();
    const quaternion=body.group.quaternion.clone();
    const localNormal=worldNormal.clone().applyQuaternion(quaternion.clone().invert()).normalize();
    const source=fruit.outer.geometry;
    const split=splitGeometry(source,localNormal);
    if(!split.outline.length || split.halves.some(g=>g.getAttribute('position').count<3)) return false;
    const oldMat=fruit.outer.material;
    const insideColors={watermelon:0xff394c,orange:0xffae35,apple:0xffeed0,lemon:0xfff4a0,strawberry:0xfa667a,grape:0xc58bf2};
    const rindColors={watermelon:0xd7e7a2,orange:0xffe7b3,apple:0xffe7b0,lemon:0xfff9c9,strawberry:0xffd3ce,grape:0xe6cdf5};
    const inside=effectMat(insideColors[fruit.type] ?? fruit.juiceColor);
    const rind=effectMat(rindColors[fruit.type] ?? 0xffffff);
    const sep=worldNormal.clone().multiplyScalar(1.5);
    for(let side=0;side<2;side++) {
      const sign=side===0?1:-1;
      const group=new THREE.Group();
      const outer=new THREE.Mesh(split.halves[side],oldMat.clone());
      outer.castShadow=true;outer.receiveShadow=true;outer.material.side=THREE.DoubleSide;
      group.add(outer);
      const face=new THREE.Mesh(split.cap,inside);
      face.material.side=THREE.DoubleSide;group.add(face);
      const edge=new THREE.Mesh(split.rind,rind);group.add(edge);
      // Procedural 3D pips / radial segments, always lying in the cut surface.
      const r=fruit.radius;
      if(fruit.type==='watermelon' || fruit.type==='strawberry') {
        const seedMaterial=effectMat(fruit.type==='watermelon'?0x23121b:0xfff3a0);
        for(let i=0;i<8;i++){
          const a=i*Math.PI*2/8+0.13;
          const loc=split.center.clone().addScaledVector(split.axisU,Math.cos(a)*r*.49).addScaledVector(split.axisV,Math.sin(a)*r*.49).addScaledVector(localNormal,sign*.009);
          const seed=new THREE.Mesh(new THREE.SphereGeometry(r*.055,8,7),seedMaterial);
          seed.position.copy(loc);seed.scale.set(.6,1.35,.36);seed.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),localNormal);group.add(seed);
        }
      } else if(fruit.type==='orange'||fruit.type==='lemon') {
        const segMaterial=effectMat(0xfff8d8);
        for(let i=0;i<9;i++) {
          const a=i*Math.PI*2/9;
          const radial=split.axisU.clone().multiplyScalar(Math.cos(a)).addScaledVector(split.axisV,Math.sin(a));
          const line=new THREE.Mesh(new THREE.CylinderGeometry(.007,.016,r*.76,5),segMaterial);
          line.position.copy(split.center).addScaledVector(radial,r*.4).addScaledVector(localNormal,sign*.014);
          line.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),radial);group.add(line);
        }
      }
      group.position.copy(position).addScaledVector(worldNormal,sign*.035);
      group.quaternion.copy(quaternion);scene.add(group);
      const kick=body.velocity.clone().addScaledVector(sep,sign*(2.4+Math.min(velocity*.10,1.8)));
      kick.y+=.7;
      physics.add({group,velocity:kick,angularVel:new THREE.Vector3((Math.random()-.5)*5,(Math.random()-.5)*6,(Math.random()-.5)*5),radius:fruit.radius*.73,bounce:body.bounce*.65,sleeping:false,isHalf:true,age:0,fruitData:null});
    }
    scene.remove(body.group);physics.remove(body);
    spawnJuice(position,fruit.juiceColor,38);
    const light=new THREE.PointLight(fruit.juiceColor,13,5);
    light.position.copy(position);scene.add(light);flashes.push({light,life:.22});
    onScore?.(position);
    return true;
  }
  function segmentDistance(p,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y;
    const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
  }
  function cutSegment(a,b) {
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<7)return;
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld,0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld,1);
    // Plane normal is perpendicular to stroke in the screen plane, transformed into 3D.
    cutNormal.copy(cameraRight).multiplyScalar(-(b.y-a.y)/length).addScaledVector(cameraUp,-(b.x-a.x)/length).normalize();
    // This tests the swept knife edge, not just its final position.
    for(const body of [...physics.getBodies()]) {
      if(body.isHalf || !body.fruitData || consumed.has(body))continue;
      const center=screenPoint(body.group.position);
      if(center.z < -1||center.z>1)continue;
      const offset=body.group.position.clone().addScaledVector(cameraRight,body.radius);
      const radiusPx=Math.hypot(screenPoint(offset).x-center.x,screenPoint(offset).y-center.y);
      if(segmentDistance(center,a,b)<=Math.max(12,radiusPx*.88)) {
        sliceFruit(body,cutNormal,length);
      }
    }
  }
  function drawStroke(a,b) {
    if(!svg)return;
    const ns='http://www.w3.org/2000/svg';
    const line=document.createElementNS(ns,'line');
    line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);
    line.setAttribute('stroke','#ffffff');line.setAttribute('stroke-width','3.5');line.setAttribute('stroke-linecap','round');
    line.setAttribute('filter','drop-shadow(0 0 8px #ffb470)');
    svg.appendChild(line);strokes.push({el:line,life:.22});
  }
  function onPointerDown(e){if(!active)return;slicing=true;lastPoint={x:e.clientX,y:e.clientY};lastPointer=lastPoint;canvas.setPointerCapture?.(e.pointerId);}
  function onPointerMove(e){
    const next={x:e.clientX,y:e.clientY};lastPointer=next;
    if(active&&slicing&&lastPoint){cutSegment(lastPoint,next);drawStroke(lastPoint,next);}
    lastPoint=next;
  }
  function onPointerUp(e){slicing=false;lastPoint=null;if(e&&canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  function setActive(value){active=value;knife.setVisible(value);if(!value){slicing=false;lastPoint=null;}}
  function setJuiceEnabled(value){juiceEnabled=value;}
  function update(dt){
    if(active&&lastPointer){
      ndc(lastPointer.x,lastPointer.y);raycaster.setFromCamera(mouse,camera);
      // Project onto a plane facing the camera at the fruits' depth (z = knife.depth)
      const depth = knife._cfg ? knife._cfg.depth : 0.5;
      const planeNormal = new THREE.Vector3(0,0,1);
      const plane=new THREE.Plane(planeNormal, -depth);
      const world=raycaster.ray.intersectPlane(plane,tmp);
      if(world)knife.update(world,dt);
    }
    for(let i=juice.length-1;i>=0;i--){const p=juice[i];p.life-=dt;p.vel.y-=11*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.material.opacity=Math.max(0,p.life/p.maxLife);if(p.life<=0){scene.remove(p.mesh);p.mesh.material.dispose();juice.splice(i,1);}}
    for(let i=flashes.length-1;i>=0;i--){const p=flashes[i];p.life-=dt;p.light.intensity=Math.max(0,p.life/.22)*13;if(p.life<=0){scene.remove(p.light);flashes.splice(i,1);}}
    for(let i=strokes.length-1;i>=0;i--){const s=strokes[i];s.life-=dt;s.el.setAttribute('opacity',Math.max(0,s.life/.22));if(s.life<=0){s.el.remove();strokes.splice(i,1);}}
  }
  return {onPointerDown,onPointerMove,onPointerUp,update,setActive,setJuiceEnabled,spawnJuice};
}
