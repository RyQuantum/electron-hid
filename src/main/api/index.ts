import { WebContents } from 'electron';
import axios from 'axios';
import FormData from 'form-data';

import { alert } from '../util';

let accessToken: string | null = null;

export const login = async (webContents: WebContents) => {
  const { data } = await axios.post(
    'https://api.rentlyopensesame.com/oakslock/token/login',
    { clientId: 'rently', clientSecret: 'rentlySecret' }
  );
  if (data.success) {
    accessToken = data.token.accessToken;
    console.log('accessToken:', accessToken);
    webContents.send('loggedIn');
    // return dialog.showMessageBox({ type: 'info', message: 'Login success' });
    return alert('info', 'Login success');
  }
  return alert('error', data.message);
};

export const uploadCsr = async (lockMac: string, imei: string, csr: string) => {
  const formData = new FormData();
  formData.append('file', csr, 'client.csr');
  const { data } = await axios.post(
    'https://api.rentlyopensesame.com/oakslock/device/addLockToDMS',
    formData,
    {
      params: {
        deviceId: lockMac.split(':').slice(2).join(''),
        deviceMac: lockMac,
        imei,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (data.success) {
    return data.certificate;
  }
  throw new Error(data.message);
};

export const getKeys = async () => {
  const { data: ca } = await axios.get(
    'http://192.168.2.8:8000/afa3ecf7f040216c421bcfcc7e7b61b5acf8dc57bff8c20d9e3bf791a645f152-certificate.pem.crt'
  );
  const { data: privateKey } = await axios.get(
    'http://192.168.2.8:8000/afa3ecf7f040216c421bcfcc7e7b61b5acf8dc57bff8c20d9e3bf791a645f152-private.pem.key'
  );
  const { data: rootCA } = await axios.get(
    'http://192.168.2.8:8000/AmazonRootCA1.pem'
  );

  return { ca, privateKey, rootCA };
};
