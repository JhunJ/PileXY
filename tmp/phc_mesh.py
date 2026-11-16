"""Deterministic offline 3D mesh renderer for the PHC introduction film."""
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
BLUE=np.array([49,130,246]);CONCRETE=np.array([222,232,242]);PALE=np.array([237,244,250])
def box(cx,cy,cz,w,h,z,color=CONCRETE):
 v=np.array([[cx+a*w/2,cy+b*h/2,cz+c*z/2] for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
 f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]
 return [(v[inds],np.array(color),0) for inds in f]
def tube(x,y,z,r,inner,h,color=CONCRETE,n=80):
 a=np.arange(n+1)*2*np.pi/n;pts=np.stack([np.cos(a),np.sin(a)],axis=1)
 outerTop=np.stack([x+r*pts[:,0],np.full(n+1,y+h/2),z+r*pts[:,1]],axis=1)
 outerBot=outerTop.copy();outerBot[:,1]-=h
 innerTop=outerTop.copy();innerTop[:,0]=x+inner*pts[:,0];innerTop[:,2]=z+inner*pts[:,1]
 innerBot=innerTop.copy();innerBot[:,1]-=h
 faces=[]
 for i in range(n):
  j=i+1
  faces.append((np.array([outerBot[i],outerTop[i],outerTop[j],outerBot[j]]),np.array(color),0))
  faces.append((np.array([innerTop[i],innerBot[i],innerBot[j],innerTop[j]]),np.array(color)*.65,0))
  faces.append((np.array([outerTop[i],innerTop[i],innerTop[j],outerTop[j]]),np.array(color)*1.025,0))
  faces.append((np.array([outerBot[j],innerBot[j],innerBot[i],outerBot[i]]),np.array(color)*.88,0))
 return faces
def single():
 f=tube(0,0,0,.78,.5,5.5)
 f+=tube(0,2.45,0,.792,.497,.26,BLUE)
 f+=tube(0,-2.45,0,.792,.497,.26,BLUE)
 return f
def assembly(q=1):
 faces=[]
 for x in [-1.45,1.45]:
  for z in [-1.45,1.45]:
   pile=tube(x,-2.45,z,.43,.25,4.5)
   faces += [face for i,face in enumerate(pile) if i%4!=2]
 faces+=box(0,.32+1.8*(1-q),0,4.4,.65,4.4,PALE)
 for x in [-1.55,1.55]:
  for z in [-1.55,1.55]:faces+=box(x,2.48+2.7*(1-q),z,.3,3.65,.3,[193,209,229])
 faces+=box(0,4.45+2.7*(1-q),0,4.5,.23,4.5,[211,225,242])
 for y in [.05,4.35]:
  for z in [-1.75,1.75]:faces+=box(0,y+2.7*(1-q) if y>1 else y,z,4,.28,.23,BLUE if y>1 else CONCRETE)
 return faces
def export_obj(faces,path):
 lines=['# PHC conceptual model. Dimensions are illustrative.'];j=1
 for v,c,_ in faces:
  lines+=['v '+' '.join(f'{a:.6f}' for a in p) for p in v]
  lines.append('f '+' '.join(str(i) for i in range(j,j+len(v))));j+=len(v)
 Path(path).write_text('\n'.join(lines),encoding='utf-8')
def render(faces,angle=.55,elevation=.33,scale=100,center=(1250,580),size=(1920,1080),ground=True):
 # Orthographic camera with 3D normals, directional lighting, depth sorting.
 ca,sa=np.cos(angle),np.sin(angle);ce,se=np.cos(elevation),np.sin(elevation)
 right=np.array([ca,0,-sa]);up=np.array([-sa*se,ce,-ca*se]);eye=np.array([sa*ce,se,ca*ce])
 def project(v):return np.stack([center[0]+v@right*scale,center[1]-v@up*scale],axis=1)
 im=Image.new('RGBA',size,(0,0,0,0));shadow=Image.new('RGBA',size,(0,0,0,0));s=ImageDraw.Draw(shadow)
 if ground:
  s.ellipse((center[0]-3*scale,center[1]+3.5*scale,center[0]+3*scale,center[1]+4.4*scale),fill=(38,65,110,26));shadow=shadow.filter(ImageFilter.GaussianBlur(32));im.alpha_composite(shadow)
 d=ImageDraw.Draw(im);key=np.array([-.4,.8,-.7]);key/=np.linalg.norm(key)
 ordered=[]
 for v,c,_ in faces:
  n=np.cross(v[1]-v[0],v[2]-v[0]);length=np.linalg.norm(n)
  if length<1e-8:continue
  n/=length
  # Retain both-sided surfaces for the hollow cavity. z-sort resolves occlusion.
  ordered.append((float(v.mean(axis=0)@eye),v,c,n))
 for depth,v,c,n in sorted(ordered,key=lambda x:x[0]):
  p=project(v);light=.70+.30*max(0,float(n@key))+.10*max(0,float(n@np.array([.5,.3,.8])))
  color=tuple(np.clip(c*light,0,255).astype(int))+(255,)
  d.polygon([tuple(a) for a in p],fill=color)
 return im,project
