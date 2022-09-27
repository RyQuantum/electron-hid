import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React from 'react';
import 'antd/dist/antd.css';

import './App.css';
import DeviceTable from './DeviceTable';
import DeviceLogs from './DeviceLogs';

const Content: React.FC = () => {
  return (
    <div id="content">
      <DeviceTable />
      <DeviceLogs />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Content />} />
      </Routes>
    </Router>
  );
}
