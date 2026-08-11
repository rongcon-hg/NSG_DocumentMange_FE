import os
import re

directory = r'c:\Users\nvluy\Studio\Du an Nodejs\qlvb\NSG_DocumentMange_FE\src\Page'
target_class = 'max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if 'flex flex-wrap gap-2 justify-center' in content:
                parts = content.split('flex flex-wrap gap-2 justify-center')
                new_content = parts[0]
                
                for i in range(1, len(parts)):
                    part = parts[i]
                    # We just want to replace the first few buttons. The render function usually ends with '},'
                    # Wait, in BGHReviewPage it's '},' but let's just find the first '}' that is at the outer level?
                    # Or just replace the next 5 occurrences of className="...rounded-md..."
                    end_idx = part.find('},')
                    if end_idx == -1: end_idx = len(part)
                    
                    subpart1 = part[:end_idx]
                    subpart2 = part[end_idx:]
                    
                    # use regex to add target_class to the className containing rounded-md
                    subpart1 = re.sub(r'className="([^"]*)rounded-md([^"]*)"', f'className="\\1rounded-md {target_class}\\2"', subpart1)
                    
                    new_content += 'flex flex-wrap gap-2 justify-center' + subpart1 + subpart2
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Fixed {filepath}')
