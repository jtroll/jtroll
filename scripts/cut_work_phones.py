"""Split the flat Work phone shots into a phone-free plate + cut-out phone.

For each assets/work_<name>.webp this writes:
  work_<name>_bg.webp     the background with the phone painted out (flat paper)
  work_<name>_phone.webp  the phone alone (alpha), cropped to its bounds
and prints each phone's box ([left, top, width, height] as % of the frame)
for the `phone.box` field in index.html's projects list.

Works because the phones have near-black bezels on light paper: the largest
dark component is the bezel, closed along the frame edge it bleeds off, then
hole-filled; side buttons are the non-paper pixels touching that body.

  pip install opencv-python-headless scipy pillow
  python3 scripts/cut_work_phones.py
"""
import cv2, numpy as np, json, os
from scipy import ndimage as ndi
from PIL import Image
A=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets') + os.sep
out={}
for name in ['campus','neighborhoods','events','communityintegrity','coreexperiences']:
    img=cv2.imread(A+f'work_{name}.webp'); H,W=img.shape[:2]
    g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    lab,n=ndi.label(g<70); k=np.argmax(ndi.sum(g<70,lab,range(1,n+1)))+1
    bez=lab==k; m=bez.copy()
    for row in (0,H-1):
        c=np.where(bez[row])[0]
        if len(c): m[row,c.min():c.max()+1]=True
    m=ndi.binary_fill_holes(m)
    # side buttons & antialiased rim: non-paper pixels touching the body
    paper=np.median(img[5:60,5:60].reshape(-1,3),axis=0)
    diff=np.abs(img.astype(int)-paper).sum(2)
    near=ndi.binary_dilation(m,iterations=26)
    notpaper=(diff>22)&near
    lab2,_=ndi.label(notpaper|m)
    keep=np.unique(lab2[m]); keep=keep[keep>0]
    m=np.isin(lab2,keep)
    m=ndi.binary_fill_holes(m)
    # soft alpha: 1px feather
    a=cv2.GaussianBlur((m*255).astype(np.uint8),(3,3),0)
    rgba=np.dstack([img,a])
    # plate: flat paper where phone (+margin) was, feathered
    ring=ndi.binary_dilation(m,iterations=40)&~ndi.binary_dilation(m,iterations=20)&(diff<30)
    paper=np.median(img[ring],axis=0)
    hole=cv2.GaussianBlur(ndi.binary_dilation(m,iterations=10).astype(np.float32),(0,0),3)[...,None]
    plate=(img*(1-hole)+paper*hole).astype(np.uint8)
    Image.fromarray(cv2.cvtColor(plate,cv2.COLOR_BGR2RGB)).save(A+f'work_{name}_bg.webp',quality=86,method=6)
    ys,xs=np.where(a>0); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    Image.fromarray(cv2.cvtColor(rgba[y0:y1,x0:x1],cv2.COLOR_BGRA2RGBA)).save(A+f'work_{name}_phone.webp',quality=90,method=6)
    out[name]=[round(x0/W*100,3),round(y0/H*100,3),round((x1-x0)/W*100,3),round((y1-y0)/H*100,3)]
    # check recomposite == original
    al=a[...,None]/255.; rec=img*al+plate*(1-al)
    print(name,'max recomposite err',np.abs(rec-img).max().round(1),'paper',paper)
print(json.dumps(out))
