import { ipcMain, WebContents } from 'electron';
import HID from 'node-hid';
import tz from 'timezone';
import America from 'timezone/America';

import { alert, paddingZeroAndCrc16, generateDateTime2Buffer } from './util';
import { Device } from './db';
import MiniBleLibrary from './miniBleLibrary';
import * as api from './api';

export default class UsbController {
  private webContents: WebContents;

  private miniBleLibrary: MiniBleLibrary;

  private device: HID.HID;

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.miniBleLibrary = new MiniBleLibrary(this);
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
      const device = await this.getInfo();
      const promise = api.getDeviceToken(device.lockMac);
      const csr = await this.requestCsr(device);
      const certificates = await this.uploadCsr(device, csr);
      await this.forwardCrt(device, certificates.certificate);
      await this.forwardDevicePrivateKey(device, certificates.privateKey);
      await this.forwardDeviceCA(device, certificates.deviceCA);
      await this.forwardServerCA(device, certificates.rootCA);
      await this.setRTC(device);
      await this.testHallSensor(device);
      await this.testContactSensor(device);
      await this.testTouchKey(device);
      await this.testFob(device);
      await this.getInfo2(device);
      await promise;
      await this.miniBleLibrary.init(device);
      this.updateDBAndUI(device, 'Done');
    } catch (err) {
      alert('error', err.message);
    }
  };

  updateDBAndUI = (
    device: Device,
    step: string,
    state?: string,
    payload?: object
  ) => {
    let provisioning = `${step}`;
    if (state) provisioning += `: ${state}`;
    if (payload) provisioning += `- ${JSON.stringify(payload)}`;
    device.update({ provisioning });
    console.log(provisioning);
    this.webContents.send('usb', step, state, payload);
    this.webContents.send(
      'device',
      device.id,
      device.lockMac,
      device.imei,
      provisioning
    );
  };

  getInfo = async (): Promise<Device> => {
    const device = await Device.create({});
    this.updateDBAndUI(device, 'Request device info', 'pending');
    const cmd = paddingZeroAndCrc16([0, 1, 64, 0]); // get device info command
    const res = await this.writeAndRead(cmd);
    const lockMac = [...res.subarray(17, 23)]
      .map((n: number) => n.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
    const imei = [...res.subarray(23, 38)]
      .map((n: number) => (n - 48).toString())
      .join('');
    await device.update({ lockMac, imei });
    this.updateDBAndUI(device, 'Request device info', 'success', {
      lockMac,
      imei,
    });
    return device;
  };

  requestCsr = async (device: Device): Promise<string> => {
    this.updateDBAndUI(device, 'Request csr', 'pending');
    const cmd = paddingZeroAndCrc16([0, 1, 64, 1]); // request csr command
    const res = await this.writeAndRead(cmd);
    const str = res.toString();
    const i = str.indexOf('-----END CERTIFICATE REQUEST-----');
    this.updateDBAndUI(device, 'Request csr', 'success');
    return str.slice(17, i + 34);
  };

  uploadCsr = async (
    device: Device,
    csr: string
  ): Promise<api.CertificateObj> => {
    this.updateDBAndUI(device, 'Upload csr to server', 'pending');
    const res = await api.uploadCsr(device.lockMac, device.imei, csr);
    this.updateDBAndUI(device, 'Upload csr to server', 'success');
    return res;
  };

  forwardCrt = async (device: Device, certificate: string): Promise<void> => {
    this.updateDBAndUI(device, 'Send crt', 'pending');
    const crt = [...certificate].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 2, 0, 0, 0, 0, 0, 0, 0, 0];
    const cmd = paddingZeroAndCrc16([...arr, ...crt]); // forward crt command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Send crt', 'success');
  };

  forwardDevicePrivateKey = async (
    device: Device,
    privateKey: string
  ): Promise<void> => {
    this.updateDBAndUI(device, 'Send device private key', 'pending');
    const key = [...privateKey].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3];
    const cmd = paddingZeroAndCrc16([...arr, ...key]); // forward crt command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Send device private key', 'success');
  };

  forwardDeviceCA = async (device: Device, deviceCA: string): Promise<void> => {
    this.updateDBAndUI(device, 'Send device CA', 'pending');
    const ca = [...deviceCA].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 3, 0, 0, 0, 0, 0, 0, 0, 0, 2];
    const cmd = paddingZeroAndCrc16([...arr, ...ca]); // forward crt command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Send device CA', 'success');
  };

  forwardServerCA = async (device: Device, serverCA: string): Promise<void> => {
    this.updateDBAndUI(device, 'Send server CA', 'pending');
    const ca = [...serverCA].map((c) => c.charCodeAt(0));
    const arr = [0, 1, 64, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const cmd = paddingZeroAndCrc16([...arr, ...ca]); // forward crt command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Send server CA', 'success');
  };

  setRTC = async (device: Device): Promise<void> => {
    this.updateDBAndUI(device, 'Set RTC', 'pending');
    const us = tz(America);
    const arr = us(Date.now(), '%F,%T', 'America/Los_Angeles').split(',');
    const dateTime = generateDateTime2Buffer(arr[0], arr[1]);
    const cmd = paddingZeroAndCrc16([
      0,
      1,
      65,
      0,
      ...Array(8).fill(0),
      ...dateTime,
    ]); // test RTC command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Set RTC', 'success');
  };

  testHallSensor = async (device: Device): Promise<void> => {
    // TODO rename hall to apply for both lock and panel
    this.updateDBAndUI(device, 'Test hall sensor', 'pending');
    const cmd = paddingZeroAndCrc16([0, 1, 65, 1, 0]); // test Hall command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Test hall sensor', 'success');
  };

  testContactSensor = async (device: Device): Promise<void> => {
    this.updateDBAndUI(device, 'Test contact sensor', 'pending');
    const cmd = paddingZeroAndCrc16([0, 1, 65, 2, 0]); // test contact sensor command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(device, 'Test contact sensor', 'success');
  };

  testTouchKey = async (device: Device): Promise<void> => {
    this.updateDBAndUI(
      device,
      'Test touch key, input 123456789✖0🔓 in order',
      'pending'
    );
    const cmd = paddingZeroAndCrc16([0, 1, 65, 3, 0]); // test touch key command
    await this.writeAndRead(cmd);
    this.updateDBAndUI(
      device,
      'Test touch key, input 123456789✖0🔓 in order',
      'success',
      { keys: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 11] }
    ); // TODO detect result
  };

  testFob = async (device: Device): Promise<void> => {
    this.updateDBAndUI(
      device,
      'Test NFC chip, put the fob close to the panel',
      'pending'
    );
    const cmd = paddingZeroAndCrc16([0, 1, 65, 4, 0]); // test fob command
    const res = await this.writeAndRead(cmd);
    const fobNumber = res
      .subarray(17, 21)
      .readUint32LE()
      .toString()
      .padStart(10, '0'); // TODO inform Felix should be BE
    this.updateDBAndUI(
      device,
      'Test NFC chip, put the fob close to the panel',
      'success',
      { fobNumber }
    ); // TODO fix fobNumber
  };

  getInfo2 = async (device: Device): Promise<void> => {
    this.updateDBAndUI(device, 'Request device info 2', 'pending');
    const cmd = paddingZeroAndCrc16([0, 1, 65, 5, 0]); // get info 2 command
    const res = await this.writeAndRead(cmd);
    const iccid = [...res.subarray(39, 54)]
      .map((n: number) => (n - 48).toString())
      .join('');
    const battery = res[54];
    this.updateDBAndUI(device, 'Request device info 2', 'success', {
      iccid,
      battery,
    });
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
        // this.webContents.send('usb', 'Send', str);
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
        // this.webContents.send('usb', 'Received', str);
        if (!this.length && received[0] === 90 && received[1] === 90)
          this.length = received[2] * 256 + received[3];
        this.received = Buffer.concat([this.received, received]);
        if (this.received.length - 2 >= this.length) {
          const res = this.received.subarray();
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
