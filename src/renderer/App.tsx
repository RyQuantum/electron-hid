import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Table, List } from 'antd';
import React, { useState } from 'react';
import 'antd/dist/antd.css';
import './App.css';

const ipcRender = window.electron.ipcRenderer;

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

  const [dataSource, setData] = useState([]);
  ipcRender.on('data', (data) => {
    const { id, lockMac, imei, provisioning } = data;
    const lock = { id, lockMac, imei, provisioning };
    const index = dataSource.findIndex((item) => item.id === lock.id);
    if (index !== -1) {
      dataSource[index].provisioning = provisioning;
    } else {
      dataSource.push(lock);
    }
    setData([...dataSource]);
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
              <Button
                type="primary"
                onClick={() => ipcRender.sendMessage('login', {})}
              >
                Login
              </Button>
              <Button
                type="primary"
                onClick={() => ipcRender.sendMessage('start', {})}
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
