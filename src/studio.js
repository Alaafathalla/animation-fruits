import * as THREE from 'three';

export function createStudio(scene) {
  const root=new THREE.Group();scene.add(root);
  const matte=(color,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  // Distinct physical pedestal, concentric brushed-metal rim, and light wells.
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(4.7,4.95,.42,96),matte(0x181c2b,.35,.38));
  plinth.position.y=-3.39;plinth.receiveShadow=true;plinth.castShadow=true;root.add(plinth);
  const plinthTop=new THREE.Mesh(new THREE.CylinderGeometry(4.64,4.64,.035,96),matte(0x262d3d,.45,.31));
  plinthTop.position.y=-3.167;plinthTop.receiveShadow=true;root.add(plinthTop);
  for(const [r,t,c] of [[4.68,.042,0xffa65c],[4.25,.014,0x6ccfef],[3.3,.01,0x55647c]]) {
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,10,120),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:r===4.68?.72:.26}));
    mesh.rotation.x=Math.PI/2;mesh.position.y=-3.14;root.add(mesh);
  }
  // Curved orbit guides emphasize the 3D volume without blocking the fruits.
  const guideMaterial=new THREE.LineBasicMaterial({color:0x6f93ac,transparent:true,opacity:.12});
  for(let j=0;j<3;j++) {
    const points=[];
    for(let i=0;i<=180;i++){
      const a=(i/180)*Math.PI*2;
      points.push(new THREE.Vector3(Math.cos(a)*(4.1+j*.45),Math.sin(a)*(2.1+j*.55),-2.9-j*.3));
    }
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),guideMaterial);
    line.rotation.y=j*.38;root.add(line);
  }
  // Particle constellation behind the main stage.
  const positions=new Float32Array(240*3);
  for(let i=0;i<240;i++) {
    const a=Math.random()*Math.PI*2, radius=5+Math.random()*9;
    positions[i*3]=Math.cos(a)*radius;
    positions[i*3+1]=Math.random()*10-3.5;
    positions[i*3+2]=-3.5-Math.random()*9;
  }
  const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x91a7d1,size:.035,transparent:true,opacity:.55,sizeAttenuation:true}));root.add(stars);
  const sideA=new THREE.PointLight(0xff783e,16,13,2);sideA.position.set(-5,1,3);root.add(sideA);
  const sideB=new THREE.PointLight(0x4f9bff,15,13,2);sideB.position.set(5,-.5,-2);root.add(sideB);
  const update=time=>{stars.rotation.y=time*.008;sideA.intensity=14+Math.sin(time*.8)*2;sideB.intensity=13+Math.sin(time*.67+1)*2;};
  return {root,update};
}
