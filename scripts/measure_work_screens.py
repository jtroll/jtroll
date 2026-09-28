"""Measure where each Work phone's screen sits in its original shot.

Prints `place` for index.html: [centerX%, top%, width%, roll°] of the
screen's top edge in assets/work_<name>.webp, found by fitting the screen's
left, right and top edges inside the bezel. The 3D phone uses it to land
where the original put it. (The screens themselves are exported from Figma
as assets/work_<name>_screen.webp; this script doesn't touch them.)

  python3 scripts/measure_work_screens.py
"""
import cv2, numpy as np, os, json
from scipy import ndimage as ndi
A=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets') + os.sep
def fitline(pts):  # x = a*y + b  (for near-vertical) or y = a*x+b
    return np.polyfit(pts[:,0], pts[:,1], 1)
for name in ['campus','neighborhoods','events','communityintegrity','coreexperiences']:
    img=cv2.imread(A+f'work_{name}.webp'); H,W=img.shape[:2]
    g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    lab,n=ndi.label(g<70); k=np.argmax(ndi.sum(g<70,lab,range(1,n+1)))+1
    bez=lab==k
    body=bez.copy()
    c=np.where(bez[H-1])[0]; body[H-1,c.min():c.max()+1]=True
    body=ndi.binary_fill_holes(body)
    inner=body&~ndi.binary_dilation(bez,iterations=2)
    l2,_=ndi.label(inner); cy,cx=np.array(ndi.center_of_mass(body)).astype(int)
    # biggest component of inner
    sz=ndi.sum(inner,l2,range(1,l2.max()+1)); scr=l2==(np.argmax(sz)+1)
    scr=ndi.binary_fill_holes(scr)
    ys,xs=np.where(scr); y0,y1=ys.min(),ys.max()
    rows=np.arange(y0+int((y1-y0)*.15), y1-int((y1-y0)*.05))
    L=np.array([[y, np.where(scr[y])[0].min()] for y in rows if scr[y].any()])
    R=np.array([[y, np.where(scr[y])[0].max()] for y in rows if scr[y].any()])
    la=np.polyfit(L[:,0],L[:,1],1); ra=np.polyfit(R[:,0],R[:,1],1)   # x = f(y)
    x_mid0=np.polyval(la,y0+50); x_mid1=np.polyval(ra,y0+50); w=x_mid1-x_mid0
    cols=np.arange(int(x_mid0+w*.2), int(x_mid1-w*.2))
    T=np.array([[x, np.where(scr[:,x])[0].min()] for x in cols])
    # drop dynamic-island dip: use lower percentile robust fit
    ta=np.polyfit(T[:,0],T[:,1],1)
    res=T[:,1]-np.polyval(ta,T[:,0]); T=T[np.abs(res)<3]; ta=np.polyfit(T[:,0],T[:,1],1)
    # intersections: top line y = ta0*x+ta1 ; left x = la0*y+la1
    def inter(l):
        # solve y = ta0*(l0*y+l1)+ta1
        y=(ta[0]*l[1]+ta[1])/(1-ta[0]*l[0]); return np.array([np.polyval(l,y),y])
    tl,tr=inter(la),inter(ra)
    yb=H-1
    bl=np.array([np.polyval(la,yb),yb]); br=np.array([np.polyval(ra,yb),yb])
    topw=np.linalg.norm(tr-tl); sideh=(np.linalg.norm(bl-tl)+np.linalg.norm(br-tr))/2
    OW=900; OH=int(round(OW*sideh/topw))
    M=cv2.getPerspectiveTransform(np.float32([tl,tr,br,bl]),np.float32([[0,0],[OW,0],[OW,OH],[0,OH]]))
    out=cv2.warpPerspective(img,M,(OW,OH),flags=cv2.INTER_CUBIC)
    # full screen canvas at 19.5:9 ; pad bottom by replicating last rows
    FH=int(OW*19.5/9)
    fill=np.median(out[max(0,OH-40):OH].reshape(-1,3),axis=0)
    full=np.empty((FH,OW,3),np.uint8); full[:]=fill; full[:min(OH,FH)]=out[:FH]
    print(name, 'place:',json.dumps([round((tl[0]+tr[0])/2/W*100,2), round((tl[1]+tr[1])/2/H*100,2), round(topw/W*100,2), round(-np.degrees(np.arctan2(tr[1]-tl[1],tr[0]-tl[0])),2)]))
