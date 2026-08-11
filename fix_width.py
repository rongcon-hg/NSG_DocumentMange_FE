import os
import re

directory = r'c:\Users\nvluy\Studio\Du an Nodejs\qlvb\NSG_DocumentMange_FE\src\Page'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            new_content = re.sub(r'fixed:\s*([\'"]right[\'"])', r'className: "action-col", fixed: \1', content)
            
            if new_content != content:
                new_content = new_content.replace('className: "action-col", className: "action-col",', 'className: "action-col",')
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Fixed width class in {filepath}')
