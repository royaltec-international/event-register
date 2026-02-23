// ============================================================
//  Code.gs — Google Apps Script
//  วิธีใช้:
//  1. เปิด Google Sheet ใหม่
//  2. ไปที่ Extensions → Apps Script
//  3. วาง code นี้ลงไป แทนที่โค้ดเดิม
//  4. กด Deploy → New Deployment → Web App
//     - Execute as: Me
//     - Who has access: Anyone
//  5. Copy URL ที่ได้ → ใส่ใน wheelConfig.js ที่ googleScriptUrl
// ============================================================

// ชื่อ Sheet ที่ต้องการบันทึกข้อมูล
const SHEET_NAME = "Registrations";

// Header ของ Sheet (ลำดับต้องตรงกับที่ส่งมา)
const HEADERS = [
  "Timestamp",
  "ชื่อ",
  "นามสกุล",
  "อีเมล",
  "เบอร์โทร",
  "บริษัท",
  "ตำแหน่ง",
  "ของรางวัลที่ได้"
];

// ----------------------------------------------------------
//  doPost — รับข้อมูลจากหน้าเว็บ
// ----------------------------------------------------------
function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    const params = e.parameter;

    const row = [
      params.timestamp   || new Date().toISOString(),
      params.firstName   || "",
      params.lastName    || "",
      params.email       || "",
      params.phone       || "",
      params.company     || "",
      params.position    || "",
      params.prize       || "(ยังไม่ได้หมุน)"
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------------------------------------------------
//  doGet — ทดสอบว่า Script ทำงานได้ (เปิด URL ตรงๆ ใน browser)
// ----------------------------------------------------------
function doGet() {
  return ContentService
    .createTextOutput("Script ทำงานปกติ — Spin Wheel Ready!")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ----------------------------------------------------------
//  Helper: สร้าง Sheet ถ้ายังไม่มี
// ----------------------------------------------------------
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // ใส่ Header row
    sheet.appendRow(HEADERS);
    // จัด Style Header
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#2e5a73");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);
    sheet.setFrozenRows(1);
    // ปรับขนาด column
    sheet.setColumnWidth(1, 180); // Timestamp
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 200);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 180);
    sheet.setColumnWidth(7, 140);
    sheet.setColumnWidth(8, 160);
  }

  return sheet;
}
