const xlsx = require('xlsx');

const data = [];
for (let i = 0; i < 50; i++) {
  data.push({
    Category: ['A', 'B', 'C', 'D'][i % 4],
    Sales: Math.floor(Math.random() * 900) + 100,
    Profit: Math.floor(Math.random() * 250) - 50,
    Date: new Date(2023, 0, (i % 30) + 1).toISOString().split('T')[0]
  });
}

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
xlsx.writeFile(wb, "test_data.xlsx");

console.log("Created test_data.xlsx");
