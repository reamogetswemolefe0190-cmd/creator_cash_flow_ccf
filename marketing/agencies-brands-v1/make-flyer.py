from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
root=Path(__file__).parent
dest=root/'partnership-flyer.pdf'
c=canvas.Canvas(str(dest),pagesize=A4)
c.setTitle('Creator Cash Flow | Agency and Brand Partnerships')
c.setAuthor('Creator Cash Flow')
c.drawImage(ImageReader(str(root/'images/partnership-flyer.png')),0,0,width=A4[0],height=A4[1])
c.linkURL('https://creatorcashflow.co.za',(28,35,330,105),relative=0)
c.showPage()
c.save()
print(dest)
