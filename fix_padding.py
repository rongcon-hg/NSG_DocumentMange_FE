
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
                start_idx = content.find('flex flex-wrap gap-2 justify-center')
                end_idx = content.find('},', start_idx)
                if end_idx == -1: end_idx = len(content)

                part1 = content[:start_idx]
                part2 = content[start_idx:end_idx]
                part3 = content[end_idx:]

                part2 = part2.replace('className=\"text-xs rounded-md\"', f'className=\"text-xs rounded-md {target_class}\"')
                part2 = part2.replace('className=\"rounded-md\"', f'className=\"rounded-md {target_class}\"')
                # Also replace if it has size=small etc but I already added rounded-md to all action buttons

                new_content = part1 + part2 + part3
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Fixed {filepath}')

