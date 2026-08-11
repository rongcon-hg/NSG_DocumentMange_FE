import os
import re

directory = r'c:\Users\nvluy\Studio\Du an Nodejs\qlvb\NSG_DocumentMange_FE\src\Page'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if 'className: "action-col"' in content:
                # We need to remove 'width: 120,' or 'width: 150,' etc. that appears right before className: "action-col"
                # Using regex: \s*width:\s*\d+,\s*className:\s*"action-col"
                new_content = re.sub(r'\s*width:\s*\d+,\s*className:\s*"action-col"', r'\n      className: "action-col"', content)
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Removed hardcoded width in {filepath}')
