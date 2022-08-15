import EventEmitter from 'events';
import { ipcMain, WebContents } from 'electron';
import HID from 'node-hid';

// import { lock } from '../database';
import crc from 'crc';

export default class Hid extends EventEmitter {
  private device: HID.HID;

  private webContents: WebContents;

  constructor(webContents: WebContents) {
    super();
    this.webContents = webContents;
    this.device = new HID.HID(0x2fe3, 0x100);
    ipcMain.on('start', this.startTest);
  }

  startTest = async () => {
    const res = await this.send(this.paddingZeroAndCrc16([0, 1, 64, 0])); // get device info command
    // const res: Uint8Array[] = await getLockInfo();
  };

  send = async (cmd: []) => {
    return new Promise((resolve) => {
      const req = Buffer.from(cmd).toString('hex');
      console.log('write', req);
      this.webContents.send('write', req);
      this.device.write([0, ...cmd]);
      this.device.read((err: Error, data: Uint8Array[]) => {
        if (err) throw err;
        const res = Buffer.from(data).toString('hex');
        console.log('received', res);
        this.webContents.send('received', res);
        resolve(data);
      });
    });
  };

  paddingZeroAndCrc16 = (arr) => {
    let num = Math.floor(arr.length / 64);
    if (num * 64 < arr.length) num += 1;
    const length = num * 64 - 2;
    const payload = [
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
}
