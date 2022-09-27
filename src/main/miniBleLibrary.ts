import { Device } from './db';
import * as api from './api';
import { paddingZeroAndCrc16 } from './util';

interface UsbController {
  updateDBAndUI(
    device: Device,
    step: string,
    state?: string,
    payload?: object
  ): void;
  writeAndRead(cmd: number[]): Promise<Buffer>;
}

export default class MiniBleLibrary {
  private usbController: UsbController;

  constructor(usbController: UsbController) {
    this.usbController = usbController;
  }

  init = async (device: Device) => {
    this.usbController.updateDBAndUI(device, 'Initialization', 'pending');
    const parameters = {
      lockMac: device.lockMac,
      lockType: 'V3Lock',
      battery: 100,
      modelNum: 3,
      hardwareVer: 1,
      firmwareVer: 1,
      V3LockDeviceId: device.lockMac.split(':').slice(2).join('').toUpperCase(),
      timezone: 'Pacific Time (US & Canada)',
    };
    return this.initiateE2EWorkflow(device, 'init', parameters);
  };

  initiateE2EWorkflow = async (
    device: Device,
    workflow: string,
    reqParams?: object,
    resParams?: object
  ) => {
    let serverResponse: { success: boolean; command?: string };
    let bleResponse = '';
    do {
      // eslint-disable-next-line no-await-in-loop
      serverResponse = await api.requestServerCommand(
        device.lockMac,
        workflow,
        bleResponse,
        reqParams
      );
      if (!serverResponse.success) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw serverResponse; // TODO eslint disable command
      }
      // eslint-disable-next-line no-await-in-loop
      bleResponse = await this.sendBleCommandByUsb(
        device,
        serverResponse.command!.slice(6, 10) === '0000'
          ? 'add session key'
          : 'init',
        serverResponse.command!
      );
    } while (bleResponse.slice(6, 10) !== '0001');
    serverResponse = await api.forwardResponseToServer(
      device.lockMac,
      bleResponse,
      resParams
    );
    if (!serverResponse.success) {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw serverResponse; // TODO eslint disable command
    }
    while (serverResponse.command) {
      // eslint-disable-next-line no-await-in-loop
      bleResponse = await this.sendBleCommandByUsb(
        device,
        'init',
        serverResponse.command
      );
      // eslint-disable-next-line no-await-in-loop
      serverResponse = await api.forwardResponseToServer(
        device.lockMac,
        bleResponse,
        resParams
      );
      if (!serverResponse.success) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw serverResponse; // TODO eslint disable command
      }
    }
  };

  sendBleCommandByUsb = async (
    device: Device,
    name: string,
    command: string
  ): Promise<string> => {
    this.usbController.updateDBAndUI(device, `Send ${name} command`, 'pending');
    const cmd = paddingZeroAndCrc16([
      0,
      1,
      170,
      // 85 + (name === 'init' ? 1 : 0), TODO inform Felix
      85,
      ...Array(8).fill(0),
      ...Buffer.from(command, 'hex'),
    ]); // get info 2 command
    const res = await this.usbController.writeAndRead(cmd);
    return res.subarray(17, 17 + res[19] + 3).toString('hex');
  };
}
