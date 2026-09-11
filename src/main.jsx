import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { Provider } from 'react-redux';
import store from './redux/store';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/vi';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('vi');
dayjs.tz.setDefault('Asia/Ho_Chi_Minh');

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>
);
