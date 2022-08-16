import EventEmitter from 'events';
import { ipcMain, WebContents } from 'electron';
import HID from 'node-hid';
import crc from 'crc';
import { Lock } from '../database';
import * as api from '../api';

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
  const checksum = crc.crc16ccitt(data);
  return [...payload, Math.floor(checksum / 256), checksum % 256];
};

export default class Hid extends EventEmitter {
  private device: HID.HID;

  private webContents: WebContents;

  private lock: object | null;

  private certificate: object | null;

  constructor(webContents: WebContents) {
    super();
    this.webContents = webContents;
    this.device = new HID.HID(0x2fe3, 0x100);
    ipcMain.on('start', this.startTest);
  }

  startTest = async (): Promise<void> => {
    await this.getInfo();
    await this.requestCsr();
    await this.forwardCrt();
    this.updateDBAndUI({ provisioning: 'Done' });
  };

  updateDBAndUI = (obj) => {
    this.lock.update(obj);
    this.webContents.send('data', { id: this.lock.id, ...obj });
  };

  getInfo = async (): Promise<void> => {
    const cmd = paddingZeroAndCrc16([0, 1, 64, 0]); // get device info command
    const res = await this.writeAndRead(cmd);
    const lockMac = [...res.slice(17, 23)]
      .map((n: number) => n.toString(16))
      .join(':')
      .toUpperCase();
    const imei = [...res.slice(23, 38)]
      .map((n: number) => (n - 48).toString())
      .join('');
    this.lock = await Lock.create({ lockMac, imei });
    this.webContents.send('data', { id: this.lock.id, lockMac, imei });
  };

  requestCsr = async (): Promise<void> => {
    this.updateDBAndUI({ provisioning: 'Requesting csr...' });
    const cmd = paddingZeroAndCrc16([0, 1, 64, 1]); // request csr command
    const res = await this.writeAndRead(cmd);
    this.updateDBAndUI({ provisioning: 'Uploading csr...' });
    const str = res.toString();
    const i = str.indexOf('-----END CERTIFICATE REQUEST-----');
    this.certificate = await api.uploadCsr(
      this.lock.lockMac,
      this.lock.imei,
      str.slice(17, i + 34)
    );
  };

  forwardCrt = async (): Promise<void> => {
    this.updateDBAndUI({ provisioning: 'Sending crt...' });
    const crt = [...this.certificate.certificate].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 2, 0, 0, 0, 0, 0, 0, 0, 0];
    const cmd = paddingZeroAndCrc16([...arr, ...crt]); // forward crt command
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
        console.log('write', str);
        this.webContents.send('write', str);
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
        console.log('received', str);
        this.webContents.send('received', str);
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
