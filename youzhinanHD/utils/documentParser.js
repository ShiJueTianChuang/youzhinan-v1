const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const PDF_EXTENSIONS = ['pdf'];
const WORD_EXTENSIONS = ['doc', 'docx'];
const EXCEL_EXTENSIONS = ['xls', 'xlsx'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

const IMAGE_MIME_MAP = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp'
};

function getFileCategory(extension) {
    const ext = extension.toLowerCase();
    if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
    if (WORD_EXTENSIONS.includes(ext)) return 'word';
    if (EXCEL_EXTENSIONS.includes(ext)) return 'excel';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    return 'unknown';
}

async function extractTextFromPdf(fileBuffer) {
    const data = await pdfParse(fileBuffer);
    return data.text || '';
}

async function extractTextFromWord(fileBuffer) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || '';
}

async function extractTextFromExcel(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheets = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
            sheets.push(`=== 工作表: ${sheetName} ===\n${csv}`);
        }
    }
    return sheets.join('\n\n');
}

async function extractTextFromFile(fileBase64, fileName) {
    const extension = fileName?.split('.').pop()?.toLowerCase() || '';
    const category = getFileCategory(extension);
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    switch (category) {
        case 'pdf': {
            const text = await extractTextFromPdf(fileBuffer);
            if (!text || text.trim().length === 0) {
                return { success: false, category, error: 'PDF 文件无法提取文本内容，可能是扫描件或图片型 PDF' };
            }
            return { success: true, category, text: text.trim() };
        }
        case 'word': {
            const text = await extractTextFromWord(fileBuffer);
            if (!text || text.trim().length === 0) {
                return { success: false, category, error: 'Word 文件无法提取文本内容' };
            }
            return { success: true, category, text: text.trim() };
        }
        case 'excel': {
            const text = await extractTextFromExcel(fileBuffer);
            if (!text || text.trim().length === 0) {
                return { success: false, category, error: 'Excel 文件无法提取数据内容' };
            }
            return { success: true, category, text: text.trim() };
        }
        case 'image': {
            return { success: true, category, imageBase64: fileBase64, imageMimeType: IMAGE_MIME_MAP[extension] || 'image/jpeg' };
        }
        default:
            return { success: false, category: 'unknown', error: `不支持的文件类型: .${extension}` };
    }
}

module.exports = {
    extractTextFromFile,
    getFileCategory,
    PDF_EXTENSIONS,
    WORD_EXTENSIONS,
    EXCEL_EXTENSIONS,
    IMAGE_EXTENSIONS,
    IMAGE_MIME_MAP
};
