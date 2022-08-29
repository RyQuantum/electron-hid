import EventEmitter from 'events';
import { ipcMain, WebContents } from 'electron';
import HID from 'node-hid';
import crc from 'crc';

import { alert } from './util';
import { Lock } from './db';
import * as api from './api';

const paddingZeroAndCrc16 = (arr: number[]): number[] => {
  let num = Math.floor(arr.length / 64);
  if (num * 64 < arr.length) num += 1;
  const length = num * 64 - 2;
  const payload: number[] = [
    90,
    90,
    Math.floor(length / 256),
    length % 256,
    ...arr,
    ...Array(num * 64 - arr.length - 6).fill(0),
  ];
  const data = payload.slice(2);
  const checksum = crc.crc16ccitt(Buffer.from(data));
  return [...payload, Math.floor(checksum / 256), checksum % 256];
};

export default class UsbController extends EventEmitter {
  private webContents: WebContents;

  private device: HID.HID;

  constructor(webContents: WebContents) {
    super();
    this.webContents = webContents;
    ipcMain.on('start', this.startTest);
  }

  startListening = () => {
    setInterval(() => {
      const device = HID.devices().find(
        (d: { vendorId: number; productId: number }) =>
          d.vendorId === 0x2fe3 && d.productId === 0x100
      );
      const prevDevice = this.device;
      if (device) {
        if (!prevDevice) {
          this.device = new HID.HID(0x2fe3, 0x100);
          this.webContents.send('connected', true);
        }
      } else if (prevDevice) {
        this.device = null;
        this.webContents.send('connected', false);
      }
    }, 100);
  };

  startTest = async (): Promise<void> => {
    try {
      const lock = await this.getInfo();
      const csr = await this.requestCsr(lock);
      const certificate = await this.uploadCsr(lock, csr);
      await this.forwardCrt(lock, certificate);
      this.updateDBAndUI(lock, 'Fetching keys from server...');
      const { privateKey, ca, rootCA } = await api.getKeys();
      await this.forwardDevicePrivateKey(lock, privateKey);
      await this.forwardDeviceCA(lock, ca);
      await this.forwardServerCA(lock, rootCA);
      this.updateDBAndUI(lock, 'Done');
    } catch (err) {
      alert('error', err.message);
    }
  };

  updateDBAndUI = (lock: Lock, provisioning: string) => {
    lock.update({ provisioning });
    this.webContents.send('usb', provisioning);
    this.webContents.send(
      'lockInfo',
      lock.id,
      lock.lockMac,
      lock.imei,
      provisioning
    );
  };

  getInfo = async (): Promise<Lock> => {
    const lock = await Lock.create({});
    this.updateDBAndUI(lock, 'Requesting lock info...');
    const cmd = paddingZeroAndCrc16([0, 1, 64, 0]); // get device info command
    const res = await this.writeAndRead(cmd);
    const lockMac = [...res.slice(17, 23)]
      .map((n: number) => n.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
    const imei = [...res.slice(23, 38)]
      .map((n: number) => (n - 48).toString())
      .join('');
    await lock.update({ lockMac, imei });
    this.updateDBAndUI(lock, `lockMac: ${lockMac} imei: ${imei}`);
    return lock;
  };

  requestCsr = async (lock: Lock): Promise<string> => {
    this.updateDBAndUI(lock, 'Requesting csr...');
    const cmd = paddingZeroAndCrc16([0, 1, 64, 1]); // request csr command
    const res = await this.writeAndRead(cmd);
    const str = res.toString();
    const i = str.indexOf('-----END CERTIFICATE REQUEST-----');
    return str.slice(17, i + 34);
  };

  uploadCsr = async (lock: Lock, csr: string): Promise<string> => {
    this.updateDBAndUI(lock, 'Uploading csr from server...');
    const { certificate } = await api.uploadCsr(lock.lockMac, lock.imei, csr);
    return certificate;
  };

  forwardCrt = async (lock: Lock, certificate: string): Promise<void> => {
    this.updateDBAndUI(lock, 'Sending crt...');
    const crt = [...certificate].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 2, 0, 0, 0, 0, 0, 0, 0, 0];
    const cmd = paddingZeroAndCrc16([...arr, ...crt]); // forward crt command
    await this.writeAndRead(cmd);
  };

