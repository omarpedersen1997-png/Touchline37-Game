from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader,PdfWriter
root=Path.cwd();path=root/'dev/artifacts/Touchline37-Opdateringsrapport-TEST59.pdf';base=PdfReader(BytesIO(path.read_bytes()));buffer=BytesIO();pdf=canvas.Canvas(buffer,pagesize=(842,595));e=root/'test-evidence/cohesion-TEST59'
pages=[('Samme figurer og sparkepose','before-figures-pass.png','after-figures-pass.png','Ens kamera og belysning. 29.642 trekanter / 48 draw calls i begge billeder.'),('Samme kampøjeblik – tick 550','before-915x412.png','after-915x412.png','Ens R3-state, boldposition, kamera og 915 × 412 px. Ingen retouchering.')]
for i,(title,before,after,note) in enumerate(pages):
 pdf.setFillColor(HexColor('#102330'));pdf.rect(0,0,842,595,fill=1,stroke=0);pdf.setFillColor(HexColor('#B7EF63'));pdf.setFont('Helvetica-Bold',20);pdf.drawString(32,556,'TEST59 · '+title);pdf.setFillColor(HexColor('#eef5ec'));pdf.setFont('Helvetica',10);pdf.drawString(32,530,note)
 for x,name,label in [(32,before,'FØR · TEST58'),(437,after,'EFTER · TEST59')]:
  img=ImageReader(str(e/name));w,h=img.getSize();height=373*h/w;pdf.setFillColor(HexColor('#B7EF63'));pdf.setFont('Helvetica-Bold',12);pdf.drawString(x,488,label);pdf.drawImage(img,x,480-height,width=373,height=height);pdf.setFillColor(HexColor('#c2d2d8'));pdf.setFont('Helvetica',9);pdf.drawString(x,461-height,name)
 pdf.setFillColor(HexColor('#c2d2d8'));pdf.setFont('Helvetica',10);pdf.drawString(32,90,'Billedforskellen er et anatomisk og animationsmæssigt løft, ikke nye modeller eller en ny lysmotor.');pdf.drawString(32,71,'Disse Chromium-billeder dokumenterer ikke fysisk Android-FPS.');pdf.drawRightString(810,30,f'Billedbilag {i+1}/2');pdf.showPage()
pdf.save();writer=PdfWriter();writer.append(base);writer.append(PdfReader(BytesIO(buffer.getvalue())));out=BytesIO();writer.write(out);path.write_bytes(out.getvalue());assert len(PdfReader(path).pages)==len(base.pages)+2;print('PDF med billedbilag:',len(PdfReader(path).pages),'sider')
