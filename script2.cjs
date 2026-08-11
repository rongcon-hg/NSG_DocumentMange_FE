const fs = require('fs');
const path = require('path');

const walk = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src/Page');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace width: 100 with width: window.innerWidth < 640 ? 100 : 130
    // We'll just replace 'width: 100' globally inside the src/Page files, since it was mostly just action columns.
    // Let's do it safely: find key: "action" or similar, then replace the subsequent width: 100.
    const blocks = content.split('className: "action-col"');
    if (blocks.length > 1) {
        for (let i = 1; i < blocks.length; i++) {
            blocks[i] = blocks[i].replace(/width:\s*100/, 'width: window.innerWidth < 640 ? 100 : 130');
        }
        content = blocks.join('className: "action-col"');
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});
