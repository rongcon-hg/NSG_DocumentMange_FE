import os

filepath = r'c:\Users\nvluy\Studio\Du an Nodejs\qlvb\NSG_DocumentMange_FE\src\Page\Schedule\SchedulePage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''          {
              title: 'Thao tác',
              key: 'action',
              render: (_, record) => (
                  <Space size="small" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Xem chi tiết">
                          <Button type="text" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handleViewDetails(record); }} className="text-blue-500" />
                      </Tooltip>
                      <Tooltip title="Cập nhật">
                          <Button type="text" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleSelectEvent({ resource: record }); }} className="text-orange-500" />
                      </Tooltip>
                      <Tooltip title="Lịch sử">
                          <Button type="text" icon={<HistoryOutlined />} onClick={(e) => { e.stopPropagation(); handleViewHistory(record); }} className="text-gray-500" />
                      </Tooltip>
                  </Space>
              )
          }'''

replacement = '''          {
              title: 'Thao tác',
              key: 'action',
              className: "action-col", fixed: "right",
              render: (_, record) => (
                  <div className="flex flex-wrap gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Xem chi tiết">
                          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handleViewDetails(record); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center sm:w-28 sm:justify-start text-xs">
                              <span className="hidden sm:inline text-xs">Xem chi tiết</span>
                          </Button>
                      </Tooltip>
                      <Tooltip title="Cập nhật">
                          <Button type="default" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleSelectEvent({ resource: record }); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center sm:w-28 sm:justify-start border-orange-500 text-orange-500 hover:bg-orange-50 text-xs">
                              <span className="hidden sm:inline text-xs">Cập nhật</span>
                          </Button>
                      </Tooltip>
                      <Tooltip title="Lịch sử">
                          <Button type="default" size="small" icon={<HistoryOutlined />} onClick={(e) => { e.stopPropagation(); handleViewHistory(record); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center sm:w-28 sm:justify-start text-gray-500 border-gray-500 hover:bg-gray-50 text-xs">
                              <span className="hidden sm:inline text-xs">Lịch sử</span>
                          </Button>
                      </Tooltip>
                  </div>
              )
          }'''

new_content = content.replace(target, replacement)
if new_content != content:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Fixed SchedulePage')
else:
    print('Target not found')
