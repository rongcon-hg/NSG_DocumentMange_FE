import os

files = [
    'src/Page/Documents/ReceivedDocumentList.jsx',
    'src/Page/Documents/SentDocumentList.jsx'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all occurrences of `value !== null && value !== ""` 
    # and replace with `value !== null && value !== undefined && value !== ""`
    
    # Wait, in the first fix I did, I might have double-fixed it if I run this.
    # Let's replace only if it doesn't have `undefined`
    
    # We can do this cleanly:
    content = content.replace(
        'value !== null && value !== undefined && value !== ""',
        'value !== null && value !== ""'
    )
    content = content.replace(
        'value !== null && value !== ""',
        'value !== null && value !== undefined && value !== ""'
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {file_path}")
