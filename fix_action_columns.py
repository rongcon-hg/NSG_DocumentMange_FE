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

    # 1. Update the wrapper class
    content = content.replace('className="flex flex-col gap-2"', 'className="flex flex-col gap-2 items-center justify-center"')
    content = content.replace('className="flex flex-wrap gap-2 justify-center"', 'className="flex flex-col gap-2 items-center justify-center"')

    # 2. Remove w-full from buttons
    content = content.replace(' text-xs w-full"', ' text-xs"')
    content = content.replace(' text-xs w-full "', ' text-xs "')

    # 3. Try to remove the width property for the Thao tac column
    # The column ends with:
    #       },
    #       width: 120,
    #     },
    # We can use regex to find the Thao tac column and remove its width.
    
    # Actually, we can just replace the specific width lines that appear right after the render function.
    # In SentDocumentList: width: 120,
    # In ReceivedDocumentList: width: 150,
    # In Report: width: 150,
    
    # We will use regex to find the Thao tac column block and remove the width property inside it.
    pattern = r'(title:\s*(?:"Thao tác"|\'Thao tác\').*?key:\s*(?:"action"|\'action\').*?render:\s*\([^)]*\)\s*=>\s*(?:{|\[|\().*?)(?:^\s*width:\s*\d+,\s*\n)?(^\s*},?\s*\n)'
    # The above regex is too complex and risky. Let's just find the end of the action column manually.
    
    # Simpler regex: find:
    #       },
    #       width: 120,
    #     },
    # And replace with:
    #       },
    #     },
    
    # Let's do this string replace if it matches exactly.
    # SentDocumentList
    content = re.sub(r'(},\s*\n\s*)width:\s*120,(\s*\n\s*},)', r'\1\2', content)
    # ReceivedDocumentList and Report
    content = re.sub(r'(},\s*\n\s*)width:\s*150,(\s*\n\s*},)', r'\1\2', content)
    # For the mobile view columns (if any defined below), they might also have width.
    # Actually, let's just write back the content.
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {file_path}")
