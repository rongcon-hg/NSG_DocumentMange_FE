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
    
    // Simple regex to find the action column and inject align: 'center'
    // Look for fixed: "right", or similar in the Thao tac column.
    if (content.includes('key: "action"')) {
        content = content.replace(/className:\s*['"]action-col['"],\s*fixed:\s*['"]right['"],/, 'className: "action-col", fixed: "right", align: "center",');
        
        // Let's replace the width: 120 with width: 100 for the action columns.
        // It's a bit hard to target exactly only the action column's width with simple regex.
        // But we can just inject width: 100, right after lign: "center", 
        // and if there's a duplicate width: 120 later in the object, we hope our first one overrides or we remove the later one.
        // Actually, in JS object literals, the LAST property overrides the previous ones.
        // So we must remove width: 120 or replace it.
    }
    
    // Instead of complex AST parsing, let's just do a naive replace for fixed: "right"
    content = content.replace(/fixed:\s*['"]right['"],/g, 'fixed: "right", align: "center",');
    
    // Replace width: 120 with width: 100 ONLY in the action column.
    // We can do this by splitting on key: "action" and replacing the first width: 120 after it.
    let parts = content.split('key: "action"');
    if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
            parts[i] = parts[i].replace(/width:\s*120/, 'width: 100');
        }
        content = parts.join('key: "action"');
    }
    
    // Also handle UnitList which might use key: 'action' (single quotes)
    parts = content.split("key: 'action'");
    if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
            parts[i] = parts[i].replace(/width:\s*120/, 'width: 100');
        }
        content = parts.join("key: 'action'");
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});