  forwardDevicePrivateKey = async (
    lock: Lock,
    privateKey: string
  ): Promise<void> => {
    this.updateDBAndUI(lock, 'Sending device private key...');
    const key = [...privateKey].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3];
    const cmd = paddingZeroAndCrc16([...arr, ...key]); // forward crt command
    await this.writeAndRead(cmd);
  };

  forwardDeviceCA = async (lock: Lock, deviceCA: string): Promise<void> => {
    this.updateDBAndUI(lock, 'Sending device CA...');
    const ca = [...deviceCA].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    const cmd = paddingZeroAndCrc16([...arr, ...ca]); // forward crt command
    await this.writeAndRead(cmd);
  };

  forwardServerCA = async (lock: Lock, serverCA: string): Promise<void> => {
    this.updateDBAndUI(lock, 'Sending server CA...');
    const ca = [...serverCA].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const cmd = paddingZeroAndCrc16([...arr, ...ca]); // forward crt command
    await this.writeAndRead(cmd);
  };

  setRTC = async (): Promise<void> => {
    const dateTime = generateDateTime2Buffer('2022-08-29', '11:11:11');
    const cmd = paddingZeroAndCrc16([0, 1, 65, 0, 0, ...dateTime]); // test RTC command
    await this.writeAndRead(cmd);
  };

  testHall = async (): Promise<void> => {
    const cmd = paddingZeroAndCrc16([0, 1, 65, 1, 0]); // test RTC command
    await this.writeAndRead(cmd);
  };

  testContactSensor = async (): Promise<void> => {
    const cmd = paddingZeroAndCrc16([0, 1, 65, 2, 0]); // test contact sensor command
    await this.writeAndRead(cmd);
  };

  testTouchKey = async (): Promise<void> => {
    const cmd = paddingZeroAndCrc16([0, 1, 65, 3, 0]); // test touch key command
    await this.writeAndRead(cmd);
  };

  testFob = async (): Promise<void> => {
    const cmd = paddingZeroAndCrc16([0, 1, 65, 4, 0]); // test fob command
    await this.writeAndRead(cmd);
  };

  getInfo2 = async (): Promise<void> => {
    const cmd = paddingZeroAndCrc16([0, 1, 65, 5, 0]); // get info 2 command
    await this.writeAndRead(cmd);
  };

  writeAndRead = async (cmd: number[]): Promise<Buffer> => {
    await this.write(cmd);
    return this.read();
  };

  write = async (cmd: number[]): Promise<void> => {
    return new Promise((resolve) => {
      for (let i = 0; i < cmd.length; i += 64) {
        const buf = Buffer.from(cmd.slice(i, i + 64));
        const str = buf.toString('hex');
        console.log('Sent:', str);
        this.device.write([0, ...buf]);
      }
      resolve();
    });
  };

  length = 0;

  received: Buffer = Buffer.from([]);

  read = async (): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line consistent-return
      this.device.read((err: Error, data: Uint8Array[]) => {
        if (err) return reject(err);
        const received = Buffer.from(data);
        const str = received.toString('hex');
        console.log('Received:', str);
        if (!this.length && received[0] === 90 && received[1] === 90)
          this.length = received[2] * 256 + received[3];
        this.received = Buffer.concat([this.received, received]);
        if (this.received.length - 2 >= this.length) {
          const res = this.received.slice();
          this.length = 0;
          this.received = Buffer.from([]);
          resolve(res);
        } else {
          this.read()
            .then((res) => resolve(res))
            .catch((error: Error) => reject(error));
        }
      });
    });
  };
}
