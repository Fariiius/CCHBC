const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports'];
const statuses = ['Delivered', 'Processing', 'Shipped', 'Cancelled'];

const generateData = (numRows) => {
  const data = [];
  const startDate = new Date('2024-01-01').getTime();
  const endDate = new Date('2024-12-31').getTime();

  for (let i = 1; i <= numRows; i++) {
    const randomTime = startDate + Math.random() * (endDate - startDate);
    const date = new Date(randomTime).toISOString().split('T')[0];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const quantity = Math.floor(Math.random() * 20) + 1;
    const price = +(Math.random() * 500 + 10).toFixed(2);
    const revenue = +(quantity * price).toFixed(2);

    data.push({
      OrderID: `ORD-${1000 + i}`,
      Date: date,
      Region: region,
      Category: category,
      Status: status,
      Quantity: quantity,
      Price: price,
      Revenue: revenue
    });
  }

  // Sort by date
  data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
  return data;
};

const salesData = generateData(500);

// Create a new workbook
const wb = XLSX.utils.book_new();

// Add the Sales sheet
const wsSales = XLSX.utils.json_to_sheet(salesData);
XLSX.utils.book_append_sheet(wb, wsSales, 'SalesData');

// Add a KPIs sheet
const kpiData = [
  { Metric: 'Total Revenue Target', Value: 500000 },
  { Metric: 'Customer Satisfaction Score', Value: 4.8 },
  { Metric: 'New Customers', Value: 1250 }
];
const wsKPIs = XLSX.utils.json_to_sheet(kpiData);
XLSX.utils.book_append_sheet(wb, wsKPIs, 'SummaryKPIs');

// Write the file
const dirPath = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const filePath = path.join(dirPath, 'data.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`Successfully generated sample data at: ${filePath}`);
