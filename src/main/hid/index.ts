import EventEmitter from 'events';
import { ipcMain, WebContents } from 'electron';
import HID from 'node-hid';

export default class Hid extends EventEmitter {
  private device: HID.HID;

  private webContents: WebContents;

  constructor(webContents: WebContents) {
    super();
    this.webContents = webContents;
    this.device = new HID.HID(0x2fe3, 0x100);
    this.device.on('data', (data: Uint8Array) => {
      console.log('received', data);
      this.webContents.send('received', data);
    });
    ipcMain.on('start', this.startSend);
  }

  startSend = () => {
    const cmd = [90, 90, 0, 62, 0, 1, 64, 0, ...Array(54).fill(0), 192, 124];
    this.device.write([0, ...cmd]);
    console.log('write', cmd);
    this.webContents.send('write', cmd);
  };
}
