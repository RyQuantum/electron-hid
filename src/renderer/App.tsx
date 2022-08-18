import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Table, List, Radio } from 'antd';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useEvent } from 'react-use';

import 'antd/dist/antd.css';
import './App.css';

const { ipcRenderer } = window.electron;

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

const LockTable: React.FC = () => {
  const [dataSource, setDataSource] = useState([]);
  const handleEvent: function = useCallback(
    (id: number, lockMac: string, imei: string, provisioning?: string) => {
      const item = { id, lockMac, imei, provisioning, key: id };
      setDataSource((prevDataSource) => {
        const index = prevDataSource.findIndex((lock) => lock.id === id);
        if (index === -1) {
          prevDataSource.push(item);
        } else {
          prevDataSource[index] = item;
        }
        return [...prevDataSource];
      });
    },
    []
  );
  useEvent('lockInfo', handleEvent, ipcRenderer);

  return (
    <div id="table">
      <Table bordered dataSource={dataSource} columns={columns} />
    </div>
  );
};

// class LockTable extends Component<any, any> {
//   constructor(props: any) {
//     super(props);
//     ipcRenderer.on('lockInfo', (id, lockMac, imei, provisioning) => {
//       const lock = { id, lockMac, imei, provisioning, key: id };
//       const index = this.state.dataSource.findIndex((lock) => lock.id === id);
//       if (index === -1) {
//         this.state.dataSource.push(lock);
//       } else {
//         this.state.dataSource[index] = lock;
//       }
//       this.setState({ dataSource: [...this.state.dataSource] });
//     });
//     this.state = {
//       dataSource: [],
//     };
//   }
//
//   render() {
//     return (
//       <div id="table">
//         <Table bordered dataSource={this.state.dataSource} columns={columns} />
//       </div>
//     );
//   }
// }

const LockLogs: React.FC = () => {
  const [logs, setLogs] = useState([]);
  const handleUsbEvent = useCallback((direction: string, data: string) => {
    const str =
      direction === 'Send' || direction === 'Received'
        ? `${direction}:\u00A0${data}`
        : direction;
    setLogs((prevLogs: string[]) => [...prevLogs, str]);
  }, []);
  useEvent('usb', handleUsbEvent, ipcRenderer);

  const [isDisabled, setDisabled] = useState(true);

  const [isConnected, setConnected] = useState(false);
  const handleConnectEvent = useCallback(
    (connected: boolean) => setConnected(connected),
    []
  );
  useEvent('connected', handleConnectEvent, ipcRenderer);

  useEvent(
    'loggedIn',
    useCallback(() => setDisabled(false), []),
    ipcRenderer
  );

  const refs = useRef([]);
  useEffect(() => refs.current.at(logs.length - 1)?.scrollIntoView(), [logs]);

  return (
    <div id="log">
      <List
        size="small"
        header={
          <div id="header">
            <Button
              className="button"
              type="primary"
              onClick={() => ipcRenderer.sendMessage('login', {})}
            >
              Login
            </Button>
            <div>
              <Radio checked={isConnected}>USB Connected</Radio>
              <Button
                className="button"
                type="primary"
                disabled={isDisabled || !isConnected}
                onClick={() => {
                  setLogs([]);
                  ipcRenderer.sendMessage('start', {});
                }}
              >
                Start
              </Button>
            </div>
          </div>
        }
        dataSource={logs}
        renderItem={(item, index) => (
          <List.Item
            ref={(elm) => {
              refs.current[index] = elm;
            }}
          >
            {item}
          </List.Item>
        )}
      />
    </div>
  );
};

// class LockLogs extends Component<any, any> {
//   constructor(props: any) {
//     super(props);
//     ipcRenderer.on('usb', (direction, data) => {
//       this.setState({ logs: [...this.state.logs, `${direction}:${data}`] });
//     });
//     this.state = {
//       logs: [],
//     };
//   }
//
//   render() {
//     return (
//       <div id="log">
//         <List
//           size="small"
//           header={<div>Log</div>}
//           footer={
//             <div id="footer">
//               <Button
//                 type="primary"
//                 onClick={() => ipcRender.sendMessage('login', {})}
//               >
//                 Login
//               </Button>
//               <Button
//                 type="primary"
//                 onClick={() => ipcRender.sendMessage('start', {})}
//               >
//                 Start
//               </Button>
//             </div>
//           }
//           bordered
//           dataSource={this.state.logs}
//           renderItem={(item) => <List.Item>{item}</List.Item>}
//         />
//       </div>
//     );
//   }
// }

const Content: React.FC = () => {
  return (
    <div id="content">
      <LockTable />
      <LockLogs />
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
