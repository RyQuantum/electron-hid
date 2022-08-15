import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Table, List } from 'antd';
import React, { useState } from 'react';
import 'antd/dist/antd.css';
import './App.css';

const ipcRender = window.electron.ipcRenderer;

const dataSource = [
  {
    id: '1',
    lockMac: 'EF:4A:F9:38:A9:3E',
    imei: '867997037276994',
    provisioning: 'Done',
  },
  {
    id: '2',
    lockMac: 'E3:1D:E3:1C:2D:41',
    imei: '867997037276995',
    provisioning: 'Done',
  },
];

const columns = [
  {
    title: 'id',
    dataIndex: 'id',
    key: 'id',
  },
  {
    title: 'LockMac',
    dataIndex: 'lockMac',
    key: 'lockMac',
  },
  {
    title: 'IMEI',
    dataIndex: 'imei',
    key: 'imei',
  },
  {
    title: 'Provisioning',
    dataIndex: 'provisioning',
    key: 'provisioning',
  },
];

const Content: React.FC = () => {
  const [logs, setLogs] = useState([]);
  ipcRender.on('write', (data) => {
    setLogs([...logs, `write:${data}`]);
  });
  ipcRender.on('received', (data) => {
    setLogs([...logs, `received:${data}`]);
  });

  return (
    <div id="content">
      <div id="table">
        <Table bordered dataSource={dataSource} columns={columns} />
      </div>
      <div id="log">
        <List
          size="small"
          header={<div>Log</div>}
          footer={
            <div id="footer">
              <Button type="primary">Login</Button>
              <Button
                type="primary"
                onClick={() =>
                  window.electron.ipcRenderer.sendMessage('start', {})
                }
              >
                Start
              </Button>
            </div>
          }
          bordered
          dataSource={logs}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </div>
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
