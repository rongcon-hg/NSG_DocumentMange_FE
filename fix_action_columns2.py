import os
import re

files = [
    'src/Page/Documents/SentDocumentList.jsx',
    'src/Page/Documents/ReceivedDocumentList.jsx',
    'src/Page/Report/Report.jsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split the content around 'title: "Thao tác",'
    if 'title: "Thao tác",' not in content:
        continue
        
    parts = content.split('title: "Thao tác",', 1)
    before = parts[0]
    after = 'title: "Thao tác",' + parts[1]
    
    # In the 'after' part, we want to replace the wrapper class
    after = after.replace('className="flex flex-col gap-2"', 'className="flex flex-col gap-2 items-center justify-center"')
    after = after.replace('className="flex flex-wrap gap-2 justify-center"', 'className="flex flex-col gap-2 items-center justify-center"')
    
    # Remove w-full from the buttons in the action column only
    after = after.replace(' text-xs w-full"', ' text-xs"')
    after = after.replace(' text-xs w-full "', ' text-xs "')
    
    # Try to find the exact end of the Thao tac column. 
    # It ends with:
    #       },
    #       width: 120,
    #     },
    # or similar width, followed by '];'
    # Wait, Sent and Received end the columns array right after Thao tac, so they have `];` afterwards.
    
    # We can just replace `width: 120,` and `width: 150,` with empty string ONLY within the 'after' part, 
    # but only up to the `];` which ends the columns array.
    columns_end_idx = after.find('];')
    if columns_end_idx != -1:
        thao_tac_col = after[:columns_end_idx]
        rest = after[columns_end_idx:]
        
        # Remove width: 120 or width: 150 inside thao_tac_col
        thao_tac_col = re.sub(r'width:\s*120,', '', thao_tac_col)
        thao_tac_col = re.sub(r'width:\s*150,', '', thao_tac_col)
        
        after = thao_tac_col + rest

    new_content = before + after

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Processed {file_path}")
