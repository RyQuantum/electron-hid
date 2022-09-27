import React, { useCallback, useState } from 'react';
import { useEvent } from 'react-use';
import { Table } from 'antd';

import { Device } from '../main/db';

import './DeviceTable.css';

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
  useEvent('device', handleEvent, ipcRenderer);

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

export default DeviceTable;
