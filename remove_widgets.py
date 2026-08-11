import os
import re

filepath = r'c:\Users\nvluy\Studio\Du an Nodejs\qlvb\NSG_DocumentMange_FE\src\App.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = re.sub(r"import Draggable from 'react-draggable';\n", "", content)
content = re.sub(r"import \{ FloatButton \} from 'antd';\n", "", content)
content = re.sub(r"import \{ MessageOutlined, CustomerServiceOutlined \} from '@ant-design/icons';\n", "", content)

# 2. Hooks and Constants
content = re.sub(r"  const ZaloOAID = import\.meta\.env\.VITE_ZALO_OAID;\n", "", content)
content = re.sub(r"  const TAWKTO_PROPERTY_ID = import\.meta\.env\.VITE_TAWK_ID;\n", "", content)
content = re.sub(r"  const zaloWidgetRef = useRef\(null\);\n", "", content)
content = re.sub(r"  const \[isZaloOpen, setIsZaloOpen\] = useState\(false\);\n", "", content)
content = re.sub(r"  const \[isTawkOpen, setIsTawkOpen\] = useState\(false\);\n", "", content)
content = re.sub(r"  const \[isButtonGroupOpen, setIsButtonGroupOpen\] = useState\(false\);\n", "", content)

# 3. Zalo useEffect
content = re.sub(r"  // Load Zalo SDK.*?  \}, \[ZaloOAID\]\);\n\n", "", content, flags=re.DOTALL)

# 4. Tawk.to useEffect
content = re.sub(r"  // Load Tawk\.to script and ensure widget is hidden.*?  \}, \[\]\);\n\n", "", content, flags=re.DOTALL)

# 5. Functions
content = re.sub(r"  const toggleZaloWidget = \(\) => \{.*?\};\n\n", "", content, flags=re.DOTALL)
content = re.sub(r"  const toggleTawkWidget = \(\) => \{.*?\};\n\n", "", content, flags=re.DOTALL)
content = re.sub(r"  const toggleButtonGroup = \(open\) => \{.*?\};\n", "", content, flags=re.DOTALL)
content = re.sub(r"  const renderFloatingButtonGroup = \(\) => \{.*?  \};\n  \n\n", "", content, flags=re.DOTALL)
content = re.sub(r"  const renderChatWidgets = \(\) => \{.*?  \};\n\n", "", content, flags=re.DOTALL)

# 6. Render references
content = content.replace("                  {renderChatWidgets()}\n", "")
content = content.replace("                  {renderFloatingButtonGroup()}\n", "")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed Tawk/Zalo components")
