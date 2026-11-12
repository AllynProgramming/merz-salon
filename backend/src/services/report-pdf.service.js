import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#1d2b24",
  green: "#205638",
  muted: "#5b665f",
  rule: "#aeb7b1",
  pale: "#eef2ee",
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const titleCase = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

const drawRule = (document, y, x = 48, width = 516, color = COLORS.rule) => {
  document
    .save()
    .strokeColor(color)
    .lineWidth(0.6)
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke()
    .restore();
};

const sectionHeading = (document, label, y) => {
  document
    .fillColor(COLORS.green)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(label.toUpperCase(), 48, y, { characterSpacing: 0.8 });
  drawRule(document, y + 16);
  return y + 29;
};

const drawTableHeader = (document, columns, y) => {
  document
    .save()
    .fillColor(COLORS.pale)
    .rect(48, y - 4, 516, 22)
    .fill()
    .restore();
  columns.forEach((column) => {
    document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(column.label, column.x, y + 2, {
        width: column.width,
        align: column.align || "left",
      });
  });
  return y + 28;
};

const drawTableRow = (document, values, columns, y, height = 24) => {
  values.forEach((value, index) => {
    const column = columns[index];
    document
      .fillColor(COLORS.ink)
      .font("Helvetica")
      .fontSize(8.5)
      .text(String(value), column.x, y + 4, {
        width: column.width,
        align: column.align || "left",
        lineBreak: false,
        ellipsis: true,
      });
  });
  drawRule(document, y + height, 48, 516, "#d4dbd6");
  return y + height;
};

export const createReportPdf = (report) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({
      margin: 48,
      size: "legal",
      info: {
        Title: "MERZ Beauty Salon Operations Report",
        Author: "MERZ Beauty Salon",
        Subject: `Report for ${report.period.from} to ${report.period.to}`,
      },
    });
    const chunks = [];

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    const drawFooter = () => {
      const y = 898;
      drawRule(document, y, 48, 516, COLORS.rule);
      document
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(7.5)
        .text("MERZ Beauty Salon  |  Internal operations document", 48, y + 9);
      document.text("Page 1", 500, y + 9, { width: 64, align: "right" });
    };

    document
      .fillColor(COLORS.green)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("MERZ BEAUTY SALON", 48, 54, { align: "center", width: 516 });
    document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("OPERATIONS REPORT", 48, 78, { align: "center", width: 516 });
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text("CONFIDENTIAL  |  ADMINISTRATIVE USE ONLY", 48, 107, {
        align: "center",
        width: 516,
        characterSpacing: 0.7,
      });
    drawRule(document, 128, 48, 516, COLORS.green);

    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text("REPORTING PERIOD", 48, 150, { characterSpacing: 0.7 });
    document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(`${report.period.from}  to  ${report.period.to}`, 48, 164);
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(`Generated ${new Date().toISOString().slice(0, 10)}`, 370, 164, {
        width: 194,
        align: "right",
      });

    let y = sectionHeading(document, "Appointment summary", 202);
    document
      .fillColor(COLORS.green)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(String(report.appointments.total), 48, y);
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text("TOTAL APPOINTMENTS", 48, y + 34, { characterSpacing: 0.7 });

    const statusColumns = [
      { label: "STATUS", x: 220, width: 150 },
      { label: "COUNT", x: 470, width: 94, align: "right" },
    ];
    let statusY = drawTableHeader(document, statusColumns, y);
    Object.entries(report.appointments.byStatus).forEach(([status, count]) => {
      if (count > 0) {
        statusY = drawTableRow(
          document,
          [titleCase(status), count],
          statusColumns,
          statusY,
          22,
        );
      }
    });

    y = Math.max(statusY + 22, y + 82);
    y = sectionHeading(document, "Service activity and revenue", y);
    const serviceColumns = [
      { label: "SERVICE", x: 48, width: 230 },
      { label: "BOOKINGS", x: 278, width: 72, align: "right" },
      { label: "COMPLETED", x: 362, width: 78, align: "right" },
      { label: "REVENUE", x: 454, width: 110, align: "right" },
    ];
    y = drawTableHeader(document, serviceColumns, y);
    report.services.forEach((service) => {
      y = drawTableRow(
        document,
        [
          service.name,
          service.appointments,
          service.completed,
          formatCurrency(service.revenue),
        ],
        serviceColumns,
        y,
      );
    });
    if (!report.services.length) {
      document
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(9)
        .text("No service activity was recorded for this period.", 48, y + 4);
      y += 28;
    }

    y += 18;
    y = sectionHeading(document, "Customer activity", y);
    document
      .fillColor(COLORS.ink)
      .font("Helvetica")
      .fontSize(10)
      .text("Customers with visits in this period", 48, y);
    document
      .fillColor(COLORS.green)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(String(report.customers.activeInPeriod), 430, y - 2, {
        width: 134,
        align: "right",
      });
    y += 28;
    const customerColumns = [
      { label: "CUSTOMER", x: 48, width: 400 },
      { label: "VISITS", x: 490, width: 74, align: "right" },
    ];
    y = drawTableHeader(document, customerColumns, y);
    report.customers.frequent.forEach((customer) => {
      y = drawTableRow(
        document,
        [customer.name?.trim() || "Customer", customer.visits],
        customerColumns,
        y,
      );
    });
    if (!report.customers.frequent.length) {
      document
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(9)
        .text("No customer activity was recorded for this period.", 48, y + 4);
    }

    drawFooter();
    document.end();
  });
