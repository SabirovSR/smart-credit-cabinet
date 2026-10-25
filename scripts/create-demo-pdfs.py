"""Generate self-contained synthetic fixtures, never customer documents."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parents[1]
output = root / "public" / "demo-documents"
output.mkdir(parents=True, exist_ok=True)
font = Path("C:/Windows/Fonts/arial.ttf")
if not font.exists():
    font = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
pdfmetrics.registerFont(TTFont("Document", str(font)))
for filename, title, lines in [
    ("bank-statement", "Выписка по счёту", ["Компания: ООО «Северная лавка» (синтетический пример)", "Период: сентябрь 2026 года", "Поступления за месяц: 1 200 000 рублей", "Операционные расходы: 600 000 рублей", "Все суммы вымышлены. Это не банковская выписка."]),
    ("financial-report", "Финансовый отчёт", ["Компания: ООО «Северная лавка» (синтетический пример)", "Среднемесячные поступления: 1 200 000 рублей", "Среднемесячные расходы: 600 000 рублей", "Поток до обслуживания кредитов: 600 000 рублей", "Показатели вводятся в форму вручную. OCR не используется."]),
]:
    pdf = canvas.Canvas(str(output / f"{filename}.pdf"), pagesize=(595, 842))
    pdf.setTitle(f"{title} - синтетический пример")
    pdf.setAuthor("Smart Credit Cabinet demo")
    pdf.setFillColor(HexColor("#ef3124")); pdf.rect(0, 830, 595, 12, fill=1, stroke=0)
    pdf.setFont("Document", 10); pdf.drawString(48, 780, "ДЕЛО / ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ")
    pdf.setFillColor(HexColor("#202124")); pdf.setFont("Document", 25); pdf.drawString(48, 720, title)
    pdf.setFont("Document", 11)
    for i, line in enumerate(lines): pdf.drawString(48, 660-i*32, line)
    pdf.setFillColor(HexColor("#777b83")); pdf.setFont("Document", 9)
    pdf.drawString(48, 120, "Только для демонстрации загрузки PDF в хакатонном прототипе.")
    pdf.drawString(48, 100, "Не содержит реальных банковских реквизитов и сведений клиента.")
    pdf.drawString(48, 60, "Не является официальным документом банка.                             1 / 1")
    pdf.save()

if __name__ == "__main__":
    import pypdfium2 as pdfium
    preview = root / "work" / "pdf-preview"
    preview.mkdir(parents=True, exist_ok=True)
    for path in output.glob("*.pdf"):
        doc = pdfium.PdfDocument(str(path))
        assert len(doc) == 1 and "синтетический" in doc[0].get_textpage().get_text_range()
        doc[0].render(scale=1.2).to_pil().save(str(preview / f"{path.stem}.png"))
        print(f"Verified {path.name}: {len(doc)} page")
