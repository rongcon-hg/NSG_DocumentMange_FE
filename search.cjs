
const fs = require('fs');
const path = require('path');
function searchRec(dir) {
  const files = fs.readdirSync(dir);
  for (let f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) searchRec(full);
    else if (full.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('Chuyển tiếp')) console.log(full);
    }
  }
}
searchRec('src');
