"""테스트용 악보 PDF를 만든다. 한글 제목은 CID 글꼴이라 pdf.js의 CMap이 있어야 제대로 보인다."""
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))


def sheet(path, title, key, pages, mark):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    c = canvas.Canvas(path, pagesize=A4)
    w, h = A4
    for p in range(pages):
        c.setFont("HYSMyeongJo-Medium", 22)
        c.drawCentredString(w / 2, h - 60, f"{title} ({key})" if p == 0 else f"{title} - {p + 1}쪽")
        c.setFont("Helvetica", 10)
        c.drawString(40, h - 80, f"{mark} page {p + 1}")
        y = h - 130
        for _ in range(8):
            for line in range(5):
                c.line(40, y - line * 7, w - 40, y - line * 7)
            for n in range(12):
                x = 70 + n * 40
                c.circle(x, y - 14 - (n % 5) * 3.5, 3.5, fill=1)
                c.line(x + 3.5, y - 14 - (n % 5) * 3.5, x + 3.5, y + 6 - (n % 5) * 3.5)
            y -= 85
        c.showPage()
    c.save()


work = sys.argv[1]
sheet(f"{work}/storage/sheets/a/1.pdf", "주님의 은혜", "G", 2, "A-v1")
sheet(f"{work}/storage/sheets/a/2.pdf", "주님의 은혜", "G", 2, "A-v2")
sheet(f"{work}/storage/sheets/b/1.pdf", "은혜 아니면", "A", 1, "B-v1")
sheet(f"{work}/new-song.pdf", "새 노래", "D", 1, "NEW")
