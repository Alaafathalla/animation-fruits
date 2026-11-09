import * as THREE from 'three';

// Split the actual triangles of a convex fruit mesh by a plane through its centre.
// The generated geometry is real geometry (not a visual clipping trick): the halves
// keep their silhouette and can rotate and collide independently after the cut.
export function splitGeometry(source, normal) {
  const geo = source.index ? source.toNonIndexed() : source;
  const positions = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const rings = [[], []];
  const outputs = [[], []];
  const eps = 0.00001;

  const vertex = i => ({ p: new THREE.Vector3().fromBufferAttribute(positions, i), uv: uv ? new THREE.Vector2().fromBufferAttribute(uv, i) : new THREE.Vector2() });
  const interpolate = (a,b,t) => ({ p: a.p.clone().lerp(b.p,t), uv: a.uv.clone().lerp(b.uv,t) });
  const crossPoints = [];
  for (let i=0; i<positions.count; i+=3) {
    const triangle = [vertex(i),vertex(i+1),vertex(i+2)];
    const distances = triangle.map(v => v.p.dot(normal));
    for (let k=0; k<3; k++) {
      const j=(k+1)%3;
      if (distances[k] * distances[j] < -eps*eps) {
        const t=distances[k] / (distances[k]-distances[j]);
        crossPoints.push(interpolate(triangle[k],triangle[j],t).p);
      } else if (Math.abs(distances[k]) < eps) crossPoints.push(triangle[k].p.clone());
    }
    for(let side=0;side<2;side++) {
      const sign=side===0 ? 1 : -1;
      const polygon=[];
      for(let k=0;k<3;k++) {
        const a=triangle[k], b=triangle[(k+1)%3];
        const da=distances[k]*sign, db=distances[(k+1)%3]*sign;
        if(da>=-eps) polygon.push(a);
        if((da>eps && db < -eps)||(da < -eps && db > eps)) polygon.push(interpolate(a,b,da/(da-db)));
      }
      for(let j=1;j<polygon.length-1;j++) {
        for(const v of [polygon[0],polygon[j],polygon[j+1]]) {
          outputs[side].push(v.p.x,v.p.y,v.p.z,v.uv.x,v.uv.y);
        }
      }
    }
  }
  const geometries=outputs.map(vals=>{
    const result=new THREE.BufferGeometry();
    const coords=[],uvs=[];
    for(let i=0;i<vals.length;i+=5) { coords.push(vals[i],vals[i+1],vals[i+2]); uvs.push(vals[i+3],vals[i+4]); }
    result.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    result.computeVertexNormals();
    return result;
  });
  // Determine the actual cut outline from triangle-plane intersections.
  const unique=new Map();
  for(const p of crossPoints) {
    const key=`${Math.round(p.x*1000)}:${Math.round(p.y*1000)}:${Math.round(p.z*1000)}`;
    if(!unique.has(key)) unique.set(key,p);
  }
  const points=[...unique.values()];
  const center=new THREE.Vector3();
  points.forEach(p=>center.add(p));
  if(points.length) center.divideScalar(points.length);
  const axisU=new THREE.Vector3(0,0,1);
  if(Math.abs(axisU.dot(normal))>0.95) axisU.set(0,1,0);
  axisU.addScaledVector(normal,-axisU.dot(normal)).normalize();
  const axisV=new THREE.Vector3().crossVectors(normal,axisU).normalize();
  points.sort((a,b)=>{
    const da=a.clone().sub(center),db=b.clone().sub(center);
    return Math.atan2(da.dot(axisV),da.dot(axisU))-Math.atan2(db.dot(axisV),db.dot(axisU));
  });
  // A convex hull avoids overlapping triangles caused by curved tessellation and near-duplicate points.
  const coords2D=points.map(p=>({p,x:p.clone().sub(center).dot(axisU),y:p.clone().sub(center).dot(axisV)}));
  coords2D.sort((a,b)=>a.x-b.x || a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const lower=[],upper=[];
  for(const p of coords2D){while(lower.length>1 && cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  for(let i=coords2D.length-1;i>=0;i--){const p=coords2D[i];while(upper.length>1 && cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
  const boundary=lower.slice(0,-1).concat(upper.slice(0,-1)).map(v=>v.p);
  // The cap lies on the exact same cut plane and includes a subtle rind ring.
  const cap=[];
  const trim=[];
  const capCenter=center.clone();
  const innerScale=0.94;
  const pushTri=(array,a,b,c)=>array.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
  if(boundary.length>=3) {
    for(let i=0;i<boundary.length;i++) {
      const a=boundary[i],b=boundary[(i+1)%boundary.length];
      pushTri(cap,capCenter,a.clone().lerp(capCenter,1-innerScale),b.clone().lerp(capCenter,1-innerScale));
      const ia=a.clone().lerp(capCenter,1-innerScale),ib=b.clone().lerp(capCenter,1-innerScale);
      pushTri(trim,a,b,ib);pushTri(trim,a,ib,ia);
    }
  }
  const surface=arr=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.computeVertexNormals();return g;};
  return { halves:geometries, cap:surface(cap), rind:surface(trim), center, normal:normal.clone(), axisU, axisV, outline:boundary };
}
