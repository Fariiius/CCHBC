const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

try {
  const filePath = path.join(process.cwd(), 'data', 'data.xlsx');
  console.log('File path:', filePath);
  console.log('Exists:', fs.existsSync(filePath));
  const workbook = xlsx.readFile(filePath);
  console.log('Parsed successfully');
} catch (e) {
  console.error('Error:', e);
}
