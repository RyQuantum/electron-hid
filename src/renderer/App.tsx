import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { Button, Table, List, Radio } from 'antd';
import { LoadingOutlined, CheckCircleTwoTone } from '@ant-design/icons';
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useEvent } from 'react-use';

import 'antd/dist/antd.css';
import './App.css';
import { Device } from '../main/db';

const { ipcRenderer } = window.electron;

const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 60,
  },
  {
    title: 'LockMac',
    dataIndex: 'lockMac',
    key: 'lockMac',
    width: 140,
  },
  {
    title: 'IMEI',
    dataIndex: 'imei',
    key: 'imei',
    width: 150,
  },
  {
    title: 'Provisioning',
    dataIndex: 'provisioning',
    key: 'provisioning',
  },
];

type DataType = {
  id: number;
  lockMac?: string;
  imei?: string;
  provisioning?: string;
};

const DeviceTable: React.FC = () => {
  const [dataSource, setDataSource] = useState<DataType[]>([]);
  const [current, setCurrent] = useState(1);

  const handleFobsEvent = useCallback((devices: Device[]) => {
    const data = devices.map((device) => ({
      ...device,
      key: device.id,
    }));
    setDataSource(data);
    setCurrent(Math.ceil(data.length / 10));
  }, []);
  useEvent('devices', handleFobsEvent, ipcRenderer);

  const handleEvent = useCallback(
    (id: number, lockMac: string, imei: string, provisioning?: string) => {
      const item = { id, lockMac, imei, provisioning, key: id };
      setDataSource((prevDataSource) => {
        const index = prevDataSource.findIndex((device) => device.id === id);
        if (index === -1) {
          prevDataSource.push(item);
        } else {
          prevDataSource[index] = item;
        }
        setCurrent(Math.ceil(prevDataSource.length / 10));
        return [...prevDataSource];
      });
    },
    []
  );
  useEvent('lockInfo', handleEvent, ipcRenderer);

  return (
    <div id="table">
      <Table
        bordered
        size="middle"
        dataSource={dataSource}
        columns={columns}
        pagination={{
          current, // TODO cannot jump to the next page
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        onChange={(config) =>
          setCurrent(config.current || Math.ceil(dataSource.length / 10))
        }
      />
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

const DeviceLogs: React.FC = () => {
  const [logs, setLogs] = useState<object[]>([]);
  const handleUsbEvent = useCallback(
    (
      step: string,
      state?: 'pending' | 'success' | 'failed',
      payload?: object
    ) => {
      setLogs((prevLogs) => {
        if (prevLogs[prevLogs.length - 1]?.step === step) {
          prevLogs[prevLogs.length - 1] = { step, state, payload };
          return [...prevLogs];
        }
        if (prevLogs[prevLogs.length - 1]?.state === 'pending') {
          prevLogs[prevLogs.length - 1].state = 'success';
        }
        return [...prevLogs, { step, state, payload }];
      });
      // setLogs((prevLogs) => [...prevLogs, { step, state, payload }]);
      // setLogs((prevLogs) => [...prevLogs, { step, state, payload }]);
    },
    []
  );
  useEvent('usb', handleUsbEvent, ipcRenderer);

  const [loginState, setLoginState] = useState(0); // 0: failed; 1: pending; 2: success

  const [isConnected, setConnected] = useState(false);
  const handleConnectEvent = useCallback(
    (connected: boolean) => setConnected(connected),
    []
  );
  useEvent('connected', handleConnectEvent, ipcRenderer);

  useEvent(
    'login',
    useCallback((state: number) => setLoginState(state), []),
    ipcRenderer
  );

  const refs = useRef<HTMLElement[]>([]);
  useEffect(() => refs.current.at(logs.length - 1)?.scrollIntoView(), [logs]);

  return (
    <div id="log">
      <List
        size="small"
        header={
          <div id="header">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button
                className="button"
                type="primary"
                onClick={() => ipcRenderer.sendMessage('login')}
              >
                Login
              </Button>
              &nbsp;
              {
                [
                  null,
                  <LoadingOutlined style={{ fontSize: '16px' }} />,
                  <CheckCircleTwoTone
                    twoToneColor="#52c41a"
                    style={{ fontSize: '16px' }}
                  />,
                ][loginState]
              }
            </div>
            <div>
              <Radio checked={isConnected}>USB Connected</Radio>
              <Button
                className="button"
                type="primary"
                disabled={loginState !== 2 || !isConnected}
                onClick={() => {
                  setLogs([]);
                  ipcRenderer.sendMessage('start');
                }}
              >
                Start
              </Button>
            </div>
          </div>
        }
        dataSource={logs}
        renderItem={(item, index) => {
          let res;
          const convert = (state: string) => {
            // return state;
            switch (state) {
              case 'pending':
                return <LoadingOutlined style={{ fontSize: '16px' }} />;
              case 'success':
                return (
                  <CheckCircleTwoTone
                    twoToneColor="#52c41a"
                    style={{ fontSize: '16px' }}
                  />
                );
              case 'failed': // TODO
              default:
                return null;
            }
          };
          if (item.step === 'Done')
            res = (
              <div style={{ flexDirection: 'row' }}>
                <span>Done&nbsp;&nbsp;</span>
                {convert('success')}
              </div>
            );
          else if (item.payload) {
            res = (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                  <span>{item.step}:&nbsp;&nbsp;</span>
                  {convert(item.state)}
                </div>
                <span>{JSON.stringify(item.payload)}</span>
              </div>
            );
          } else if (item.state) {
            res = (
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                <span>{item.step}:&nbsp;&nbsp;</span>
                <div>{convert(item.state)}</div>
              </div>
            );
          } else {
            res = item.step;
          }
          return (
            <List.Item
              ref={(elm) => {
                if (elm) {
                  refs.current[index] = elm;
                }
              }}
            >
              {/* {item} */}
              {res}
            </List.Item>
          );
        }}
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
